import { clearanceDistance } from "../core/characters/clearanceDistance";
import {
	clearanceRoute,
	clearanceRouteQuery,
	routeCorners,
} from "../core/characters/clearanceRoute";
import {
	contactOnScreen,
	type Foot,
	type FootCycle,
	type FootPose,
	lockedPlacement,
} from "../core/characters/footLock";
import type {
	PlannedStep,
	SearchOptions,
} from "../core/characters/footstepPlan";
import { stanceSweep } from "../core/characters/stanceSweep";
import { stanceFrameMs } from "../core/characters/stanceTiming";
import { strideSweep } from "../core/characters/strideSweep";
import {
	GROUND_SECTORS,
	headingFromGround,
	stanceFacesHeading,
	type WalkDirection,
} from "../core/characters/walkHeading";
import { cellAt, cellPoint, nearestCell } from "../core/walkarea/navigation";
import { type Point, scaleAt, toMetres } from "../core/walkarea/perspective";
import type { WalkArea } from "../core/walkarea/types";
import { planFootsteps } from "./footstepPlan";

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
	standing?(direction: WalkDirection): FootPose | undefined;
}
interface PredictedStance {
	pivot?: { pose: FootPose; foot: Foot; anchor: Point; via?: FootPose };
	start: Point;
	end: Point;
	anchor: Point;
	foot: Foot;
	pose: FootPose;
	scale: number;
}
export interface MotorPlanRequest {
	allowPivotFinish?: boolean;
	area: WalkArea;
	position: Point;
	goal: Point;
	anchor: Point;
	foot: Foot;
	scale: number;
	heading: WalkDirection;
	pose: FootPose;
	cycles: Record<WalkDirection, Omit<FootPose, "frame">>;
	standing: Partial<Record<WalkDirection, FootPose>>;
}
/** The animation clock and contact anchor are the only owners of walking motion. */
interface StanceSamples {
	samples: (Point & { scale: number })[];
	landing: Point;
	end: Point & { scale: number };
	frame: number;
	incoming: Foot;
}

export class CharacterMotor {
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
	anchor: Point = { x: 0, y: 0 };
	private thresholdStart = false;
	private pose?: FootPose;
	private foot: Foot = "L";
	private scale = 1;
	private elapsed = 0;
	private frameMs = 1000 / 24;
	private path: Point[] = [];
	private goal?: Point;
	private lastStrideLength = 0;
	private planned: PlannedStep<PredictedStance, FootPose>[] = [];
	private cycleValidity = new WeakMap<FootCycle, boolean>();
	private standingPoseCache = new WeakMap<
		FootPose["cycle"],
		Map<string, FootPose[]>
	>();
	private stanceCache = new Map<string, StanceSamples>();
	private directStanceCache = new Map<
		FootCycle,
		Map<number, Map<number, StanceSamples>>
	>();
	private stanceCacheCount = { value: 0 };
	private planDistance?: number;
	private planComplete = false;
	private rejectionReason = "no-entry-frame";
	private reject(reason: string): undefined {
		this.rejectionReason = reason;
		return undefined;
	}
	private planSearch?: ReturnType<typeof planFootsteps>["stats"];
	private resolve?: () => void;
	private plannerWorker?: Worker;
	private pendingPlan = false;

	private unmatchedCut = false;
	private lastCut?: {
		from: Point;
		to: Point;
		waitFrames: number;
		cycleFrames: number;
		matched: boolean;
	};
	private absorption?: { delta: Point; frames: number; applied: number };
	private transition?: { to: FootPose; remaining: number; frame: number };
	private drawn?: {
		resumeStart?: PredictedStance;
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
		if (this.walking && this.planned.length) {
			const start = this.planned[0].state;
			this.foot = start.foot;
			this.anchor = { ...start.anchor };
			this.transition = undefined;
			this.drawn = undefined;
			this.beginWalk();
			return;
		}
		this.plannerWorker?.terminate();
		this.plannerWorker = undefined;
		this.pendingPlan = false;
		this.walking = false;
		this.transition = undefined;
		this.drawn = undefined;
		this.animate("idle", this.heading, 1);
		const resolve = this.resolve;
		this.resolve = undefined;
		resolve?.();
	}
	/** Idle turns share the same sole anchor as walking arrivals. */
	face(heading: WalkDirection): void {
		const idle = this.animation.standing?.(heading);
		if (!this.walking && this.pose && idle) {
			// Both boots are down at rest. Pivot on the support drawn by the
			// incoming settle, rather than locking its animated free boot.
			const foot = idle.cycle.contacts[idle.frame].planted;
			const anchor = contactOnScreen(this.pose, foot, this.target, this.scale);
			const selected = { ...this.animation.select(heading), frame: 0 };
			if (!this.canStand(selected, anchor, foot, this.scale)) return;
			this.foot = foot;
			this.anchor = anchor;
		}
		this.heading = heading;
		this.stop();
	}
	/** Resolves after the facing settle, so interactions can wait for the pose. */
	facePoint(point: Point): Promise<void> {
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
		if (!this.walking) return Promise.resolve();
		return new Promise<void>((resolve) => {
			const previous = this.resolve;
			this.resolve = () => {
				previous?.();
				resolve();
			};
		});
	}
	stop(immediate = false, absorb = false, heading?: WalkDirection): void {
		this.absorption = undefined;
		if (this.pendingPlan) {
			this.finish();
			return;
		}
		this.planned = [];
		if (this.drawn && !immediate) {
			this.path = [];
			if (this.drawn.resumeStart) {
				this.drawn.resumeStart = undefined;
				if (!this.drawn.poses.length) this.finish();
				return;
			}
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
			const matched = this.nextExit(this.pose, undefined, heading, absorb);
			if (matched?.absorption)
				this.absorption = { ...matched.absorption, applied: 0 };
			if (!matched && this.pose.cycle.matchedCut) {
				// A blocked source frame is not permission to cut on another pose.
				// Keep the last safe drawing when no floor-safe approach exists.
				this.unmatchedCut = true;
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
	/** Exact candidate exit anchors without collision work. Between support
	 * transfers the anchor cannot move; only transfer frames need placement. */
	private exitAnchors(source: FootPose, state: PredictedStance): Point[] {
		const candidates: Point[] = [];
		let pose = source,
			anchor = state.anchor,
			foot = state.foot,
			scale = state.scale;
		for (let n = 0; n < source.cycle.contacts.length; n++) {
			if (source.cycle.matchedCut?.exitFrames.includes(pose.frame) ?? true)
				candidates.push(anchor);
			const frame = (pose.frame + 1) % source.cycle.contacts.length;
			const incoming = source.cycle.contacts[frame].planted;
			if (incoming !== foot) {
				const placed = lockedPlacement(
					anchor,
					pose,
					foot,
					this.area.perspective,
					this.area.baseScale,
					this.area.scaleClamp,
					scale,
				);
				anchor = contactOnScreen(pose, incoming, placed, placed.scale);
				foot = incoming;
				scale = placed.scale;
			}
			pose = { ...source, frame };
		}
		return candidates;
	}
	/** Simulate safe supports to the next generated exit, without changing the motor. */
	private nextExit(
		source: FootPose,
		state?: PredictedStance,
		heading?: WalkDirection,
		absorb = false,
	):
		| {
				frames: number;
				absorption?: { delta: Point; frames: number };
				travel: number;
				position: Point & { scale: number };
				anchor: Point;
				foot: Foot;
		  }
		| undefined {
		let travel = 0;
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
		const entry = lockedPlacement(
			anchor,
			source,
			foot,
			this.area.perspective,
			this.area.baseScale,
			this.area.scaleClamp,
			position.scale,
		);
		if (!this.soleFits(anchor)) return;
		if (!mask.data[cellAt(mask, { x: entry.x, y: anchor.y })])
			return this.reject("body-off-clearance");
		if (
			!stanceSweep(
				mask,
				{ x: position.x, y: anchor.y },
				{ x: entry.x, y: anchor.y },
			)
		)
			return this.reject("swept-segment-blocked");
		position = entry;
		let stanceStart = this.groundPoint(entry);
		let samples: { pose: FootPose; position: Point & { scale: number } }[] = [
			{ pose, position },
		];
		const facing = () =>
			!heading ||
			stanceFacesHeading(
				stanceStart,
				this.groundPoint(position),
				heading,
				this.area.perspective.constant === undefined,
				30,
			);

		for (let n = 0; n < pose.cycle.contacts.length; n++) {
			if (
				(pose.cycle.matchedCut?.exitFrames.includes(pose.frame) ?? true) &&
				this.canStand(pose, anchor, foot, position.scale) &&
				facing()
			) {
				const absorption = absorb
					? this.stopAbsorption(samples, anchor, foot)
					: undefined;
				if (absorption) {
					anchor = {
						x: anchor.x + absorption.delta.x,
						y: anchor.y + absorption.delta.y,
					};
					position = lockedPlacement(
						anchor,
						pose,
						foot,
						this.area.perspective,
						this.area.baseScale,
						this.area.scaleClamp,
						position.scale,
					);
				}
				return { frames: n, position, anchor, foot, travel, absorption };
			}
			const next = {
				...pose,
				frame: (pose.frame + 1) % pose.cycle.contacts.length,
			};
			const incoming = next.cycle.contacts[next.frame].planted;
			const previousAnchorY = anchor.y;
			if (incoming !== foot) {
				if (!facing()) return this.reject("facing-invalid");
				const previous = this.groundPoint(anchor);
				const landing = contactOnScreen(
					pose,
					incoming,
					position,
					position.scale,
				);
				if (!strideSweep(this.area, [anchor, landing], []))
					return this.reject("sole-stride-blocked");
				anchor = landing;
				const nextGround = this.groundPoint(anchor);
				travel += Math.hypot(
					nextGround.x - previous.x,
					nextGround.y - previous.y,
				);
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
			if (!this.soleFits(anchor)) return;
			if (!mask.data[cellAt(mask, { x: p.x, y: anchor.y })])
				return this.reject("body-off-clearance");
			if (
				!stanceSweep(
					mask,
					{ x: position.x, y: previousAnchorY },
					{ x: p.x, y: anchor.y },
				)
			)
				return this.reject("swept-segment-blocked");
			if (incoming !== pose.cycle.contacts[pose.frame].planted) {
				stanceStart = this.groundPoint(p);
				samples = [];
			}
			pose = next;
			position = p;
			samples.push({ pose, position });
		}
		return undefined;
	}

	/** Only the final support may spend its slide budget, with a smooth ramp.
	 * Validate every corrected drawing and the complete settle before using it. */
	private stopAbsorption(
		samples: { pose: FootPose; position: Point & { scale: number } }[],
		anchor: Point,
		foot: Foot,
	) {
		if (!this.goal || samples.length < 3) return;
		const first = samples[0],
			last = samples[samples.length - 1];
		const bodyTravel = Math.hypot(
			last.position.x - first.position.x,
			last.position.y - first.position.y,
		);
		const distance = Math.hypot(this.goal.x - anchor.x, this.goal.y - anchor.y);
		const budget = Math.min(1.45, bodyTravel * 0.05);
		// Absorb only genuinely sub-stride error; never drift toward a remote goal.
		if (distance < 1e-8 || distance > budget) return;
		const delta = { x: this.goal.x - anchor.x, y: this.goal.y - anchor.y };
		const raw = this.area.rawMask ?? this.area.mask;
		const mask = this.area.clearanceMask ?? this.area.mask;
		let previous = first.position;
		for (let i = 0; i < samples.length; i++) {
			const t = i / (samples.length - 1),
				amount = t * t * (3 - 2 * t);
			const a = {
				x: anchor.x + delta.x * amount,
				y: anchor.y + delta.y * amount,
			};
			const sample = samples[i];
			const p = lockedPlacement(
				a,
				sample.pose,
				foot,
				this.area.perspective,
				this.area.baseScale,
				this.area.scaleClamp,
				sample.position.scale,
			);
			if (
				!raw.data[cellAt(raw, a)] ||
				!mask.data[cellAt(mask, { x: p.x, y: a.y })] ||
				!stanceSweep(mask, { x: previous.x, y: anchor.y }, { x: p.x, y: a.y })
			)
				return;
			previous = p;
		}
		const shifted = { x: anchor.x + delta.x, y: anchor.y + delta.y };
		if (!this.canStand(last.pose, shifted, foot, previous.scale)) return;
		return { delta, frames: samples.length - 1 };
	}

	place(position: Point, snapToFloor = true): void {
		this.thresholdStart = false;
		// Teleport callers may have selected a fresh pose; do not restore the previous walk.
		this.stop(true);
		this.pose = undefined;
		const standing = this.animation.standing?.(this.heading);
		if (standing) this.animation.show(standing);
		const cell = nearestCell(this.area.mask, position);
		if (cell < 0) throw new Error("Walk area has no floor");
		const p = snapToFloor
			? this.nearestStandable(cellPoint(this.area.mask, cell))
			: position;
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
	/** The nearest point where the standing pose fits with both soles on the floor
	 * (searched outward over the walk-area cells). A body point on the floor is not
	 * enough: in a narrow strip the soles can land off it, leaving no valid first step. */
	private nearestStandable(start: Point): Point {
		const pose = this.animation.current();
		const fits = (q: Point) => {
			const scale =
				this.area.baseScale *
				scaleAt(this.area.perspective, q, this.area.scaleClamp);
			// canStand only knows walk cycles; the placed pose is a standing one.
			return (["L", "R"] as const).every((sole) =>
				this.soleFits(contactOnScreen(pose, sole, q, scale)),
			);
		};
		if (fits(start)) return start;
		const mask = this.area.mask;
		const candidates: { q: Point; d: number }[] = [];
		for (let i = 0; i < mask.data.length; i++) {
			if (!mask.data[i]) continue;
			const q = cellPoint(mask, i);
			candidates.push({ q, d: Math.hypot(q.x - start.x, q.y - start.y) });
		}
		candidates.sort((a, b) => a.d - b.d);
		for (const { q } of candidates) if (fits(q)) return q;
		return start;
	}
	/** Spawn with the actual planted sole on a floor boundary, not the sprite origin. */
	placeContact(position: Point): void {
		this.place(position, false);
		this.thresholdStart = true;
		this.anchor = { ...position };
		this.apply();
	}
	/** A scene entrance needs an inward, planted stop, not an arbitrary extra
	 * turn to hit a screen-space offset. Find a supported single-heading finish
	 * near that offset before choosing the entrance's actual destination. */
	inwardStop(preferred: Point): Point | undefined {
		if (!this.pose) return;
		const target: MotorTarget = {
			x: this.target.x,
			y: this.target.y,
			setPosition(x, y) {
				this.x = x;
				this.y = y;
			},
			setScale() {},
			setDepth() {},
		};
		const pose = this.pose;
		const trial = new CharacterMotor(target, this.area, () => {}, {
			...this.animation,
			current: () => pose,
			show() {},
		});
		trial.pose = pose;
		trial.anchor = { ...this.anchor };
		trial.foot = this.foot;
		trial.scale = this.scale;
		trial.heading = this.heading;
		trial.goal = preferred;
		const plan = trial.buildSegment({ maxHeadingChanges: 0, costScale: 2 });
		const last = plan?.steps[plan.steps.length - 1];
		if (!last || (plan?.steps.length ?? 0) < 3) return;
		const exit = trial.nextExit(last.pose, last.state, last.heading, true);
		if (
			!exit ||
			Math.hypot(exit.anchor.x - this.anchor.x, exit.anchor.y - this.anchor.y) <
				200 ||
			Math.hypot(exit.anchor.x - preferred.x, exit.anchor.y - preferred.y) > 180
		)
			return;
		return exit.anchor;
	}
	walk(
		points: readonly Point[],
		_initialHeading?: WalkDirection,
	): Promise<void> {
		const allowPivotFinish = !this.thresholdStart;
		this.thresholdStart = false;
		this.stop(true);
		this.arrival = undefined;
		this.lastStrideLength = 0;
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
		if (typeof Worker !== "undefined") {
			const promise = new Promise<void>((resolve) => {
				this.resolve = resolve;
			});
			this.pendingPlan = true;
			// Planning owns the motion request too: observers must not treat
			// a doorway walk as idle before the worker returns.
			this.animate("walk", this.heading, 1);
			this.walking = false;
			this.planComplete = false;
			this.planSearch = undefined;
			const worker = new Worker(
				new URL("./footstep.worker.ts", import.meta.url),
				{ type: "module" },
			);
			this.plannerWorker = worker;
			worker.onmessage = (
				event: MessageEvent<ReturnType<typeof CharacterMotor.computePlan>>,
			) => {
				if (this.plannerWorker !== worker) return;
				worker.terminate();
				this.plannerWorker = undefined;
				this.pendingPlan = false;
				const result = event.data;
				this.path = result.path;
				this.goal = result.goal;
				this.planned = result.steps;
				this.planDistance = result.distance;
				this.planComplete = result.complete;
				this.planSearch = result.stats;
				const start = this.planned[0]?.state;
				if (start) {
					this.foot = start.foot;
					this.anchor = { ...start.anchor };
				}
				this.beginWalk();
			};
			worker.onerror = (event) => {
				console.error("Footstep worker failed", event.message);
				this.finish();
			};
			worker.postMessage({
				allowPivotFinish,
				area: this.area,
				position: { x: this.target.x, y: this.target.y },
				goal: this.goal,
				anchor: this.anchor,
				foot: this.foot,
				scale: this.scale,
				heading: this.heading,
				pose: this.pose,
				cycles: Object.fromEntries(
					GROUND_SECTORS.map((h) => [h, this.animation.select(h)]),
				) as MotorPlanRequest["cycles"],
				standing: Object.fromEntries(
					GROUND_SECTORS.map((h) => [h, this.animation.standing?.(h)]),
				),
			} satisfies MotorPlanRequest);
			return promise;
		}
		this.buildPlan({ pivotStops: allowPivotFinish ? undefined : false });
		const promise = new Promise<void>((resolve) => {
			this.resolve = resolve;
		});
		this.beginWalk();
		return promise;
	}
	private beginWalk(): void {
		const start = this.planned[0]?.state;
		if (start?.pivot) {
			const pivot = start.pivot;
			delete start.pivot;
			this.foot = pivot.foot;
			this.anchor = { ...pivot.anchor };
			const poses = [...(pivot.via ? [pivot.via] : []), pivot.pose];
			this.pose = poses.shift() as FootPose;
			this.drawn = { poses, resumeStart: start, resumeFrameMs: this.frameMs };
			this.walking = true;
			this.elapsed = 0;
			this.apply();
			this.animation.show(this.pose);
			return;
		}
		const stopping = this.planned[0]?.stop;
		if (!this.planStance() || !this.pose) {
			this.finish();
			return;
		}
		// A cycle without a standing animation can finish synchronously in
		// planStance. Do not restart its clock after that completed stop.
		if (stopping && !this.walking && !this.planned.length) return;
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
	}
	private groundPoint(p: Point): Point {
		const perspective = this.area.perspective;
		if (perspective.constant === undefined) return toMetres(perspective, p);
		const ppm = (perspective.pixelsPerMetre ?? 300) * perspective.constant;
		return { x: p.x / ppm, y: -p.y / ppm };
	}
	/** Compare complete, physically simulated routes before admitting shorter phases. */
	private buildPlan(options: SearchOptions = {}) {
		this.standingPoseCache = new WeakMap();
		this.stanceCache.clear();
		this.directStanceCache.clear();
		this.stanceCacheCount.value = 0;
		this.cycleValidity = new WeakMap();
		const alreadyAtTarget =
			!this.animation.standing &&
			this.goal &&
			Math.hypot(this.goal.x - this.anchor.x, this.goal.y - this.anchor.y) <=
				this.authoredHalfStride(this.heading, this.anchor);
		// Long lateral crossings need more stance choices. Reciprocal depth grows
		// without bound near the horizon, so it must not inflate the work budget.
		const from = this.groundPoint(this.anchor);
		const to = this.groundPoint(this.goal ?? this.anchor);
		const route = this.goal
			? clearanceRoute(
					this.area.clearanceMask ?? this.area.mask,
					this.target,
					this.goal,
				)
			: [];
		let lateralSpan = 0;
		for (let i = 1; i < route.length; i++)
			lateralSpan += Math.abs(
				this.groundPoint(route[i]).x - this.groundPoint(route[i - 1]).x,
			);
		const directSpan = Math.abs(to.x - from.x);
		const nodeBudget = Math.min(
			8000,
			Math.max(1600, Math.ceil(825 * directSpan)) +
				Math.ceil(800 * Math.max(0, lateralSpan - directSpan)) +
				Math.ceil(
					9 *
						Math.max(
							0,
							Math.abs((this.goal ?? this.anchor).y - this.anchor.y) - 100,
						),
				),
		);

		return this.buildSegment(
			{
				entryPhases: "all",
				startPhases: true,
				stopPhases: true,
				preferMotion: !alreadyAtTarget,
				firstArrival: !alreadyAtTarget,
				restartCost: 0.6,
				minRestartRun: 1,
				pivotStops: options.pivotStops !== false,
				minTerminalRun: 2,
				minFirstHeadingRun: options.pivotStops === false ? 2 : 0,
				searchWeight: 3,
				stopWeight: 128,
				costScale: 2,
				cornerRadius: 1.2,
				nodeBudget,
				resolution: 0.005,
				...options,
			},
			route,
		);
	}
	private buildSegment(options: SearchOptions = {}, route?: Point[]) {
		// Fixed work budget makes worker and Node route selection identical.
		// elapsedMs belongs to the virtual planning clock; measure wall time at
		// the caller, outside frame telemetry.
		options = {
			now: () => 0,
			timeBudgetMs: Infinity,
			nodeBudget: 12000,
			resolution: 0.005,
			stopWeight: 32,
			turnCost: 1.2,
			...options,
		};
		this.startMask = undefined;
		if (!this.pose || !this.goal) return;
		const mask = this.area.clearanceMask ?? this.area.mask;
		const goal = this.goal;
		options.goalHeadings = GROUND_SECTORS.filter((heading) => {
			const selected = this.animation.standing?.(heading);
			if (!selected) return false;
			const pose = { ...selected, frame: 0 };
			return (["L", "R"] as const).some((foot) => {
				const p = lockedPlacement(
					goal,
					pose,
					foot,
					this.area.perspective,
					this.area.baseScale,
					this.area.scaleClamp,
					this.area.baseScale,
				);
				return (
					!!mask.data[cellAt(mask, { x: p.x, y: goal.y })] &&
					(["L", "R"] as const).every((sole) =>
						this.soleFits(contactOnScreen(pose, sole, p, p.scale)),
					)
				);
			});
		});
		const goalCell = nearestCell(mask, this.goal);
		const standableGoal = goalCell < 0 ? this.goal : cellPoint(mask, goalCell);
		this.path = route ?? clearanceRoute(mask, this.target, this.goal);
		const screenCorners = routeCorners(this.path);
		const corners = screenCorners.map((p) => this.groundPoint(p));

		options = {
			...options,
			maxHeadingChanges: options.maxHeadingChanges ?? 2 + 2 * corners.length,
			routeCorners: options.routeCorners,
			cornerHeadings: options.cornerHeadings,
			cornerRadius: options.cornerRadius ?? 0.6,
			minHeadingRun: 2,
		};
		const remaining = clearanceDistance(mask, standableGoal, (p) =>
			this.groundPoint(p),
		);
		const initial: PredictedStance = {
			start: { x: this.target.x, y: this.target.y },
			end: { x: this.target.x, y: this.target.y },
			anchor: { ...this.anchor },
			foot: this.foot,
			pose: this.pose,
			scale: this.scale,
		};
		const rejections: Record<string, number> = {};
		const count = (action: string) => {
			const key = `${action}:${this.rejectionReason}`;
			rejections[key] = (rejections[key] ?? 0) + 1;
		};
		const predictionCache = new WeakMap<
			PredictedStance,
			Map<string, { value: PredictedStance | undefined; reason: string }>
		>();
		const exitCache = new WeakMap<
			PredictedStance,
			Map<
				string,
				{ value: ReturnType<CharacterMotor["nextExit"]>; reason: string }
			>
		>();
		const poseKey = (p: FootPose) =>
			`${p.cycle.name}:${p.flipX}:${p.frame}:${!!p.firstStance}`;
		const predict = (pose: FootPose, state: PredictedStance) => {
			let cache = predictionCache.get(state);
			if (!cache) {
				cache = new Map();
				predictionCache.set(state, cache);
			}
			const key = poseKey(pose),
				saved = cache.get(key);
			if (saved) {
				this.rejectionReason = saved.reason;
				return saved.value;
			}
			const value = this.predictStance(pose, state);
			cache.set(key, { value, reason: this.rejectionReason });
			return value;
		};
		const exitFor = (
			pose: FootPose,
			state: PredictedStance,
			heading: WalkDirection,
		) => {
			let cache = exitCache.get(state);
			if (!cache) {
				cache = new Map();
				exitCache.set(state, cache);
			}
			const key = `${poseKey(pose)}:${heading}`,
				saved = cache.get(key);
			if (saved) {
				this.rejectionReason = saved.reason;
				return saved.value;
			}
			const value = this.nextExit(pose, state, heading, true);
			cache.set(key, { value, reason: this.rejectionReason });
			return value;
		};
		const phaseCache = new WeakMap<
			FootPose["cycle"],
			Map<string, FootPose[]>
		>();
		const computeEntries = (
			s: PredictedStance,
			direction: WalkDirection,
			starting: boolean,
			stopping = false,
		): FootPose[] => {
			this.rejectionReason = "no-entry-frame";
			const entry = () => {
				const idle = this.animation.standing?.(direction);
				// Reverse settle must use the support actually drawn in the sheet.
				if (
					starting &&
					idle &&
					idle.cycle.contacts[idle.frame].planted !== s.foot
				)
					return [];
				const selected = this.animation.select(direction);
				const same =
					selected.cycle.name === s.pose.cycle.name &&
					selected.flipX === s.pose.flipX;
				let cyclePhases = phaseCache.get(selected.cycle);
				if (!cyclePhases) {
					cyclePhases = new Map();
					phaseCache.set(selected.cycle, cyclePhases);
				}
				const phaseKey = `${selected.flipX}:${same}:${s.pose.frame}:${s.foot}:${starting}`;
				let phases = cyclePhases.get(phaseKey);
				if (!phases) {
					const frames = same
						? options.entryPhases
							? [
									...new Set([
										s.pose.frame,
										...(selected.cycle.matchedCut?.entryFrames ?? []),
									]),
								]
							: [s.pose.frame]
						: [
								...(selected.cycle.matchedCut?.entryFrames ?? []),
								...selected.cycle.switchFrames,
							];
					if (
						options.entryPhases === "all" &&
						(!starting || options.startPhases)
					)
						frames.push(
							...selected.cycle.contacts
								.map((_, i) => i)
								.filter((f) => !frames.includes(f)),
						);
					phases = frames
						.filter(
							(f) =>
								selected.cycle.contacts[f].planted === s.foot &&
								selected.cycle.contacts[
									(f + 1) % selected.cycle.contacts.length
								].planted === s.foot,
						)
						.map((frame) => ({ ...selected, frame, firstStance: starting }));
					cyclePhases.set(phaseKey, phases);
				}
				return phases.filter(
					(p) =>
						(stopping ||
							this.validFacing(p, s.anchor, s.foot, s.scale, direction, 30)) &&
						(!starting ||
							this.canStand(
								p,
								s.anchor,
								s.foot,
								s.scale,
								this.startingFloor(),
							)) &&
						(stopping || !!predict(p, s)),
				);
			};
			const pose = entry();
			if (!pose.length) count(stopping ? "stop-entry" : "entry");
			return pose;
		};
		const entryCache = new WeakMap<
			PredictedStance,
			Map<string, { poses: FootPose[]; reason: string }>
		>();
		const entries = (
			state: PredictedStance,
			heading: WalkDirection,
			starting: boolean,
			stopping = false,
		) => {
			let cache = entryCache.get(state);
			if (!cache) {
				cache = new Map();
				entryCache.set(state, cache);
			}
			const key = `${heading}:${starting}:${stopping}`;
			const saved = cache.get(key);
			if (saved) {
				this.rejectionReason = saved.reason;
				if (!saved.poses.length) count(stopping ? "stop-entry" : "entry");
				return saved.poses;
			}
			const poses = computeEntries(state, heading, starting, stopping);
			cache.set(key, { poses, reason: this.rejectionReason });
			return poses;
		};
		const starts = (
			s: PredictedStance,
			startMask = this.startingFloor(),
		): PredictedStance[] => {
			if (
				!GROUND_SECTORS.some(
					(h) => this.animation.standing?.(h)?.cycle.name === s.pose.cycle.name,
				)
			)
				return [];
			const foot: Foot = s.foot === "L" ? "R" : "L";
			const starts: PredictedStance[] = [
				{
					...s,
					foot,
					anchor: contactOnScreen(s.pose, foot, s.end, s.scale),
				},
			];
			for (const direction of GROUND_SECTORS) {
				const idle = this.animation.standing?.(direction);
				if (
					!idle ||
					(idle.cycle.name === s.pose.cycle.name && idle.flipX === s.pose.flipX)
				)
					continue;
				for (const support of ["L", "R"] as const) {
					const anchor = contactOnScreen(s.pose, support, s.end, s.scale);
					if (
						!this.canStand(
							{ ...this.animation.select(direction), frame: 0 },
							anchor,
							support,
							s.scale,
							startMask,
							true,
						)
					) {
						count("pivot");
						continue;
					}
					let via: FootPose | undefined;
					const previousSupport = s.pose.cycle.contacts[s.pose.frame].planted;
					if (
						support !== previousSupport &&
						idle.cycle.contacts[idle.frame].planted === previousSupport
					) {
						// Show the weight transfer before pivoting the old drawn support.
						for (const heading of GROUND_SECTORS) {
							const candidate = this.animation.standing?.(heading);
							if (
								candidate?.cycle.contacts[candidate.frame].planted ===
									support &&
								this.canStand(
									{ ...this.animation.select(heading), frame: 0 },
									anchor,
									support,
									s.scale,
									startMask,
									true,
								)
							) {
								via = candidate;
								break;
							}
						}
						if (!via) continue;
					}
					const end = lockedPlacement(
						anchor,
						idle,
						support,
						this.area.perspective,
						this.area.baseScale,
						this.area.scaleClamp,
						s.scale,
					);
					for (const foot of ["L", "R"] as const)
						starts.push({
							...s,
							end,
							pose: idle,
							scale: end.scale,
							foot,
							anchor: contactOnScreen(idle, foot, end, end.scale),
							pivot: { pose: idle, foot: support, anchor, via },
						});
				}
			}
			return starts;
		};
		const standingCache = new Map<string, PredictedStance[]>();
		const restExits = new WeakMap<
			Point,
			NonNullable<ReturnType<CharacterMotor["nextExit"]>>
		>();
		const routeBudgetCache = new Map<string, number>();
		const qualityRoute = clearanceRouteQuery(
			this.area.clearanceMask ?? this.area.mask,
		);
		const qualityInitial = {
			pose: this.pose,
			foot: this.foot,
			anchor: { ...this.anchor },
			scale: this.scale,
			heading: this.heading,
			position: { x: this.target.x, y: this.target.y },
		};
		const makeTrial = () => {
			const target: MotorTarget = {
				...qualityInitial.position,
				setPosition(x, y) {
					this.x = x;
					this.y = y;
				},
				setScale() {},
				setDepth() {},
			};
			const trial = new CharacterMotor(target, this.area, () => {}, {
				...this.animation,
				show() {},
			});
			trial.standingPoseCache = this.standingPoseCache;
			trial.stanceCache = this.stanceCache;
			trial.directStanceCache = this.directStanceCache;
			trial.stanceCacheCount = this.stanceCacheCount;
			trial.cycleValidity = this.cycleValidity;
			trial.pose = qualityInitial.pose;
			trial.foot = qualityInitial.foot;
			trial.anchor = { ...qualityInitial.anchor };
			trial.scale = qualityInitial.scale;
			trial.heading = qualityInitial.heading;
			trial.goal = this.goal;
			return trial;
		};
		const startLimits = new WeakMap<PredictedStance, Map<string, boolean>>();
		const initialStarts = starts(initial);
		const captureInside = (
			state: PredictedStance,
			pose: FootPose,
			heading: WalkDirection,
		) => {
			let limits = startLimits.get(state);
			if (!limits) {
				limits = new Map();
				startLimits.set(state, limits);
			}
			// At the first capture a pivot may already resume the reverse start.
			// Only a via-pose keeps that sample independent of the next heading.
			const idle = this.animation.standing?.(heading);
			const closedFormSettle =
				idle &&
				!this.area.perspective.residual?.length &&
				(this.area.perspective.constant !== undefined ||
					1 +
						this.area.baseScale *
							this.area.perspective.slope *
							(idle.cycle.contacts[idle.frame][state.foot].y -
								idle.cycle.frameHeight) >
						0);
			const key = state.pivot?.via
				? "pivot-via"
				: closedFormSettle && idle.cycle.settleFrames?.length
					? `settle:${heading}`
					: `${poseKey(pose)}:${heading}`;
			const saved = limits.get(key);
			if (saved !== undefined) {
				return saved;
			}
			const trial = makeTrial();
			trial.foot = state.foot;
			trial.anchor = { ...state.anchor };
			trial.planned = [
				{
					state: { ...state },
					pose,
					heading,
					stop: false,
					slide: { x: 0, y: 0 },
				},
			];
			trial.beginWalk();
			for (let i = 0; i < 3; i++) trial.update(1000 / 24 / 3);
			const inside = !!mask.data[cellAt(mask, trial.target)];
			limits.set(key, inside);
			return inside;
		};
		const qualityReasons = new Map<string, number>();
		const qualityIds = new WeakMap<object, number>();
		let nextQualityId = 0;
		const qualityId = (value: object) => {
			let id = qualityIds.get(value);
			if (id === undefined) {
				id = ++nextQualityId;
				qualityIds.set(value, id);
			}
			return id;
		};
		const qualityCache = new Map<
			string,
			{
				clean: boolean;
				issues: string;
				maxJumpSquared: number;
				terminal: string;
			}
		>();
		type QualityStance = {
			key: string;
			first: Point;
			last: Point;
			heading: WalkDirection;
		};
		const copyTrial = (source: CharacterMotor) => {
			const copy = makeTrial();
			copy.target.setPosition(source.target.x, source.target.y);
			copy.pose = source.pose;
			copy.foot = source.foot;
			copy.anchor = { ...source.anchor };
			copy.scale = source.scale;
			copy.heading = source.heading;
			copy.walking = source.walking;
			copy.elapsed = source.elapsed;
			copy.frameMs = source.frameMs;
			copy.lastStrideLength = source.lastStrideLength;
			copy.unmatchedCut = source.unmatchedCut;
			copy.arrival = source.arrival;
			copy.lastCut = source.lastCut;
			copy.absorption = source.absorption && {
				...source.absorption,
				delta: { ...source.absorption.delta },
			};
			copy.transition = source.transition && { ...source.transition };
			copy.drawn = source.drawn && {
				...source.drawn,
				poses: [...source.drawn.poses],
			};
			return copy;
		};
		const prefixes = new Map<
			string,
			{
				trial: CharacterMotor;
				consumed: number;
				frame: number;
				runs: { heading: WalkDirection; count: number }[];
				stance?: QualityStance;
				stances: number;
				bad: number;
				first?: Point;
				last?: Point;
				maxJumpSquared: number;
			}
		>();
		const quality = (steps: PlannedStep<PredictedStance, FootPose>[]) => {
			// Search nodes are immutable. Include every playback field and exact
			// state/cycle identity; only identical complete candidates share results.
			const stepSignatures = steps.map(
				(step) =>
					`${qualityId(step.state)}:${qualityId(step.pose.cycle)}:${poseKey(step.pose)}:${step.heading}:${step.arrivalHeading}:${step.stop}:${step.slide.x}:${step.slide.y}`,
			);
			const prefixKeys: string[] = [];
			for (const signature of stepSignatures)
				prefixKeys.push(
					prefixKeys.length
						? `${prefixKeys[prefixKeys.length - 1]};${signature}`
						: signature,
				);
			const signature = prefixKeys[prefixKeys.length - 1] ?? "";
			const saved = qualityCache.get(signature);
			if (saved) {
				if (!saved.clean)
					qualityReasons.set(
						saved.issues,
						(qualityReasons.get(saved.issues) ?? 0) + 1,
					);
				return {
					clean: saved.clean,
					maxJumpSquared: saved.maxJumpSquared,
					terminal: saved.terminal,
				};
			}
			// The consumed prefix observes only the next anchor for stride length.
			// Its future pose is not played until after restoring the checkpoint.
			const checkpointKey = (consumed: number) => {
				const next = steps[consumed].state.anchor;
				return `${prefixKeys[consumed - 1]};next-anchor:${next.x}:${next.y}`;
			};
			let checkpoint:
				| (typeof prefixes extends Map<string, infer V> ? V : never)
				| undefined;
			for (let i = steps.length - 1; i >= 1; i--) {
				checkpoint = prefixes.get(checkpointKey(i));
				if (checkpoint) break;
			}
			const trial = checkpoint ? copyTrial(checkpoint.trial) : makeTrial();
			trial.planned = steps.slice(checkpoint?.consumed ?? 0).map((step) => ({
				...step,
				state: { ...step.state },
				slide: { ...step.slide },
			}));
			const start = trial.planned[0]?.state;
			if (start && !checkpoint) {
				trial.foot = start.foot;
				trial.anchor = { ...start.anchor };
			}
			if (!checkpoint) trial.beginWalk();
			const runs = checkpoint?.runs.map((run) => ({ ...run })) ?? [];
			let stance: QualityStance | undefined = checkpoint?.stance && {
				...checkpoint.stance,
			};
			let stances = checkpoint?.stances ?? 0,
				bad = checkpoint?.bad ?? 0;
			let first = checkpoint?.first,
				last = checkpoint?.last;
			let maxJumpSquared = checkpoint?.maxJumpSquared ?? 0;
			let consumed = checkpoint?.consumed ?? 0;
			const finish = () => {
				if (
					!stance ||
					Math.hypot(
						stance.last.x - stance.first.x,
						stance.last.y - stance.first.y,
					) < 0.05
				)
					return;
				stances++;
				if (
					!stanceFacesHeading(
						stance.first,
						stance.last,
						stance.heading,
						this.area.perspective.constant === undefined,
					)
				)
					bad++;
				const run = runs[runs.length - 1];
				if (run?.heading === stance.heading) run.count++;
				else runs.push({ heading: stance.heading, count: 1 });
			};
			for (
				let frame = checkpoint ? checkpoint.frame + 1 : 0;
				trial.walking && frame < 2400;
				frame++
			) {
				for (let i = 0; i < 3; i++) trial.update(1000 / 24 / 3);
				if (!trial.walking) break;
				const position = { x: trial.target.x, y: trial.target.y };
				if (last) {
					const dx = position.x - last.x,
						dy = position.y - last.y;
					maxJumpSquared = Math.max(maxJumpSquared, dx * dx + dy * dy);
				}
				first ??= position;
				last = position;
				if (!trial.transition && !trial.drawn) {
					const key = `${trial.heading}:${trial.foot}:${trial.anchor.x.toFixed(3)}:${trial.anchor.y.toFixed(3)}`;
					const ground = trial.groundPoint(position);
					if (stance?.key !== key) {
						finish();
						stance = {
							key,
							first: ground,
							last: ground,
							heading: trial.heading,
						};
					} else stance.last = ground;
				}
				const nextConsumed = steps.length - trial.planned.length;
				// planStance reads one following step for stride length. Include that
				// lookahead in the exact key before sharing any capture-clock state.
				if (
					nextConsumed !== consumed &&
					nextConsumed >= 1 &&
					trial.planned.length >= 1
				) {
					const key = checkpointKey(nextConsumed);
					if (!prefixes.has(key)) {
						if (prefixes.size >= 2048) prefixes.clear();
						prefixes.set(key, {
							trial: copyTrial(trial),
							consumed: nextConsumed,
							frame,
							runs: runs.map((run) => ({ ...run })),
							stance: stance && { ...stance },
							stances,
							bad,
							first,
							last,
							maxJumpSquared,
						});
					}
				}
				consumed = nextConsumed;
			}
			finish();
			const mask = this.area.clearanceMask ?? this.area.mask;
			const cornerKey = `${first ? cellAt(mask, first) : -1}:${last ? cellAt(mask, last) : -1}`;
			let corners = routeBudgetCache.get(cornerKey);
			if (corners === undefined) {
				corners =
					first &&
					last &&
					mask.data[cellAt(mask, first)] &&
					mask.data[cellAt(mask, last)]
						? routeCorners(qualityRoute(first, last)).length
						: 0;
				routeBudgetCache.set(cornerKey, corners);
			}
			const clean =
				!trial.walking &&
				stances > 0 &&
				bad / stances <= 0.05 &&
				runs.length - 1 <= 2 + 2 * corners &&
				runs.slice(1, -1).every((r) => r.count >= 2) &&
				(runs.length < 2 ||
					((runs[runs.length - 1]?.count ?? 0) >=
						(options.minTerminalRun ?? 0) &&
						runs[0].count >= (options.minFirstHeadingRun ?? 0))) &&
				runs.every((r, i) => {
					if (!i) return true;
					const d = Math.abs(
						GROUND_SECTORS.indexOf(r.heading) -
							GROUND_SECTORS.indexOf(runs[i - 1].heading),
					);
					return Math.min(d, 8 - d) <= 2;
				});
			const issues =
				[
					trial.walking ? "unfinished" : "",
					!stances ? "no-motion" : "",
					bad / Math.max(stances, 1) > 0.05 ? "angle" : "",
					runs.length - 1 > 2 + 2 * corners ? "changes" : "",
					runs.slice(1, -1).some((r) => r.count < 2) ? "flicker" : "",
				]
					.filter(Boolean)
					.join("+") || "other";
			if (!clean) {
				qualityReasons.set(issues, (qualityReasons.get(issues) ?? 0) + 1);
			}
			if (qualityCache.size >= 8192) qualityCache.clear();
			const terminal = JSON.stringify({
				x: trial.target.x,
				y: trial.target.y,
				scale: trial.scale,
				foot: trial.foot,
				anchor: trial.anchor,
				arrival: trial.arrival,
			});
			qualityCache.set(signature, { clean, issues, maxJumpSquared, terminal });
			return { clean, maxJumpSquared, terminal };
		};
		let lastAssessedSteps: PlannedStep<PredictedStance, FootPose>[] | undefined;
		let lastAssessment: ReturnType<typeof quality> | undefined;
		const assess = (steps: PlannedStep<PredictedStance, FootPose>[]) => {
			if (lastAssessedSteps !== steps || !lastAssessment) {
				lastAssessment = quality(steps);
				lastAssessedSteps = steps;
			}
			return lastAssessment;
		};
		options.layeredFrontier = !mask.data[cellAt(mask, qualityInitial.position)];
		const result = planFootsteps<PredictedStance, FootPose>(
			this.goal,
			initial,
			{
				startTurnLimit: (state, pose, heading) => {
					if (captureInside(state, pose, heading))
						return options.maxHeadingChanges ?? Infinity;
					// A boundary drawing has the verifier's zero-corner budget.
					// Do not discard its valid route just because another start
					// draws inside clearance; full playback still validates facing.
					return 2;
				},
				acceptPlan: (steps) => assess(steps).clean,
				finishRank: (steps) => assess(steps).maxJumpSquared,
				starts: (state) => (state === initial ? initialStarts : starts(state)),
				offset: (s, slide) => ({
					...s,
					anchor: { x: s.anchor.x + slide.x, y: s.anchor.y + slide.y },
					end: { x: s.end.x + slide.x, y: s.end.y + slide.y },
				}),
				position: (s) => s.anchor,
				ground: (p) => this.groundPoint(p),
				remaining,
				support: (s) =>
					`${s.foot}:${s.pose.cycle.name}:${s.pose.flipX}:${s.pose.frame}`,
				entries: (s, h, starting, stopping) =>
					entries(s, h, starting, stopping),
				entry: (s, h, starting, stopping) =>
					entries(s, h, starting, stopping)[0],
				continueFromRest: (state, pose, heading, rest) => {
					if (predict(pose, state)) return [];
					const exit = restExits.get(rest),
						idle = this.animation.standing?.(heading);
					if (!exit || !idle) return [];
					const key = `${heading}:${exit.foot}:${exit.anchor.x}:${exit.anchor.y}:${this.area.perspective.residual?.length ? exit.position.scale : 0}`;
					const cached = standingCache.get(key);
					if (cached) return cached;
					const end = lockedPlacement(
						exit.anchor,
						idle,
						exit.foot,
						this.area.perspective,
						this.area.baseScale,
						this.area.scaleClamp,
						exit.position.scale,
					);
					const standing: PredictedStance = {
						...state,
						start: end,
						end,
						pose: idle,
						foot: exit.foot,
						anchor: exit.anchor,
						scale: end.scale,
						pivot: undefined,
					};
					// Mid-route pivots must not inherit the spawn boundary exemption.
					const choices = [standing, ...starts(standing, mask)];
					standingCache.set(key, choices);
					return choices;
				},
				stanceKey: (state, _pose, heading) =>
					`${heading}:${state.foot}:${state.anchor.x.toFixed(3)}:${state.anchor.y.toFixed(3)}`,
				countStance: (s, pose) => {
					const samples = this.stanceSamples(pose, s.anchor, s.foot, s.scale);
					if (!samples) return false;
					const shift = this.area.perspective.residual?.length ? 0 : s.anchor.x;
					const first = samples.samples[0];
					const last = samples.samples[samples.samples.length - 1];
					const a = this.groundPoint({ x: first.x + shift, y: first.y });
					const b = this.groundPoint({ x: last.x + shift, y: last.y });
					return Math.hypot(b.x - a.x, b.y - a.y) >= 0.05;
				},
				advance: (s, pose) => {
					this.rejectionReason = "no-stance";
					const next = predict(pose, s);
					if (!next) count("advance");
					return next;
				},
				restCandidates: (s, pose) => {
					const candidates = this.exitAnchors(pose, s);
					const goal = this.goal;
					if (
						goal &&
						candidates.some(
							(p) => Math.hypot(p.x - goal.x, p.y - goal.y) <= 1.45,
						)
					)
						candidates.push(goal);
					return candidates;
				},
				acceptRest: (s, pose, rest, target, heading) => {
					const entry = lockedPlacement(
						s.anchor,
						pose,
						s.foot,
						this.area.perspective,
						this.area.baseScale,
						this.area.scaleClamp,
						s.scale,
					);
					const half = this.authoredHalfStride(
						heading,
						rest,
						s.foot,
						entry.scale,
					);
					return (
						Math.max(
							Math.hypot(rest.x - target.x, rest.y - target.y),
							Math.hypot(rest.x - standableGoal.x, rest.y - standableGoal.y),
						) <= half
					);
				},
				rest: (s, pose, heading) => {
					this.rejectionReason = "no-exit-frame";
					const exit = exitFor(pose, s, heading);
					if (!exit) count("rest");
					if (!exit) return;
					const rest = {
						...exit.anchor,
						travel: exit.travel,
						body: exit.position,
						stances: 0,
						supports: [],
					};
					restExits.set(rest, exit);
					return rest;
				},
			},
			options,
		);
		// Refine intermediate stance entry drawings, retaining their exact
		// landing support, complete terminal state and every subsequent route edge.
		// This is not a search retry: full playback must remain clean and its
		// worst jump must shrink.
		let selectedQuality: ReturnType<typeof quality> | undefined;
		for (let i = 1; i + 1 < result.steps.length; i++) {
			const step = result.steps[i];
			if (step.pose.firstStance || step.slide.x || step.slide.y) continue;
			const refinementExit = (pose: FootPose) => {
				if (step.stop) return exitFor(pose, step.state, step.heading);
				const next = predict(pose, step.state);
				return next
					? {
							foot: next.foot,
							anchor: next.anchor,
							position: { ...next.end, scale: next.scale },
						}
					: undefined;
			};
			const originalExit = refinementExit(step.pose);
			if (!originalExit) continue;
			const entryJump = (pose: FootPose) => {
				const p = lockedPlacement(
					step.state.anchor,
					pose,
					step.state.foot,
					this.area.perspective,
					this.area.baseScale,
					this.area.scaleClamp,
					step.state.scale,
				);
				const dx = p.x - step.state.end.x,
					dy = p.y - step.state.end.y;
				return dx * dx + dy * dy;
			};
			const originalJump = entryJump(step.pose);
			for (const pose of entries(step.state, step.heading, false, step.stop)) {
				if (
					pose.cycle !== step.pose.cycle ||
					pose.flipX !== step.pose.flipX ||
					pose.frame === step.pose.frame
				)
					continue;
				if (entryJump(pose) >= originalJump) continue;
				const exit = refinementExit(pose);
				if (
					!exit ||
					exit.foot !== originalExit.foot ||
					Math.abs(exit.anchor.x - originalExit.anchor.x) > 1e-8 ||
					Math.abs(exit.anchor.y - originalExit.anchor.y) > 1e-8 ||
					Math.abs(exit.position.scale - originalExit.position.scale) > 1e-8 ||
					Math.abs(exit.position.x - originalExit.position.x) > 1e-8 ||
					Math.abs(exit.position.y - originalExit.position.y) > 1e-8
				)
					continue;
				selectedQuality ??= quality(result.steps);
				const candidate = result.steps.map((s, j) =>
					j === i ? { ...s, pose } : s,
				);
				const assessment = quality(candidate);
				if (
					assessment.clean &&
					assessment.terminal === selectedQuality.terminal &&
					assessment.maxJumpSquared < selectedQuality.maxJumpSquared
				) {
					result.steps = candidate;
					selectedQuality = assessment;
					break;
				}
			}
		}
		for (const [reason, count] of qualityReasons)
			rejections[`quality:${reason}`] = count;
		Object.assign(result.stats.rejections, rejections);
		this.planned = result.steps;
		const start = result.steps[0]?.state;
		if (start) {
			this.foot = start.foot;
			this.anchor = { ...start.anchor };
		}
		this.planDistance = result.distance;
		this.planSearch = result.stats;
		this.planComplete = result.complete;
		if (!result.complete || result.stats.reason.endsWith("budget"))
			console.warn("Footstep search partial/budget", result.stats, {
				target: this.goal,
				distance: result.distance,
				complete: result.complete,
			});
		return result;
	}
	/** Worker entry: only data and the exact production simulator, no Phaser. */
	static computePlan(request: MotorPlanRequest) {
		const target: MotorTarget = {
			...request.position,
			setPosition(x, y) {
				this.x = x;
				this.y = y;
			},
			setScale() {},
			setDepth() {},
		};
		const motor = new CharacterMotor(target, request.area, () => {}, {
			current: () => request.pose,
			select: (h) => request.cycles[h],
			show: () => {},
			standing: (h) => request.standing[h],
		});
		motor.pose = request.pose;
		motor.goal = request.goal;
		motor.anchor = request.anchor;
		motor.foot = request.foot;
		motor.scale = request.scale;
		motor.heading = request.heading;
		const result = motor.buildPlan({
			pivotStops: request.allowPivotFinish === false ? false : undefined,
		});
		if (!result) throw new Error("Missing planning state");
		return { ...result, path: motor.path, goal: motor.goal };
	}
	/** Consume a prevalidated stance. Only a new click calls buildPlan. */
	private planStance(): boolean {
		const step = this.planned.shift();
		if (!step) return false;
		this.anchor = {
			x: this.anchor.x + step.slide.x,
			y: this.anchor.y + step.slide.y,
		};
		this.pose = step.pose;
		this.heading = step.heading;
		// A late entry keeps its full support clock; its remaining drawings must
		// not be stretched over the duration of an entire step.
		const contacts = step.pose.cycle.contacts;
		let supportStart = step.pose.frame;
		if (contacts[supportStart].planted === this.foot) {
			for (let n = 0; n < contacts.length - 1; n++) {
				const previous = (supportStart + contacts.length - 1) % contacts.length;
				if (contacts[previous].planted !== this.foot) break;
				supportStart = previous;
			}
		}
		let supportFrames = 1;
		while (
			supportFrames < contacts.length &&
			contacts[(supportStart + supportFrames) % contacts.length].planted ===
				this.foot
		)
			supportFrames++;
		// Dense cycles can redistribute time among supports at natural cadence.
		// Sparse cycles still need held frames to avoid an implausible step rate.
		const denseCycle =
			contacts.length / step.pose.cycle.switchFrames.length >= 24 / 2.2;
		this.frameMs = denseCycle
			? this.cycleFrameMs(step.pose)
			: Math.max(this.cycleFrameMs(step.pose), 1000 / (2.2 * supportFrames));
		this.apply();
		const nextStep = this.planned[0];
		if (!step.stop && nextStep)
			this.lastStrideLength = Math.hypot(
				nextStep.state.anchor.x - step.state.anchor.x,
				nextStep.state.anchor.y - step.state.anchor.y,
			);
		if (step.stop) {
			const exit = this.nextExit(step.pose, undefined, step.heading, true);
			if (exit && this.goal) {
				const halfStride = this.authoredHalfStride(
					step.arrivalHeading ?? step.heading,
					exit.anchor,
				);
				this.arrival = {
					target: { ...this.goal },
					anchor: { ...exit.anchor },
					distance: Math.hypot(
						exit.anchor.x - this.goal.x,
						exit.anchor.y - this.goal.y,
					),
					halfStride,
					switchFrame: step.pose.frame,
					exactDistance: Math.hypot(
						exit.anchor.x - (exit.absorption?.delta.x ?? 0) - this.goal.x,
						exit.anchor.y - (exit.absorption?.delta.y ?? 0) - this.goal.y,
					),
					absorbedDistance: exit.absorption
						? Math.hypot(exit.absorption.delta.x, exit.absorption.delta.y)
						: 0,
				};
			}
			const remaining = this.planned;
			this.stop(false, true, step.heading);
			this.planned = remaining;
		}
		return true;
	}

	/** Measure a full authored support interval, even when its landing is blocked.
	 * An exit fragment and collision feasibility are not stride measurements. */
	private authoredHalfStride(
		heading: WalkDirection,
		anchor: Point,
		foot = this.foot,
		scale = this.scale,
	): number {
		const selected = this.animation.select(heading);
		const frame =
			selected.cycle.switchFrames.find(
				(f) => selected.cycle.contacts[f].planted === foot,
			) ?? 0;
		const sampled = this.stanceSamples(
			{ ...selected, frame },
			anchor,
			foot,
			scale,
		);
		if (!sampled) return this.lastStrideLength / 2;
		const shift = this.area.perspective.residual?.length ? 0 : anchor.x;
		return (
			Math.hypot(
				sampled.landing.x + shift - anchor.x,
				sampled.landing.y - anchor.y,
			) / 2
		);
	}

	/** Use the source support clock even when an entry begins midway through it. */
	private cycleFrameMs(pose: FootPose): number {
		const authored = pose.cycle.frameDurationsMs?.[pose.frame];
		if (authored !== undefined) return authored;
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
		mask = this.area.clearanceMask ?? this.area.mask,
		standingOnly = false,
	): boolean {
		this.rejectionReason = "settle-does-not-fit";
		if (!this.animation.standing) return true;
		let byCycle = this.standingPoseCache.get(pose.cycle);
		if (!byCycle) {
			byCycle = new Map();
			this.standingPoseCache.set(pose.cycle, byCycle);
		}
		const key = `${pose.flipX}:${standingOnly}`;
		let poses = byCycle.get(key);
		if (!poses) {
			const direction = GROUND_SECTORS.find((d) => {
				const selected = this.animation.select(d);
				return (
					selected.cycle.name === pose.cycle.name &&
					selected.flipX === pose.flipX
				);
			});
			const idle = direction && this.animation.standing(direction);
			poses = idle
				? (standingOnly
						? [idle.frame]
						: (idle.cycle.settleFrames ?? [idle.frame])
					).map((frame) => ({ ...idle, frame }))
				: [];
			byCycle.set(key, poses);
		}
		let previous: Point | undefined;
		return poses.every((rest) => {
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
				!this.soleFits(anchor) ||
				!mask.data[
					cellAt(mask, {
						x: placed.x,
						y: anchor.y,
					})
				]
			)
				return false;
			const body = { x: placed.x, y: anchor.y };
			if (previous && !stanceSweep(mask, previous, body)) return false;
			previous = body;
			return (["L", "R"] as const).every((sole) =>
				this.soleFits(contactOnScreen(rest, sole, placed, placed.scale)),
			);
		});
	}
	private startMask?: WalkArea["mask"];
	/** At rest the real soles define floor support. The first body's projection
	 * may straddle a floor/caption boundary; props remain solid and its landing
	 * must enter normal clearance. This is never used for later stances. */
	private startingFloor() {
		if (this.startMask) return this.startMask;
		const raw = this.area.rawMask ?? this.area.mask;
		const objects = this.area.objectFootprints;
		this.startMask = {
			...raw,
			data: raw.data.map((_, i) =>
				objects?.data[cellAt(objects, cellPoint(raw, i))] ? 0 : 1,
			),
		};
		return this.startMask;
	}
	/** Boots use raw floor, never the body erosion, and may not land on props. */
	private soleFits(point: Point): boolean {
		const raw = this.area.rawMask ?? this.area.mask;
		if (!raw.data[cellAt(raw, point)]) {
			this.rejectionReason = "sole-off-floor";
			return false;
		}
		const objects = this.area.objectFootprints;
		if (objects?.data[cellAt(objects, point)]) {
			this.rejectionReason = "sole-on-object-footprint";
			return false;
		}
		return true;
	}
	private validFacing(
		pose: FootPose,
		anchor: Point,
		foot: Foot,
		scale: number,
		heading: WalkDirection,
		toleranceDegrees = 30,
	): boolean {
		const sampled = this.stanceSamples(pose, anchor, foot, scale);
		if (!sampled) return false;
		const shift = this.area.perspective.residual?.length ? 0 : anchor.x;
		const lastIndex = sampled.samples.length - 1;
		const endPoints = [lastIndex, Math.max(0, lastIndex - 1)].map((i) => {
			const p = sampled.samples[i];
			return this.groundPoint({ x: p.x + shift, y: p.y });
		});
		// Capture can omit either boundary drawing of a support interval.
		// Every such sampled stance must obey the same facing tolerance.
		for (
			let first = 0;
			first <= Math.min(1, sampled.samples.length - 1);
			first++
		) {
			const a = sampled.samples[first];
			const startPoint = this.groundPoint({ x: a.x + shift, y: a.y });
			for (
				let last = sampled.samples.length - 1;
				last >= Math.max(first, sampled.samples.length - 2);
				last--
			) {
				if (
					!stanceFacesHeading(
						startPoint,
						endPoints[lastIndex - last],
						heading,
						this.area.perspective.constant === undefined,
						toleranceDegrees,
					)
				) {
					this.rejectionReason = "facing-invalid";
					return false;
				}
			}
		}
		return true;
	}
	/** Cache exact-depth sheet simulation independently of scene collisions.
	 * No quantised displacement reaches playback. Without lateral residuals,
	 * translation in x is exact, so all supports at a depth share the samples. */
	private stanceSamples(
		pose: FootPose,
		anchor: Point,
		foot: Foot,
		scale: number,
	) {
		const lateral = Boolean(this.area.perspective.residual?.length);
		const originX = lateral ? anchor.x : 0;
		const key = lateral
			? `${pose.cycle.name}:${pose.flipX}:${pose.frame}:${foot}:${originX}:${anchor.y}:${scale}`
			: "";
		const phase =
			pose.frame * 4 + (pose.flipX ? 2 : 0) + (foot === "R" ? 1 : 0);
		let phases = this.directStanceCache.get(pose.cycle);
		let depths = phases?.get(phase);
		const cached = lateral ? this.stanceCache.get(key) : depths?.get(anchor.y);
		if (cached) return cached;
		let valid = this.cycleValidity.get(pose.cycle);
		if (valid === undefined) {
			valid = !pose.cycle.contacts.some(
				(c) => c[c.planted].y < 0 || c[c.planted].y > pose.cycle.frameHeight,
			);
			this.cycleValidity.set(pose.cycle, valid);
		}
		if (!valid) return;
		const origin = { x: originX, y: anchor.y };
		const samples: (Point & { scale: number })[] = [];
		const current = { ...pose };
		for (let i = 0; i < pose.cycle.contacts.length; i++) {
			const p = lockedPlacement(
				origin,
				current,
				foot,
				this.area.perspective,
				this.area.baseScale,
				this.area.scaleClamp,
				scale,
			);
			samples.push(p);
			scale = p.scale;
			const frame = (current.frame + 1) % pose.cycle.contacts.length;
			const incoming = pose.cycle.contacts[frame].planted;
			if (incoming !== foot) {
				const landing = contactOnScreen(current, incoming, p, scale);
				const end = lockedPlacement(
					landing,
					{ ...pose, frame },
					incoming,
					this.area.perspective,
					this.area.baseScale,
					this.area.scaleClamp,
					scale,
				);
				const result = { samples, landing, end, frame, incoming };
				// Keep caching later search depths once the bounded working set fills.
				if (this.stanceCacheCount.value >= 12000) {
					this.stanceCache.clear();
					this.directStanceCache.clear();
					this.stanceCacheCount.value = 0;
					phases = undefined;
					depths = undefined;
				}
				if (lateral) this.stanceCache.set(key, result);
				else {
					if (!phases) {
						phases = new Map();
						this.directStanceCache.set(pose.cycle, phases);
					}
					if (!depths) {
						depths = new Map();
						phases.set(phase, depths);
					}
					depths.set(anchor.y, result);
				}
				this.stanceCacheCount.value++;
				return result;
			}
			current.frame = frame;
		}
	}
	/** Validate the planted and landing soles, every body sample and swept segment. */
	private predictStance(
		pose: FootPose,
		state?: PredictedStance,
	): PredictedStance | undefined {
		const anchor = state?.anchor ?? this.anchor,
			foot = state?.foot ?? this.foot;
		const raw = this.area.rawMask ?? this.area.mask,
			clearance = this.area.clearanceMask ?? this.area.mask;
		const mask = pose.firstStance ? this.startingFloor() : clearance;
		const on = (m: typeof raw, p: Point) => m.data[cellAt(m, p)] > 0;
		if (!this.soleFits(anchor)) return;
		const sampled = this.stanceSamples(
			pose,
			anchor,
			foot,
			state?.scale ?? this.scale,
		);
		if (!sampled) return this.reject("no-stance");
		const shift = this.area.perspective.residual?.length ? 0 : anchor.x;
		const previous = pose.firstStance
			? { x: sampled.samples[0].x + shift, y: anchor.y }
			: (state?.end ?? this.target);
		let minX = previous.x,
			maxX = previous.x;
		for (const p of sampled.samples) {
			minX = Math.min(minX, p.x + shift);
			maxX = Math.max(maxX, p.x + shift);
		}
		const last = sampled.samples[sampled.samples.length - 1];
		const position = { ...last, x: last.x + shift };
		const landing = { ...sampled.landing, x: sampled.landing.x + shift };
		if (!this.soleFits(landing)) return;
		if (!strideSweep(this.area, [anchor, landing], []))
			return this.reject("sole-stride-blocked");
		const end = { ...sampled.end, x: sampled.end.x + shift };
		const bodyStart = { x: minX, y: anchor.y };
		const bodyEnd = { x: maxX, y: anchor.y };
		const bodySafe = stanceSweep(mask, bodyStart, bodyEnd);
		let nextBodySafe =
			on(clearance, { x: end.x, y: landing.y }) &&
			stanceSweep(
				mask,
				{ x: position.x, y: anchor.y },
				{ x: end.x, y: landing.y },
			);
		// Keep raw soles and solid props. A complete stance may bridge a narrow
		// unsupported interval; its body still needs clearance everywhere else.
		if (!bodySafe || !nextBodySafe) {
			const gapSafe = strideSweep(
				this.area,
				[anchor, landing],
				[
					{ x: previous.x, y: anchor.y },
					...sampled.samples.map((p) => ({ x: p.x + shift, y: anchor.y })),
					{ x: end.x, y: landing.y },
				],
			);
			if (gapSafe) nextBodySafe = true;
			else if (!bodySafe) return this.reject("swept-segment-blocked");
		}
		if (mask !== clearance && !nextBodySafe)
			return this.reject("boundary-start-not-inward");
		const scale = last.scale;
		if (
			!pose.cycle.matchedCut &&
			this.goal &&
			Math.hypot(end.x - this.goal.x, end.y - this.goal.y) < 200 &&
			!this.canStand(pose, landing, sampled.incoming, scale)
		)
			return;
		return {
			start: { ...sampled.samples[0], x: sampled.samples[0].x + shift },
			end: nextBodySafe ? end : position,
			anchor: landing,
			foot: sampled.incoming,
			pose: { ...pose, frame: sampled.frame, firstStance: false },
			scale: nextBodySafe ? end.scale : scale,
		};
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
		if (!this.walking || this.pendingPlan || !this.pose || delta <= 0) return;
		this.elapsed += delta;
		if (this.drawn) {
			// Never skip a drawn pose even if the caller advances a large time step.
			if (this.elapsed + 1e-8 < 1000 / 24) return;
			this.elapsed = 0;
			const d = this.drawn;
			const next = d.poses.shift();
			if (next) {
				this.pose = next;
				this.apply();
				if (!d.poses.length && !d.resume && !d.resumeStart) this.finish();
			} else if (d.resumeStart) {
				this.foot = d.resumeStart.foot;
				this.anchor = { ...d.resumeStart.anchor };
				this.drawn = undefined;
				this.beginWalk();
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
						? Math.max(this.frameMs, 1000 / 24)
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
					const absorption = this.absorption;
					if (absorption && t.remaining < absorption.frames) {
						const progress = 1 - t.remaining / absorption.frames,
							amount = progress * progress * (3 - 2 * progress);
						this.anchor = {
							x:
								this.anchor.x +
								absorption.delta.x * (amount - absorption.applied),
							y:
								this.anchor.y +
								absorption.delta.y * (amount - absorption.applied),
						};
						absorption.applied = amount;
					}
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
			plan: {
				pending: this.pendingPlan,
				remaining: this.planned.length,
				distance: this.planDistance,
				search: this.planSearch,
				complete: this.planComplete,
			},
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
