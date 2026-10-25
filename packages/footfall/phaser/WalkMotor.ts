import type { FootCycle, FootPose } from "../core/characters/footLock";
import {
	headingFromGround,
	type WalkDirection,
} from "../core/characters/walkHeading";
import { cellPoint, nearestCell } from "../core/walkarea/navigation";
import {
	fromMetres,
	type Point,
	scaleAt,
	toMetres,
} from "../core/walkarea/perspective";
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
/** The two things a person tunes on a walk. Body speed follows from them:
 * metres per second = drawn stride × strideScale × stridesPerSecond. */
export interface GaitSettings {
	/** Stride length as a multiple of the stride the side sheet draws (1 = as drawn). */
	strideScale?: number;
	/** Stride length in metres; overrides strideScale. */
	strideMetres?: number;
	/** Full strides (two steps) per second. Default: the side sheet's authored rate. */
	stridesPerSecond?: number;
}
export interface WalkMotorOptions {
	/** One gait for every heading: a person has one stride and one tempo. */
	gait?: GaitSettings;
	/** Absolute body speed in metres per second. Overrides the gait-derived
	 * speed; the legs then keep their stride and follow the ground. */
	speedMetresPerSecond?: number;
	/** Screen distance within which a walk counts as having reached its goal. */
	arrivalTolerance?: number;
	/** How much of the stride's vertical bob reaches the body: 0 glides with a
	 * constant sole row per sheet (default), 1 is the full bob. */
	verticalBob?: number;
	/** Where the bob curve comes from: "pendulum" models the hip drop from the
	 * feet's spread; "drawing" follows the drawn feet (sheet soleRows). */
	bobMode?: "pendulum" | "drawing";
}
interface GroundOffset {
	x: number;
	y: number;
}
interface GaitProfile {
	/** Sheet pixels the planted sole travels from each frame to the next. */
	steps: number[];
	/** Fraction of the sheet's total sole travel reached at the start of each
	 * frame (0 for frame 0, rising to just under 1). Uniform for depth cycles. */
	cumulative: number[];
	/** Feet-together frames, one per stance: where a standing pose cuts in cleanly. */
	passing: number[];
	mean: number;
	durations: number[];
	/** True for cycles whose motion is across the screen; depth cycles are timed. */
	lateral: boolean;
}

/** Each stride of a walk should rise and fall the same. Resample the curve over
 * every stance (switch to switch) onto one phase axis, average them, and lay
 * that one curve back over each stance. Cycles without two switches pass through. */
function symmetricStride(curve: number[], switches: number[]): number[] {
	const n = curve.length;
	if (switches.length !== 2 || n < 4) return curve;
	const stances = switches.map((start, k) => {
		const end = switches[(k + 1) % 2];
		const length = (((end - start) % n) + n) % n || n;
		return { start, length };
	});
	const samples = 64;
	const shared = new Array(samples).fill(0);
	for (const { start, length } of stances)
		for (let j = 0; j < samples; j++) {
			const u = (j / samples) * length;
			const i0 = Math.floor(u);
			const t = u - i0;
			const a = curve[(start + i0) % n];
			const b = curve[(start + i0 + 1) % n];
			shared[j] += (a * (1 - t) + b * t) / stances.length;
		}
	const out = [...curve];
	for (const { start, length } of stances)
		for (let i = 0; i < length; i++) {
			const u = (i / length) * samples;
			const j0 = Math.floor(u) % samples;
			const t = u - Math.floor(u);
			out[(start + i) % n] =
				shared[j0] * (1 - t) + shared[(j0 + 1) % samples] * t;
		}
	return out;
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
	/** Metres walked since the current pass through the sheet began. */
	private sheetProgress = 0;
	/** Last-stride adjustment so the walk ends on a feet-together frame. */
	private arrivalFit?: { baseProgress: number; baseU: number; length: number };
	private resolve?: () => void;
	private offsets = new Map<
		string,
		{ x: number; soleY: number[]; mean: number }
	>();
	private readonly verticalBob: number;
	private readonly bobMode: "pendulum" | "drawing";
	private readonly gaitOptions: GaitSettings;
	private gaits = new Map<string, GaitProfile>();
	private alignments = new Map<string, number>();
	private readonly fixedSpeed?: number;
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
		this.verticalBob = Math.min(1, Math.max(0, options.verticalBob ?? 0));
		this.bobMode = options.bobMode ?? "pendulum";
		this.gaitOptions = options.gait ?? {};
		this.fixedSpeed = options.speedMetresPerSecond;
	}

	detach(): void {
		this.stop();
		if (this.target.motor === this) this.target.motor = undefined;
	}

	/** Per-frame gait data for a cycle: how far the planted sole travels across
	 * the sheet from one drawing to the next, and each drawing's duration. */
	private gait(cycle: FootCycle): GaitProfile {
		const cached = this.gaits.get(cycle.name);
		if (cached) return cached;
		const { contacts, fps, frameDurationsMs } = cycle;
		const n = contacts.length;
		const raw = contacts.map((frame, i) => {
			const next = contacts[(i + 1) % n];
			return next.planted === frame.planted
				? Math.abs(next[frame.planted].x - frame[frame.planted].x)
				: Number.NaN;
		});
		const valid = raw.filter((v) => Number.isFinite(v) && v > 0);
		const mean = valid.length
			? valid.reduce((a, b) => a + b, 0) / valid.length
			: 0;
		// Tracked steps carry frame-to-frame noise; locking each drawing to its raw
		// step makes the legs race or stall. Smooth the profile around the cycle so
		// slow stride-speed changes are followed and noise is not.
		const filled = raw.map((v) => (Number.isFinite(v) && v > 0 ? v : mean));
		const half = Math.max(1, Math.round(n / 12));
		const steps = filled.map((_, i) => {
			let sum = 0;
			for (let k = -half; k <= half; k++) sum += filled[(i + k + n) % n];
			return sum / (2 * half + 1);
		});
		const lateral = mean * n >= cycle.frameWidth / 4;
		const floored = steps.map((v) => Math.max(v, mean / 3));
		const total = floored.reduce((a, b) => a + b, 0);
		const cumulative: number[] = [];
		let acc = 0;
		for (let i = 0; i < n; i++) {
			cumulative.push(lateral ? acc / total : i / n);
			acc += floored[i];
		}
		// Feet together: local minima of foot spread, at least a quarter sheet apart.
		const spread = contacts.map((c) => Math.abs(c.L.x - c.R.x));
		const minima = spread
			.map((v, i) => ({ v, i }))
			.filter(
				({ v, i }) => v <= spread[(i + n - 1) % n] && v <= spread[(i + 1) % n],
			)
			.sort((a, b) => a.v - b.v);
		const passing: number[] = [];
		for (const { i } of minima)
			if (
				passing.every(
					(q) => Math.min((i - q + n) % n, (q - i + n) % n) >= n / 4,
				)
			)
				passing.push(i);
		passing.sort((a, b) => a - b);
		const profile: GaitProfile = {
			steps,
			cumulative,
			passing: passing.length ? passing : [0],
			mean,
			durations: contacts.map((_, i) => frameDurationsMs?.[i] ?? 1000 / fps),
			// Lateral when the sole travels at least a quarter frame width per
			// cycle; depth cycles track a few pixels of noise at most.
			lateral,
		};
		this.gaits.set(cycle.name, profile);
		return profile;
	}

	/** Strides a sheet holds: one per pair of support switches. */
	private stridesInSheet(cycle: FootCycle): number {
		return Math.max(1, Math.floor(cycle.switchFrames.length / 2));
	}

	/** Full strides per second at a sheet's authored frame durations. */
	private naturalCadence(cycle: FootCycle): number {
		const ms = this.gait(cycle).durations.reduce((a, b) => a + b, 0);
		return ms > 0 ? (1000 / ms) * this.stridesInSheet(cycle) : 1;
	}

	/** Metres the side sheet's drawn stride covers at this scene's scale. */
	private drawnStrideMetres(): number {
		const cycle = this.animation.select("left").cycle;
		const g = this.gait(cycle);
		if (!g.lateral) return 1.3;
		const ppm =
			this.area.perspective.pixelsPerMetre ?? DEFAULT_PIXELS_PER_METRE;
		const sheetPx =
			g.steps.reduce((a, b) => a + b, 0) /
			(cycle.pixelScale ?? 1) /
			this.stridesInSheet(cycle);
		return sheetPx * (this.area.baseScale / ppm);
	}

	/** The stride and tempo in force, in metres and strides per second. */
	private stride(): { metres: number; perSecond: number } {
		const o = this.gaitOptions;
		return {
			metres: o.strideMetres ?? this.drawnStrideMetres() * (o.strideScale ?? 1),
			perSecond:
				o.stridesPerSecond ??
				this.naturalCadence(this.animation.select("left").cycle),
		};
	}

	/** Body speed in metres per second, the same for every heading. */
	private bodySpeed(): number {
		if (this.fixedSpeed !== undefined) return this.fixedSpeed;
		const { metres, perSecond } = this.stride();
		return metres * perSecond;
	}

	/** Offset from the sprite origin (bottom centre) to the ground point, in
	 * unscaled sheet pixels. Horizontal: the drawn body centre, averaged over
	 * the cycle so tracking noise never reaches the body. Vertical: the lower
	 * sole of the current frame, so the planted foot rests on the ground row
	 * and the body bobs as drawn instead of the feet sinking and floating. */
	private groundOffset(pose: FootPose): GroundOffset {
		const key = `${pose.cycle.name}:${pose.flipX ? "f" : "n"}`;
		let sheet = this.offsets.get(key);
		if (!sheet) {
			const { contacts, frameWidth, frameHeight, bodyCentreX } = pose.cycle;
			let x = 0;
			for (const frame of contacts)
				x += (frame.L.x + frame.R.x) / 2 - frameWidth / 2;
			const bodyX =
				bodyCentreX !== undefined
					? bodyCentreX - frameWidth / 2
					: x / contacts.length;
			// Bob as the body really does it: the hip drops as the legs spread and
			// rises as the support leg comes vertical (an inverted pendulum). Foot
			// spread is read from the contacts, which track cleanly; the drop is
			// leg length minus the pendulum height for that spread. Both strides
			// get the same curve.
			const raw = contacts.map(
				(frame) => Math.max(frame.L.y, frame.R.y) - frameHeight,
			);
			const n = raw.length;
			const leg = 0.53 * (pose.cycle.drawnHeight ?? frameHeight * 0.9);
			const spread = contacts.map((frame) => Math.abs(frame.L.x - frame.R.x));
			const half = Math.max(1, Math.round(n / 24));
			const dip = spread.map((_, i) => {
				let sum = 0;
				for (let k = -half; k <= half; k++) sum += spread[(i + k + n) % n];
				const s = sum / (2 * half + 1) / 2;
				return leg - Math.sqrt(Math.max(0, leg * leg - s * s));
			});
			const base = raw.reduce((a, b) => a + b, 0) / n;
			let soleY: number[];
			if (this.bobMode === "drawing" && pose.cycle.soleRows?.length === n) {
				// Follow the drawn feet: rest the figure's bottom row on the ground,
				// lightly smoothed, so the body sits where the drawn legs put it.
				const rows = pose.cycle.soleRows.map((r) => r - frameHeight);
				const smooth = rows.map(
					(_, i) => (rows[(i + n - 1) % n] + rows[i] + rows[(i + 1) % n]) / 3,
				);
				const rowMean = smooth.reduce((a, b) => a + b, 0) / n;
				soleY = smooth.map((r) => base + (r - rowMean));
			} else {
				const curve = symmetricStride(dip, pose.cycle.switchFrames);
				const dipMean = curve.reduce((a, b) => a + b, 0) / n;
				// Lower the body by the drop: a smaller offset draws the origin lower.
				soleY = curve.map((d) => base - (d - dipMean));
			}
			sheet = {
				x: bodyX * (pose.flipX ? -1 : 1),
				soleY,
				mean: base,
			};
			this.offsets.set(key, sheet);
		}
		const frame = sheet.soleY[pose.frame] ?? sheet.soleY[0];
		return {
			x: sheet.x,
			y:
				sheet.mean +
				this.bodyAlignment(pose) +
				(frame - sheet.mean) * this.verticalBob,
		};
	}

	/** Vertical correction, in this sheet's pixels, that puts its drawn body
	 * centre at the same height above the ground as the reference sheet's, so
	 * a cycle change never moves the torso. Zero when a sheet lacks the data. */
	private bodyAlignment(pose: FootPose): number {
		const own = pose.cycle;
		const ref = this.animation.select("left").cycle;
		if (own.bodyCentreY === undefined || ref.bodyCentreY === undefined)
			return 0;
		const cached = this.alignments.get(own.name);
		if (cached !== undefined) return cached;
		const soleMean = (cycle: FootCycle) =>
			cycle.contacts.reduce(
				(sum, f) => sum + Math.max(f.L.y, f.R.y) - cycle.frameHeight,
				0,
			) / cycle.contacts.length;
		// Height of the body centre above the ground row, in canonical pixels.
		const height = (cycle: FootCycle, centreY: number) =>
			(soleMean(cycle) - (centreY - cycle.frameHeight)) /
			(cycle.pixelScale ?? 1);
		const correction =
			(height(ref, ref.bodyCentreY) - height(own, own.bodyCentreY)) *
			(own.pixelScale ?? 1);
		this.alignments.set(own.name, correction);
		return correction;
	}

	/** Sprite scale multiplier for a sheet: brings a reduced-resolution sheet back
	 * to canonical size and normalises drawn height against the side cycle. */
	private sheetScale(pose: FootPose): number {
		const reference = this.animation.select("left").cycle;
		const own = pose.cycle;
		const ownPixel = own.pixelScale ?? 1;
		const canonical = (h?: number, p = 1) => (h ? h / p : undefined);
		const refHeight = canonical(
			reference.drawnHeight,
			reference.pixelScale ?? 1,
		);
		const ownHeight = canonical(own.drawnHeight, ownPixel);
		const normalise = refHeight && ownHeight ? refHeight / ownHeight : 1;
		return normalise / ownPixel;
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
		return (
			this.bodySpeed() * ppm * scaleAt(perspective, this.anchor, scaleClamp)
		);
	}

	/** Whether the perspective can map screen points to ground metres. */
	private hasGround(): boolean {
		const p = this.area.perspective;
		return p.constant === undefined && !!p.slope;
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
		// A point on or above the horizon has no ground position; keep facing as is.
		if (!Number.isFinite(dX) || !Number.isFinite(dZ)) return this.heading;
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
		const fromStanding = !this.pose || !this.isWalkCycle(this.pose);
		this.heading = heading;
		const selected = this.animation.select(heading);
		// Progress is metres within the stride, so a turn keeps the gait phase.
		this.sheetProgress = this.sheetProgress % this.stride().metres;
		this.arrivalFit = undefined;
		if (fromStanding) {
			// Starting from standing: begin at a feet-together frame, which the
			// standing pose already matches, so the start is not a cut.
			const g = this.gait(selected.cycle);
			const length = this.stride().metres * this.stridesInSheet(selected.cycle);
			this.sheetProgress = g.cumulative[g.passing[0]] * length;
		}
		this.pose = { ...selected, frame: this.frameAt(selected.cycle) };
		this.animate("walk", heading, 1);
	}

	/** The drawing for the metres walked into the current pass of a sheet:
	 * the sheet's sole travel is laid over its strides of metres, and the frame
	 * whose cumulative travel the progress has reached is shown. Exact for any
	 * step profile and any render step, so tempo never drifts. */
	private frameAt(cycle: FootCycle): number {
		const g = this.gait(cycle);
		const n = cycle.contacts.length;
		const length = this.stride().metres * this.stridesInSheet(cycle);
		const fit = this.arrivalFit;
		const raw = fit
			? fit.baseU + (this.sheetProgress - fit.baseProgress) / fit.length
			: this.sheetProgress / length;
		const u = ((raw % 1) + 1) % 1;
		let lo = 0;
		let hi = n - 1;
		while (lo < hi) {
			const mid = (lo + hi + 1) >> 1;
			if (g.cumulative[mid] <= u) lo = mid;
			else hi = mid - 1;
		}
		return lo;
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
		this.arrivalFit = undefined;
		this.sheetProgress = 0;
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
		const p = this.area.perspective;
		const ground = this.hasGround();
		// Walk a fixed number of metres this frame along the path, measured on
		// the ground. A screen pixel of depth is far more ground than a screen
		// pixel sideways, so screen-space pacing would sprint on diagonals.
		const toG = (q: Point) => (ground ? toMetres(p, q) : q);
		const fromG = (q: Point) => (ground ? fromMetres(p, q) : q);
		const ppm = p.pixelsPerMetre ?? DEFAULT_PIXELS_PER_METRE;
		let remaining = ground
			? (this.bodySpeed() * delta) / 1000
			: (this.screenSpeed() * delta) / 1000;
		let here = toG(this.anchor);
		let movedMetres = 0;
		while (remaining > 0 && this.segment < this.path.length) {
			const next = toG(this.path[this.segment]);
			const dx = next.x - here.x;
			const dy = next.y - here.y;
			const distance = Math.hypot(dx, dy);
			if (distance <= remaining) {
				here = next;
				remaining -= distance;
				movedMetres += distance;
				this.segment++;
				continue;
			}
			here = {
				x: here.x + (dx / distance) * remaining,
				y: here.y + (dy / distance) * remaining,
			};
			movedMetres += remaining;
			remaining = 0;
		}
		this.anchor = fromG(here);
		if (!ground)
			movedMetres /= ppm * scaleAt(p, this.anchor, this.area.scaleClamp);
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
		// The drawings follow the ground: metres walked select the frame through
		// the sheet's cumulative sole travel, so the feet stay planted and one
		// stride of metres is exactly one cycle, for any heading or step profile.
		this.sheetProgress += movedMetres;
		this.planArrival(toG, here);
		this.pose = { ...this.pose, frame: this.frameAt(this.pose.cycle) };
		this.apply();
	}

	/** Within the last stride, stretch or shrink it a little so the walk ends on
	 * a feet-together frame; the standing pose then cuts in without a jump. */
	private planArrival(toG: (q: Point) => Point, here: Point): void {
		if (this.arrivalFit || !this.pose) return;
		let remaining = 0;
		let from = here;
		for (let i = this.segment; i < this.path.length; i++) {
			const next = toG(this.path[i]);
			remaining += Math.hypot(next.x - from.x, next.y - from.y);
			from = next;
		}
		const cycle = this.pose.cycle;
		const g = this.gait(cycle);
		const strides = this.stridesInSheet(cycle);
		const length = this.stride().metres * strides;
		if (remaining > (length / strides) * 1.3) return;
		const u = (((this.sheetProgress / length) % 1) + 1) % 1;
		// Landing points ahead: feet-together frames in this pass or the next.
		const candidates = g.passing
			.flatMap((f) => [g.cumulative[f], g.cumulative[f] + 1])
			.map((c) => c - u)
			.filter((d) => d > 0.05)
			.sort((a, b) => a - b);
		for (const d of candidates) {
			const fitted = remaining / d;
			if (fitted >= length * 0.7 && fitted <= length * 1.4) {
				this.arrivalFit = {
					baseProgress: this.sheetProgress,
					baseU: u,
					length: fitted,
				};
				return;
			}
		}
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
			speedMetresPerSecond: this.bodySpeed(),
			gait: this.stride(),
			screenSpeed: this.screenSpeed(),
		};
	}
}

export type { FootCycle, FootPose };
