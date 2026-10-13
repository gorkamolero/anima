import {
	cellAt,
	cellPoint,
	findPath,
	lineOfSight,
	nearestCell,
} from "../walkarea/navigation";
import { type Point, scaleAt, toMetres } from "../walkarea/perspective";
import type { WalkArea } from "../walkarea/types";
import {
	contactOnScreen,
	type Foot,
	type FootPose,
	lockedPlacement,
} from "./footLock";
import { type PlannedStep, planFootsteps, walkLegs } from "./footstepPlan";
import { stanceFrameMs } from "./stanceTiming";
import {
	GROUND_SECTORS,
	headingFromGround,
	type WalkDirection,
} from "./walkHeading";

export interface MotorTarget extends Point {
	motor?: CharacterMotor;
	setPosition(x: number, y: number): unknown;
	setScale(scale: number): unknown;
	setDepth(depth: number): unknown;
}
export interface FootAnimation {
	current(): FootPose;
	select(direction: WalkDirection): Omit<FootPose, "frame">;
	show(pose: FootPose): void;
	standing?(direction: WalkDirection): FootPose;
}
interface PredictedStance {
	start: Point;
	end: Point;
	anchor: Point;
	foot: Foot;
	pose: FootPose;
	scale: number;
}
/** The animation clock and contact anchor are the only owners of walking motion. */
export class CharacterMotor {
	heading: WalkDirection = "left";
	walking = false;
	arrival?: {
		target: Point;
		anchor: Point;
		distance: number;
		halfStride: number;
		switchFrame: number;
	};
	anchor: Point = { x: 0, y: 0 };
	private pose?: FootPose;
	private foot: Foot = "L";
	private scale = 1;
	private elapsed = 0;
	private frameMs = 1000 / 24;
	private path: Point[] = [];
	private goal?: Point;
	private planned: PlannedStep<PredictedStance, FootPose>[] = [];
	private planDistance?: number;
	private resolve?: () => void;

	private recoverAfterStanding = false;
	private unmatchedCut = false;
	private lastCut?: {
		from: Point;
		to: Point;
		waitFrames: number;
		cycleFrames: number;
		matched: boolean;
	};
	private transition?: { to: FootPose; remaining: number; frame: number };
	private drawn?: {
		poses: FootPose[];
		resume?: FootPose;
		resumeFrameMs: number;
	};

	constructor(
		readonly target: MotorTarget,
		public area: WalkArea,
		private animate: (
			state: "walk" | "idle",
			heading: WalkDirection,
			rate: number,
		) => void,
		private animation: FootAnimation,
	) {
		target.motor?.detach();
		target.motor = this;
	}
	detach(): void {
		this.stop(true);
		if (this.target.motor === this) this.target.motor = undefined;
	}
	private finish(): void {
		this.walking = false;
		this.transition = undefined;
		this.drawn = undefined;
		if (this.recoverAfterStanding && this.pose) {
			this.recoverAfterStanding = false;
			// Both boots are now grounded. Transfer support without moving either
			// drawing, then leave the boundary pocket on the other foot.
			this.foot = this.foot === "L" ? "R" : "L";
			this.anchor = contactOnScreen(
				this.pose,
				this.foot,
				this.target,
				this.scale,
			);
			if (this.planStance(true)) {
				this.walking = true;
				this.animate("walk", this.heading, 1);
				return;
			}
		}
		this.animate("idle", this.heading, 1);
		const resolve = this.resolve;
		this.resolve = undefined;
		resolve?.();
	}
	/** Idle turns share the same sole anchor as walking arrivals. */
	face(heading: WalkDirection): void {
		this.heading = heading;
		this.stop();
	}
	facePoint(point: Point): void {
		const here = toMetres(this.area.perspective, this.target);
		const there = toMetres(this.area.perspective, point);
		this.face(
			headingFromGround(
				there.x - here.x,
				there.y - here.y,
				this.heading,
				here,
				0,
			),
		);
	}
	stop(immediate = false): void {
		this.planned = [];
		if (this.drawn && !immediate) {
			this.path = [];
			if (!this.drawn.resume) return;
			// A stop during reverse playback must settle back, not later resume walking.
			const idle = this.animation.standing?.(this.heading);
			const frames = idle?.cycle.settleFrames;
			const index = frames?.indexOf(this.pose?.frame ?? -1) ?? -1;
			if (idle && frames && index >= 0) {
				this.drawn = {
					poses: frames.slice(index + 1).map((frame) => ({ ...idle, frame })),
					resumeFrameMs: this.frameMs,
				};
				this.elapsed = 0;
				if (!this.drawn.poses.length) this.finish();
			}
			return;
		}
		if (immediate) {
			this.drawn = undefined;
			this.planned = [];
		}
		if (immediate) this.recoverAfterStanding = false;
		this.path = [];
		if (this.transition && !immediate) return;
		const standing = this.animation.standing?.(this.heading);
		if (
			this.pose &&
			standing &&
			!immediate &&
			(this.pose.cycle.name !== standing.cycle.name ||
				this.pose.flipX !== standing.flipX)
		) {
			const matched = this.nextExit(this.pose);
			if (!matched && this.pose.cycle.matchedCut) {
				// A blocked source frame is not permission to cut on another pose.
				// Keep the last safe drawing when no floor-safe approach exists.
				this.unmatchedCut = true;
				// Recovery may transfer support only after reaching a standing pose.
				// Here the other boot can still be in the air.
				this.recoverAfterStanding = false;
				this.finish();
				return;
			}
			const remaining = matched?.frames ?? 0;
			this.unmatchedCut = matched === undefined;
			this.transition = { to: standing, remaining, frame: 0 };
			if (remaining > 0) this.frameMs = this.cycleFrameMs(this.pose);
			// A just-reached exit needs its own visible interval. Accumulated
			// walking time must not immediately consume that drawing.
			if (remaining === 0 && this.pose.cycle.matchedCut) this.elapsed = 0;
			this.walking = true;
			return;
		}
		if (standing && this.pose && !immediate) {
			this.pose = standing;
			this.apply();
		}
		this.elapsed = 0;
		this.finish();
	}
	/** Simulate safe supports to the next generated exit, without changing the motor. */
	private nextExit(
		source: FootPose,
		state?: PredictedStance,
	):
		| {
				frames: number;
				position: Point & { scale: number };
				anchor: Point;
				foot: Foot;
		  }
		| undefined {
		// Search one full cycle, simulating every contact transfer.
		// A boundary may prohibit the preferred exit; never walk off-floor to reach it.
		let pose = source,
			foot = state?.foot ?? this.foot,
			anchor = state?.anchor ?? this.anchor;
		let position = {
			x: state?.end.x ?? this.target.x,
			y: state?.end.y ?? this.target.y,
			scale: state?.scale ?? this.scale,
		};
		const mask = this.area.clearanceMask ?? this.area.mask;
		const raw = this.area.rawMask ?? this.area.mask;
		const entry = lockedPlacement(
			anchor,
			source,
			foot,
			this.area.perspective,
			this.area.baseScale,
			this.area.scaleClamp,
			position.scale,
		);
		if (
			!raw.data[cellAt(raw, anchor)] ||
			!mask.data[cellAt(mask, { x: entry.x, y: anchor.y })] ||
			!lineOfSight(
				mask,
				{ x: position.x, y: anchor.y },
				{ x: entry.x, y: anchor.y },
			)
		)
			return;
		position = entry;

		for (let n = 0; n < pose.cycle.contacts.length; n++) {
			if (
				(pose.cycle.matchedCut?.exitFrames.includes(pose.frame) ?? true) &&
				this.canStand(pose, anchor, foot, position.scale)
			) {
				return { frames: n, position, anchor, foot };
			}
			const next = {
				...pose,
				frame: (pose.frame + 1) % pose.cycle.contacts.length,
			};
			const incoming = next.cycle.contacts[next.frame].planted;
			if (incoming !== foot) {
				anchor = contactOnScreen(pose, incoming, position, position.scale);
				foot = incoming;
			}
			const p = lockedPlacement(
				anchor,
				next,
				foot,
				this.area.perspective,
				this.area.baseScale,
				this.area.scaleClamp,
				position.scale,
			);
			if (
				!raw.data[cellAt(raw, anchor)] ||
				!mask.data[cellAt(mask, { x: p.x, y: anchor.y })] ||
				!lineOfSight(
					mask,
					{ x: position.x, y: anchor.y },
					{ x: p.x, y: anchor.y },
				)
			)
				break;
			pose = next;
			position = p;
		}
		return undefined;
	}

	place(position: Point, snapToFloor = true): void {
		// Teleport callers may have selected a fresh pose; do not restore the previous walk.
		this.stop(true);
		this.pose = undefined;
		const standing = this.animation.standing?.(this.heading);
		if (standing) this.animation.show(standing);
		const cell = nearestCell(this.area.mask, position);
		if (cell < 0) throw new Error("Walk area has no floor");
		const p = snapToFloor ? cellPoint(this.area.mask, cell) : position;
		this.target.setPosition(p.x, p.y);
		this.scale =
			this.area.baseScale *
			scaleAt(this.area.perspective, p, this.area.scaleClamp);
		this.target.setScale(this.scale);
		this.pose = this.animation.current();
		this.foot = this.pose.cycle.contacts[this.pose.frame].planted;
		this.anchor = contactOnScreen(this.pose, this.foot, p, this.scale);
		this.target.setDepth(10 + this.anchor.y / 20);
	}
	/** Spawn with the actual planted sole on a floor boundary, not the sprite origin. */
	placeContact(position: Point): void {
		this.place(position, false);
		this.anchor = { ...position };
		this.apply();
	}
	walk(
		points: readonly Point[],
		initialHeading?: WalkDirection,
	): Promise<void> {
		this.stop(true);
		this.arrival = undefined;
		this.lastCut = undefined;
		this.unmatchedCut = false;

		this.planned = [];
		this.goal = points[points.length - 1];
		if (!this.goal) return Promise.resolve();
		const hadPose = Boolean(this.pose);
		this.pose = this.animation.current();
		// A standing sheet supports both soles; retain the motor's actual support.
		if (!hadPose) this.foot = this.pose.cycle.contacts[this.pose.frame].planted;
		this.scale =
			this.area.baseScale *
			scaleAt(this.area.perspective, this.target, this.area.scaleClamp);
		this.anchor = contactOnScreen(
			this.pose,
			this.foot,
			this.target,
			this.scale,
		);
		const from = this.pose;
		this.buildPlan(initialHeading);
		if (!this.planStance(true, false, initialHeading)) {
			if (!this.animation.standing || !from) return Promise.resolve();
			// Standing is double support: if the held boot cannot start a safe
			// stride, try the other grounded boot without moving the sprite.
			this.stop(true);
			this.pose = from;
			this.foot = this.foot === "L" ? "R" : "L";
			this.anchor = contactOnScreen(from, this.foot, this.target, this.scale);
			this.buildPlan(initialHeading);
			if (!this.planStance(true, false, initialHeading))
				return Promise.resolve();
		}
		this.walking = true;
		this.animate("walk", this.heading, 1);
		const idle = this.animation.standing?.(this.heading);
		if (idle?.cycle.settleFrames?.length) {
			const resume = this.pose;
			// Planning has already selected the source entry and its physical support.
			// Apply the reverse drawings about that same anchor before advancing it.
			const poses = [...idle.cycle.settleFrames]
				.reverse()
				.map((frame) => ({ ...idle, frame }));
			this.pose = poses.shift() as FootPose;
			this.drawn = { poses, resume, resumeFrameMs: this.frameMs };
			this.elapsed = 0;
			this.apply();
		}
		this.animation.show(this.pose);

		return new Promise((resolve) => {
			this.resolve = resolve;
		});
	}
	private buildPlan(initialHeading?: WalkDirection): void {
		if (!this.pose || !this.goal) return;
		this.path = findPath(this.area.mask, this.target, this.goal).map((p) => ({
			x: p.x,
			y: p.y,
		}));
		this.goal = this.path[this.path.length - 1] ?? this.goal;
		const legs = walkLegs(this.path, this.area.perspective);
		if (initialHeading && legs[0]) {
			legs[0].heading = initialHeading;
			for (let i = 1; i < legs.length && !legs[i].corner; i++)
				legs[i].heading = initialHeading;
		}
		const initial: PredictedStance = {
			start: { x: this.target.x, y: this.target.y },
			end: { x: this.target.x, y: this.target.y },
			anchor: { ...this.anchor },
			foot: this.foot,
			pose: this.pose,
			scale: this.scale,
		};
		const result = planFootsteps(legs, initial, {
			position: (s) => s.end,
			headings: (leg) => {
				if (initialHeading && leg === legs[0]) return [initialHeading];
				const i = GROUND_SECTORS.indexOf(leg.heading);
				return [
					leg.heading,
					GROUND_SECTORS[(i + 7) % 8],
					GROUND_SECTORS[(i + 1) % 8],
				];
			},
			offset: (s, slide) => ({
				...s,
				anchor: { x: s.anchor.x + slide.x, y: s.anchor.y + slide.y },
				end: { x: s.end.x + slide.x, y: s.end.y + slide.y },
			}),
			entry: (s, direction, starting) => {
				const selected = this.animation.select(direction);
				const same =
					selected.cycle.name === s.pose.cycle.name &&
					selected.flipX === s.pose.flipX;
				const frames = same
					? [s.pose.frame]
					: starting
						? (selected.cycle.matchedCut?.entryFrames ??
							selected.cycle.switchFrames)
						: selected.cycle.switchFrames;
				return frames
					.filter(
						(f) =>
							selected.cycle.contacts[f].planted === s.foot &&
							selected.cycle.contacts[(f + 1) % selected.cycle.contacts.length]
								.planted === s.foot,
					)
					.map((frame) => ({ ...selected, frame }))
					.find(
						(p) =>
							this.predictStance(p, s) ||
							(!starting && this.animation.standing && this.nextExit(p, s)),
					);
			},
			advance: (s, pose) => this.predictStance(pose, s),
			rest: (s, pose, direction) => {
				const exit = this.nextExit(pose, s);
				if (!exit) return;
				const idle = this.animation.standing?.(direction);
				if (!idle) return exit.anchor;
				const rest = {
					...idle,
					frame:
						idle.cycle.settleFrames?.[idle.cycle.settleFrames.length - 1] ??
						idle.frame,
				};
				const placed = lockedPlacement(
					exit.anchor,
					rest,
					exit.foot,
					this.area.perspective,
					this.area.baseScale,
					this.area.scaleClamp,
					exit.position.scale,
				);
				return contactOnScreen(rest, exit.foot, placed, placed.scale);
			},
		});
		this.planned = result.steps;
		this.planDistance = result.distance;
	}
	/** Consume a prevalidated stance. Only a new click calls buildPlan. */
	private planStance(
		_starting = false,
		_turning = false,
		_initialHeading?: WalkDirection,
	): boolean {
		const step = this.planned.shift();
		if (!step) return false;
		this.anchor = {
			x: this.anchor.x + step.slide.x,
			y: this.anchor.y + step.slide.y,
		};
		this.pose = step.pose;
		this.heading = step.heading;
		let supportFrames = 1;
		while (
			supportFrames < step.pose.cycle.contacts.length &&
			step.pose.cycle.contacts[
				(step.pose.frame + supportFrames) % step.pose.cycle.contacts.length
			].planted === this.foot
		)
			supportFrames++;
		this.frameMs = Math.max(
			this.cycleFrameMs(step.pose),
			1000 / (2.2 * supportFrames),
		);
		this.apply();
		if (step.stop) {
			const exit = this.nextExit(step.pose);
			if (exit && this.goal) {
				const stride = this.predictStance(step.pose);
				const halfStride = stride
					? Math.hypot(
							stride.end.x - stride.start.x,
							stride.end.y - stride.start.y,
						) / 2
					: 2;
				this.arrival = {
					target: { ...this.goal },
					anchor: { ...exit.anchor },
					distance: Math.hypot(
						exit.anchor.x - this.goal.x,
						exit.anchor.y - this.goal.y,
					),
					halfStride: Math.max(2, halfStride),
					switchFrame: step.pose.frame,
				};
			}
			this.stop();
		}
		return true;
	}

	/** Resume the source cycle clock after a partial entry; its slower entry
	 * interval must not stretch every later support in a full-cycle exit. */
	private cycleFrameMs(pose: FootPose): number {
		const contacts = pose.cycle.contacts;
		const switches = pose.cycle.switchFrames;
		const lengths = switches.map(
			(frame, i) =>
				(switches[(i + 1) % switches.length] - frame + contacts.length) %
					contacts.length || contacts.length,
		);
		const foot = contacts[pose.frame].planted;
		let first = pose.frame;
		for (let n = 0; n < contacts.length - 1; n++) {
			const previous = (first + contacts.length - 1) % contacts.length;
			if (contacts[previous].planted !== foot) break;
			first = previous;
		}
		let count = 1;
		while (
			count < contacts.length &&
			contacts[(first + count) % contacts.length].planted === foot
		)
			count++;
		return stanceFrameMs(lengths, count, 2.2);
	}

	private canStand(
		pose: FootPose,
		anchor: Point,
		foot: Foot,
		scale: number,
	): boolean {
		if (!this.animation.standing) return true;
		const direction = GROUND_SECTORS.find((d) => {
			const selected = this.animation.select(d);
			return (
				selected.cycle.name === pose.cycle.name && selected.flipX === pose.flipX
			);
		});
		if (!direction) return true;
		const idle = this.animation.standing(direction);
		const raw = this.area.rawMask ?? this.area.mask;
		const poses = (idle.cycle.settleFrames ?? [idle.frame]).map((frame) => ({
			...idle,
			frame,
		}));
		return poses.every((rest, index) => {
			const placed = lockedPlacement(
				anchor,
				rest,
				foot,
				this.area.perspective,
				this.area.baseScale,
				this.area.scaleClamp,
				scale,
			);
			if (
				!raw.data[cellAt(raw, anchor)] ||
				!(this.area.clearanceMask ?? this.area.mask).data[
					cellAt(this.area.clearanceMask ?? this.area.mask, {
						x: placed.x,
						y: anchor.y,
					})
				]
			)
				return false;
			return (
				index < poses.length - 1 ||
				(["L", "R"] as const).every(
					(sole) =>
						raw.data[
							cellAt(raw, contactOnScreen(rest, sole, placed, placed.scale))
						] > 0,
				)
			);
		});
	}
	/** Validate every body frame and the next planted landing before committing a stance. */
	private predictStance(
		pose: FootPose,
		state?: PredictedStance,
	): PredictedStance | undefined {
		if (
			pose.cycle.contacts.some(
				(c) => c[c.planted].y < 0 || c[c.planted].y > pose.cycle.frameHeight,
			)
		)
			return;
		const anchor = state?.anchor ?? this.anchor,
			foot = state?.foot ?? this.foot;
		const raw = this.area.rawMask ?? this.area.mask;
		const on = (mask: typeof raw, p: Point) => mask.data[cellAt(mask, p)] > 0;
		if (!on(raw, anchor)) return;

		let current = pose,
			scale = state?.scale ?? this.scale;
		let position: Point = state?.end ?? this.target;
		let start: Point = position;
		for (let i = 0; i < pose.cycle.contacts.length; i++) {
			const p = lockedPlacement(
				anchor,
				current,
				foot,
				this.area.perspective,
				this.area.baseScale,
				this.area.scaleClamp,
				scale,
			);
			if (
				!on(this.area.clearanceMask ?? this.area.mask, {
					x: p.x,
					y: anchor.y,
				}) ||
				!lineOfSight(
					this.area.clearanceMask ?? this.area.mask,
					{ x: position.x, y: anchor.y },
					{ x: p.x, y: anchor.y },
				)
			)
				return;
			if (i === 0) start = p;
			position = p;
			scale = p.scale;
			const frame = (current.frame + 1) % pose.cycle.contacts.length;
			const incoming = pose.cycle.contacts[frame].planted;
			if (incoming !== foot) {
				const landing = contactOnScreen(current, incoming, position, scale);
				if (!on(raw, landing)) return;
				const end = lockedPlacement(
					landing,
					{ ...pose, frame },
					incoming,
					this.area.perspective,
					this.area.baseScale,
					this.area.scaleClamp,
					scale,
				);
				// The incoming cycle may change at this landing. Its old-cycle
				// first pose is not drawn if a turn is needed for body clearance.
				const nextBodySafe =
					on(this.area.clearanceMask ?? this.area.mask, {
						x: end.x,
						y: landing.y,
					}) &&
					lineOfSight(
						this.area.clearanceMask ?? this.area.mask,
						{ x: position.x, y: anchor.y },
						{ x: end.x, y: landing.y },
					);
				// Legacy cycles may stop at any landing. Matched cycles validate
				// standing only at their source frame through nextExit; the
				// opposite support is not a possible standing transition.
				if (
					!pose.cycle.matchedCut &&
					this.goal &&
					Math.hypot(end.x - this.goal.x, end.y - this.goal.y) < 200 &&
					!this.canStand(pose, landing, incoming, scale)
				)
					return;
				return {
					start,
					end: nextBodySafe ? end : position,
					anchor: landing,
					foot: incoming,
					pose: { ...pose, frame },
					scale: nextBodySafe ? end.scale : scale,
				};
			}
			current = { ...pose, frame };
		}
	}
	private apply(): void {
		if (!this.pose) return;
		const p = lockedPlacement(
			this.anchor,
			this.pose,
			this.foot,
			this.area.perspective,
			this.area.baseScale,
			this.area.scaleClamp,
			this.scale,
		);
		this.scale = p.scale;
		this.target.setPosition(p.x, p.y);
		this.target.setScale(p.scale);
		// The planted sole is the floor contact; sprite-origin bob must not
		// repeatedly flip occlusion while a foot is stationary.
		this.target.setDepth(10 + this.anchor.y / 20);
		this.animation.show(this.pose);
	}
	private atSwitch(passingOnly = false): boolean {
		if (passingOnly) return false;
		if (this.planStance()) return Boolean(this.transition);
		this.stop();
		return true;
	}
	update(delta: number): void {
		if (!this.walking || !this.pose || delta <= 0) return;
		this.elapsed += delta;
		if (this.drawn) {
			// Never skip a drawn pose even if the caller advances a large time step.
			if (this.elapsed + 1e-8 < 2000 / 24) return;
			this.elapsed = 0;
			const d = this.drawn;
			const next = d.poses.shift();
			if (next) {
				this.pose = next;
				this.apply();
				if (!d.poses.length && !d.resume) this.finish();
			} else if (d.resume) {
				this.pose = d.resume;
				this.frameMs = d.resumeFrameMs;
				this.drawn = undefined;
				this.apply();
			}
			return;
		}
		if (this.transition) {
			const t = this.transition;
			while (
				this.elapsed + 1e-8 >=
					(t.remaining === 0
						? Math.max(
								this.frameMs,
								(t.to.cycle.settleFrames ? 2000 : 1000) / 24,
							)
						: this.frameMs) &&
				this.transition &&
				this.pose
			) {
				this.elapsed -= this.frameMs;
				if (t.remaining === 0) {
					// A boundary recovery can enter the arrival window during its
					// safe exit approach. Measure that actual endpoint as well.
					if (!this.arrival && this.goal) this.atSwitch(true);
					const from = contactOnScreen(
						this.pose,
						this.foot,
						this.target,
						this.scale,
					);
					const cycleFrames = this.pose.cycle.contacts.length;
					this.pose = t.to;
					this.apply();
					this.lastCut = {
						from,
						to: contactOnScreen(this.pose, this.foot, this.target, this.scale),
						waitFrames: t.frame,
						cycleFrames,
						matched: !this.unmatchedCut,
					};
					const frames = t.to.cycle.settleFrames;
					if (frames && frames.length > 1) {
						const poses = frames.slice(1).map((frame) => ({ ...t.to, frame }));
						this.pose = poses.shift() as FootPose;
						this.drawn = { poses, resumeFrameMs: this.frameMs };
						this.transition = undefined;
						this.elapsed = 0;
						this.apply();
						if (!poses.length) this.finish();
					} else this.finish();
				} else {
					const next: FootPose = {
						...this.pose,
						frame: (this.pose.frame + 1) % this.pose.cycle.contacts.length,
					};
					const foot = next.cycle.contacts[next.frame].planted;
					if (foot !== this.foot) {
						this.anchor = contactOnScreen(
							this.pose,
							foot,
							this.target,
							this.scale,
						);
						this.foot = foot;
					}
					this.pose = next;
					this.frameMs = this.cycleFrameMs(next);
					t.remaining--;
					t.frame++;
					this.apply();
					// The selected exit must be rendered before the cut, even when
					// one output tick advances several source frames.
					if (t.remaining === 0) {
						this.elapsed = 0;
						break;
					}
				}
			}
			return;
		}
		while (this.walking && this.pose && this.elapsed + 1e-8 >= this.frameMs) {
			this.elapsed -= this.frameMs;
			const next: FootPose = {
				...this.pose,
				frame: (this.pose.frame + 1) % this.pose.cycle.contacts.length,
			};
			const foot = next.cycle.contacts[next.frame].planted;
			const switched = foot !== this.foot;

			if (switched) {
				// Capture the incoming sole before changing frames: transfer support without snapping.
				this.anchor = contactOnScreen(this.pose, foot, this.target, this.scale);
				this.foot = foot;
			}
			this.pose = next;
			if (switched) {
				if (this.atSwitch()) break;
			} else this.apply();
			// Request the next exit as soon as the goal enters the arrival window;
			// waiting until another support switch can miss that exit entirely.
			if (
				!switched &&
				(this.pose?.cycle.matchedCut ||
					this.pose?.cycle.passingFrames?.includes(this.pose.frame)) &&
				this.atSwitch(true)
			)
				break;
		}
	}
	snapshot() {
		return {
			ground: toMetres(this.area.perspective, this.target),
			plan: { remaining: this.planned.length, distance: this.planDistance },
			arrival: this.arrival,
			heading: this.heading,
			walking: this.walking,
			cut: this.lastCut,
			unmatchedCut: this.unmatchedCut,
			settling: Boolean(this.transition || (this.drawn && !this.drawn.resume)),
			drawn: this.drawn
				? {
						starting: Boolean(this.drawn.resume),
						remaining: this.drawn.poses.length,
					}
				: undefined,
			transition: this.transition
				? {
						frame: this.transition.frame,
						stopping: true,
						to: this.transition.to.cycle.name,
						remaining: this.transition.remaining,
					}
				: undefined,
			anchor: { ...this.anchor },
			planted: this.foot,
			frame: this.pose?.frame,
			cycle: this.pose?.cycle.name,
		};
	}
}
