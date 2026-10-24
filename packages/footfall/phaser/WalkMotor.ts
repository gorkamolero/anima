import type { FootCycle, FootPose } from "../core/characters/footLock";
import {
	headingFromGround,
	type WalkDirection,
} from "../core/characters/walkHeading";
import { cellPoint, nearestCell } from "../core/walkarea/navigation";
import { type Point, scaleAt, toMetres } from "../core/walkarea/perspective";
import type { WalkArea } from "../core/walkarea/types";

export interface MotorTarget extends Point {
	motor?: WalkMotor;
	setPosition(x: number, y: number): unknown;
	setScale(scale: number): unknown;
	setDepth(depth: number): unknown;
}
export interface FootAnimation {
	current(): FootPose;
	select(direction: WalkDirection): Omit<FootPose, "frame">;
	show(pose: FootPose): void;
	standing?(direction: WalkDirection): FootPose | undefined;
}
export interface WalkMotorOptions {
	/** Ground speed in metres per second. Default: the side walk cycle's own
	 * speed at its native frame rate, so that cycle never slides. */
	speedMetresPerSecond?: number;
	/** Screen distance within which a walk counts as having reached its goal. */
	arrivalTolerance?: number;
}
interface GroundOffset {
	x: number;
	y: number;
}

const DEFAULT_PIXELS_PER_METRE = 300;

/**
 * Continuous-path walking: the ground point under the character moves along
 * the navigation path at a constant ground speed, every render frame. The
 * drawing is chosen from the ground heading and advances at its native rate.
 * Position never depends on an animation frame, so a 24 fps drawing runs on a
 * 120 Hz display without judder, and tracked sole noise never reaches the body.
 */
export class WalkMotor {
	heading: WalkDirection = "left";
	walking = false;
	arrival?: {
		target: Point;
		anchor: Point;
		distance: number;
		halfStride: number;
		switchFrame: number;
		exactDistance: number;
		absorbedDistance: number;
	};
	/** Ground point under the character's feet, in scene pixels. */
	anchor: Point = { x: 0, y: 0 };
	private pose?: FootPose;
	private scale = 1;
	private path: Point[] = [];
	private segment = 0;
	private goal?: Point;
	private phase = 0;
	private resolve?: () => void;
	private offsets = new Map<string, GroundOffset>();
	private readonly speed: number;
	private readonly tolerance: number;

	constructor(
		readonly target: MotorTarget,
		public area: WalkArea,
		private animate: (
			state: "walk" | "idle",
			heading: WalkDirection,
			rate: number,
		) => void,
		private animation: FootAnimation,
		options: WalkMotorOptions = {},
	) {
		target.motor?.detach();
		target.motor = this;
		this.tolerance = options.arrivalTolerance ?? 2;
		this.speed =
			options.speedMetresPerSecond ??
			this.naturalSpeed(animation.select("left"));
	}

	detach(): void {
		this.stop();
		if (this.target.motor === this) this.target.motor = undefined;
	}

	/** Metres per second at which the side cycle's planted foot stays still. */
	private naturalSpeed(pose: Omit<FootPose, "frame">): number {
		const { contacts, fps, frameDurationsMs } = pose.cycle;
		let sheetDistance = 0;
		let durationMs = 0;
		for (let i = 0; i < contacts.length; i++) {
			const previous = contacts[(i + contacts.length - 1) % contacts.length];
			const current = contacts[i];
			if (previous.planted === current.planted) {
				const foot = current.planted;
				sheetDistance += Math.abs(previous[foot].x - current[foot].x);
			} else {
				// Support transfer: the incoming sole was tracked in both frames.
				const foot = current.planted;
				sheetDistance += Math.abs(previous[foot].x - current[foot].x);
			}
			durationMs += frameDurationsMs?.[i] ?? 1000 / fps;
		}
		const ppm =
			this.area.perspective.pixelsPerMetre ?? DEFAULT_PIXELS_PER_METRE;
		const metres = (sheetDistance * this.area.baseScale) / ppm;
		return durationMs > 0 && metres > 0 ? metres / (durationMs / 1000) : 1.3;
	}

	/** Mean sole midpoint of a sheet, relative to the sprite origin (bottom centre),
	 * in unscaled sheet pixels. Averaged over the cycle so the body never inherits
	 * per-frame tracking noise; the gait's own bob is in the drawings. */
	private groundOffset(pose: FootPose): GroundOffset {
		const key = `${pose.cycle.name}:${pose.flipX ? "f" : "n"}`;
		const cached = this.offsets.get(key);
		if (cached) return cached;
		const { contacts, frameWidth, frameHeight, bodyCentreX } = pose.cycle;
		let x = 0;
		let y = 0;
		for (const frame of contacts) {
			x += (frame.L.x + frame.R.x) / 2 - frameWidth / 2;
			y += Math.max(frame.L.y, frame.R.y) - frameHeight;
		}
		// Align sheets on the drawn body when the sheet records it: a side walker's
		// feet sit well ahead of the torso, and the torso is what the eye tracks
		// across a cycle change. The feet still rest on the ground row.
		const bodyX =
			bodyCentreX !== undefined
				? bodyCentreX - frameWidth / 2
				: x / contacts.length;
		const offset = {
			x: bodyX * (pose.flipX ? -1 : 1),
			y: y / contacts.length,
		};
		this.offsets.set(key, offset);
		return offset;
	}

	/** Sheets drawn at slightly different sizes are normalised to the side cycle. */
	private sheetScale(pose: FootPose): number {
		const reference = this.animation.select("left").cycle.drawnHeight;
		const own = pose.cycle.drawnHeight;
		return reference && own ? reference / own : 1;
	}

	private apply(): void {
		if (!this.pose) return;
		const { perspective, baseScale, scaleClamp } = this.area;
		this.scale = baseScale * scaleAt(perspective, this.anchor, scaleClamp);
		const drawn = this.scale * this.sheetScale(this.pose);
		const offset = this.groundOffset(this.pose);
		this.target.setPosition(
			this.anchor.x - offset.x * drawn,
			this.anchor.y - offset.y * drawn,
		);
		this.target.setScale(drawn);
		this.target.setDepth(10 + this.anchor.y / 20);
		this.animation.show(this.pose);
	}

	/** Screen pixels per second at the current depth. */
	private screenSpeed(): number {
		const { perspective, scaleClamp } = this.area;
		const ppm = perspective.pixelsPerMetre ?? DEFAULT_PIXELS_PER_METRE;
		return this.speed * ppm * scaleAt(perspective, this.anchor, scaleClamp);
	}

	private groundVector(from: Point, to: Point): { dX: number; dZ: number } {
		const p = this.area.perspective;
		if (p.constant !== undefined || !p.slope)
			return { dX: to.x - from.x, dZ: from.y - to.y };
		const a = toMetres(p, from);
		const b = toMetres(p, to);
		return { dX: b.x - a.x, dZ: b.y - a.y };
	}

	/** Pure ground heading: a path parallel to the image plane reads as
	 * left/right wherever the character stands, like a hand-built room. */
	private headingTowards(point: Point): WalkDirection {
		const { dX, dZ } = this.groundVector(this.anchor, point);
		return headingFromGround(dX, dZ, this.heading);
	}

	private showStanding(): void {
		const standing = this.animation.standing?.(this.heading);
		this.pose = standing ?? {
			...this.animation.select(this.heading),
			frame: 0,
		};
		this.apply();
	}

	private setWalkingHeading(heading: WalkDirection): void {
		if (this.pose && heading === this.heading && this.isWalkCycle(this.pose))
			return;
		const from = this.pose?.cycle.contacts.length ?? 1;
		this.heading = heading;
		const selected = this.animation.select(heading);
		const to = selected.cycle.contacts.length;
		// Keep the gait phase across cycle changes so a turn does not restart the stride.
		this.phase = ((this.phase % from) / from) * to;
		this.pose = { ...selected, frame: Math.floor(this.phase) % to };
		this.animate("walk", heading, 1);
	}

	private isWalkCycle(pose: FootPose): boolean {
		return pose.cycle.name === this.animation.select(this.heading).cycle.name;
	}

	place(position: Point, snapToFloor = true): void {
		this.stop();
		const mask = this.area.mask;
		const cell = nearestCell(mask, position);
		if (cell < 0) throw new Error("Walk area has no floor");
		this.anchor = snapToFloor ? cellPoint(mask, cell) : { ...position };
		this.showStanding();
	}

	/** Arrival threshold placement: the point is the ground contact itself. */
	placeContact(position: Point): void {
		this.place(position, false);
	}

	/** Nearest floor cell to a preferred stopping point, if any. */
	inwardStop(preferred: Point): Point | undefined {
		const cell = nearestCell(this.area.mask, preferred);
		return cell < 0 ? undefined : cellPoint(this.area.mask, cell);
	}

	walk(
		points: readonly Point[],
		initialHeading?: WalkDirection,
	): Promise<void> {
		this.stop();
		this.arrival = undefined;
		// Copy: callers may pass live objects (the sprite itself as the start).
		const copied = points.map((p) => ({ x: p.x, y: p.y }));
		// Navigation starts from the sprite origin, not the ground point. Treat a
		// first waypoint beside the character as the start marker, not a target.
		if (
			copied.length > 1 &&
			Math.hypot(copied[0].x - this.anchor.x, copied[0].y - this.anchor.y) < 60
		)
			copied.shift();
		this.path = copied.filter(
			(p, i) =>
				i === 0 || Math.hypot(p.x - copied[i - 1].x, p.y - copied[i - 1].y) > 0,
		);
		this.segment = 0;
		this.goal = this.path[this.path.length - 1];
		if (!this.goal) return Promise.resolve();
		this.advanceSegment();
		if (this.segment >= this.path.length) {
			this.arrive();
			return Promise.resolve();
		}
		this.walking = true;
		this.phase = 0;
		this.setWalkingHeading(
			initialHeading ?? this.headingTowards(this.path[this.segment]),
		);
		this.apply();
		return new Promise<void>((resolve) => {
			this.resolve = resolve;
		});
	}

	/** Skip waypoints already under the character. */
	private advanceSegment(): void {
		while (this.segment < this.path.length) {
			const next = this.path[this.segment];
			if (Math.hypot(next.x - this.anchor.x, next.y - this.anchor.y) > 1e-6)
				break;
			this.segment++;
		}
	}

	update(delta: number): void {
		if (!this.walking || !this.pose || delta <= 0) return;
		let remaining = (this.screenSpeed() * delta) / 1000;
		while (remaining > 0 && this.segment < this.path.length) {
			const next = this.path[this.segment];
			const dx = next.x - this.anchor.x;
			const dy = next.y - this.anchor.y;
			const distance = Math.hypot(dx, dy);
			if (distance <= remaining) {
				this.anchor = { ...next };
				remaining -= distance;
				this.segment++;
				continue;
			}
			this.anchor = {
				x: this.anchor.x + (dx / distance) * remaining,
				y: this.anchor.y + (dy / distance) * remaining,
			};
			remaining = 0;
		}
		const target = this.path[this.segment];
		const goal = this.goal;
		if (
			!target ||
			(goal &&
				Math.hypot(goal.x - this.anchor.x, goal.y - this.anchor.y) <=
					this.tolerance)
		) {
			this.arrive();
			return;
		}
		this.setWalkingHeading(this.headingTowards(target));
		this.phase += (delta * this.pose.cycle.fps) / 1000;
		this.pose = {
			...this.pose,
			frame: Math.floor(this.phase) % this.pose.cycle.contacts.length,
		};
		this.apply();
	}

	private arrive(): void {
		if (this.goal) this.anchor = { ...this.goal };
		this.arrival = {
			target: this.goal ?? { ...this.anchor },
			anchor: { ...this.anchor },
			distance: 0,
			halfStride: 40,
			switchFrame: 0,
			exactDistance: 0,
			absorbedDistance: 0,
		};
		this.path = [];
		this.showStanding();
		this.finish();
	}

	private finish(): void {
		this.walking = false;
		this.animate("idle", this.heading, 1);
		const resolve = this.resolve;
		this.resolve = undefined;
		resolve?.();
	}

	/** Stop where the character is, standing in the current heading. */
	stop(): void {
		const wasWalking = this.walking;
		this.path = [];
		this.segment = 0;
		if (wasWalking) {
			this.showStanding();
			this.finish();
		}
	}

	face(heading: WalkDirection): void {
		this.heading = heading;
		if (this.walking) this.stop();
		else if (this.pose) this.showStanding();
	}

	facePoint(point: Point): Promise<void> {
		this.face(this.headingTowards(point));
		return Promise.resolve();
	}

	snapshot() {
		const p = this.area.perspective;
		return {
			ground:
				p.constant !== undefined || !p.slope
					? { ...this.anchor }
					: toMetres(p, this.anchor),
			plan: {
				pending: false,
				remaining: Math.max(0, this.path.length - this.segment),
				distance: undefined as number | undefined,
				search: undefined,
				complete: true,
			},
			arrival: this.arrival,
			heading: this.heading,
			walking: this.walking,
			anchor: { ...this.anchor },
			frame: this.pose?.frame,
			cycle: this.pose?.cycle.name,
			speedMetresPerSecond: this.speed,
			screenSpeed: this.screenSpeed(),
		};
	}
}

export type { FootCycle, FootPose };
