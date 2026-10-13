import { cellAt, cellPoint, nearestCell } from "../walkarea/navigation";
import { type Point, scaleAt, toMetres } from "../walkarea/perspective";
import type { WalkArea } from "../walkarea/types";
import { clearanceRoute, routeCorners } from "./clearanceRoute";
import {
	contactOnScreen,
	type Foot,
	type FootPose,
	lockedPlacement,
} from "./footLock";
import {
	type PlannedStep,
	planFootsteps,
	type SearchOptions,
} from "./footstepPlan";
import { stanceSweep } from "./stanceSweep";
import { stanceFrameMs } from "./stanceTiming";
import {
	GROUND_SECTORS,
	headingFromGround,
	stanceFacesHeading,
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
	private pose?: FootPose;
	private foot: Foot = "L";
	private scale = 1;
	private elapsed = 0;
	private frameMs = 1000 / 24;
	private path: Point[] = [];
	private goal?: Point;
	private lastStrideLength = 0;
	private planned: PlannedStep<PredictedStance, FootPose>[] = [];
	private stanceCache = new Map<
		string,
		{
			samples: (Point & { scale: number })[];
			landing: Point;
			end: Point & { scale: number };
			frame: number;
			incoming: Foot;
		}
	>();
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
				anchor = contactOnScreen(pose, incoming, position, position.scale);
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
		_initialHeading?: WalkDirection,
	): Promise<void> {
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
		this.buildPlan();
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
		if (!this.planStance() || !this.pose) {
			this.finish();
			return;
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
	}
	private groundPoint(p: Point): Point {
		const perspective = this.area.perspective;
		if (perspective.constant === undefined) return toMetres(perspective, p);
		const ppm = (perspective.pixelsPerMetre ?? 300) * perspective.constant;
		return { x: p.x / ppm, y: -p.y / ppm };
	}
	/** Compare complete, physically simulated routes before admitting shorter phases. */
	private buildPlan(options: SearchOptions = {}) {
		this.stanceCache.clear();
		const initial = {
			pose: this.pose,
			foot: this.foot,
			anchor: { ...this.anchor },
			scale: this.scale,
			heading: this.heading,
			position: { x: this.target.x, y: this.target.y },
		};
		const makeTrial = () => {
			const target: MotorTarget = {
				...initial.position,
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
			trial.stanceCache = this.stanceCache;
			trial.pose = initial.pose;
			trial.foot = initial.foot;
			trial.anchor = { ...initial.anchor };
			trial.scale = initial.scale;
			trial.heading = initial.heading;
			trial.goal = this.goal;
			return trial;
		};
		let best = this.buildRoute(options);
		if (!best) return;
		const quality = (result: NonNullable<typeof best>) => {
			const trial = makeTrial();
			trial.planned = structuredClone(result.steps);
			const start = trial.planned[0]?.state;
			if (start) {
				trial.foot = start.foot;
				trial.anchor = { ...start.anchor };
			}
			trial.beginWalk();
			const runs: { heading: WalkDirection; count: number }[] = [];
			let stance:
				| { key: string; first: Point; last: Point; heading: WalkDirection }
				| undefined;
			let stances = 0,
				bad = 0;
			let first: Point | undefined, last: Point | undefined;
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
			for (let frame = 0; trial.walking && frame < 2400; frame++) {
				for (let i = 0; i < 3; i++) trial.update(1000 / 24 / 3);
				if (!trial.walking) break;
				const position = { x: trial.target.x, y: trial.target.y };
				first ??= position;
				last = position;
				if (trial.transition || trial.drawn) continue;
				const key = `${trial.heading}:${trial.foot}:${trial.anchor.x.toFixed(3)}:${trial.anchor.y.toFixed(3)}`;
				const ground = trial.groundPoint(position);
				if (stance?.key !== key) {
					finish();
					stance = { key, first: ground, last: ground, heading: trial.heading };
				} else stance.last = ground;
			}
			finish();
			const mask = this.area.clearanceMask ?? this.area.mask;
			const corners =
				first && last && mask.data[cellAt(mask, first)] && mask.data[cellAt(mask, last)]
					? routeCorners(
							clearanceRoute(
								this.area.clearanceMask ?? this.area.mask,
								first,
								last,
							),
						).length
					: 0;
			const clean =
				!trial.walking &&
				stances > 0 &&
				bad / stances <= 0.05 &&
				runs.length - 1 <= 2 + 2 * corners &&
				runs.slice(1, -1).every((r) => r.count >= 2) &&
				runs.every((r, i) => {
					if (!i) return true;
					const d = Math.abs(
						GROUND_SECTORS.indexOf(r.heading) -
							GROUND_SECTORS.indexOf(runs[i - 1].heading),
					);
					return Math.min(d, 8 - d) <= 2;
				});
			return {
				clean,
				boundarySafe:
					runs.length === 1 ||
					(runs[0]?.count >= 2 && runs[runs.length - 1]?.count >= 2),
				arrived:
					!!trial.arrival && trial.arrival.distance <= trial.arrival.halfStride,
			};
		};
		let accepted = quality(best);
		const totals = { ...best.stats, rejections: { ...best.stats.rejections } };
		const alternatives: SearchOptions[] = [
			{ entryPhases: "authored" },
			{ entryPhases: "all" },
			{ searchWeight: 4 },
			{ searchWeight: 4, entryPhases: "authored" },
			{ searchWeight: 4, entryPhases: "all" },
			{ stopWeight: 128, searchWeight: 4, entryPhases: "authored" },
			{ stopWeight: 128, searchWeight: 4, entryPhases: "all", startPhases: true },
			{ stopPhases: true, entryPhases: "authored", searchWeight: 4, stopWeight: 128 },
			{ stopPhases: true, entryPhases: "all", startPhases: true, searchWeight: 4, stopWeight: 128 },
		];
		for (const alternative of alternatives) {
			if (accepted.clean && accepted.arrived) break;
			const trial = makeTrial();
			const candidate = trial.buildRoute({ ...options, ...alternative });
			if (!candidate) continue;
			totals.expanded += candidate.stats.expanded;
			totals.generated += candidate.stats.generated;
			for (const [reason, count] of Object.entries(
				candidate.stats.rejections ?? {},
			))
				totals.rejections[reason] = (totals.rejections[reason] ?? 0) + count;
			const checked = quality(candidate);
			if (
				checked.clean &&
				(!accepted.clean || candidate.distance < best.distance)
			) {
				best = candidate;
				accepted = checked;
			}
		}
		best.stats = { ...totals, reason: best.stats.reason, optimal: false };
		this.planned = best.steps;
		const start = best.steps[0]?.state;
		if (start) {
			this.foot = start.foot;
			this.anchor = { ...start.anchor };
		}
		this.planDistance = best.distance;
		this.planComplete = best.complete;
		this.planSearch = best.stats;
		return best;
	}
	/** Plan bounded stand-and-pivot continuations before any playback begins. */
	private buildRoute(options: SearchOptions = {}) {
		const result = this.buildSegment(options);
		if (!result) return;
		const screenCorners = routeCorners(this.path);
		const shared = {
			...options,
			maxHeadingChanges: 2 + 2 * screenCorners.length,
			routeCorners: screenCorners.map((p) => this.groundPoint(p)),
			cornerHeadings: screenCorners.map((p) => {
				const i = this.path.indexOf(p),
					a = this.groundPoint(p),
					b = this.groundPoint(this.path[i + 1]);
				return headingFromGround(
					b.x - a.x,
					b.y - a.y,
					this.heading,
					this.area.perspective.constant === undefined ? a : undefined,
					0,
				);
			}),
		};
		let planner: CharacterMotor = this;
		let segment = result;
		for (let attempt = 0; attempt < 8 && !segment.complete; attempt++) {
			const last = segment.steps[segment.steps.length - 1];
			const first = segment.steps[0];
			if (!last || !first) break;
			const exit = planner.nextExit(last.pose, last.state, last.heading, true);
			const idle = this.animation.standing?.(last.heading);
			if (
				!exit ||
				!idle ||
				Math.hypot(
					exit.anchor.x - first.state.anchor.x,
					exit.anchor.y - first.state.anchor.y,
				) <= 0.5
			)
				break;
			const placed = lockedPlacement(
				exit.anchor,
				idle,
				exit.foot,
				this.area.perspective,
				this.area.baseScale,
				this.area.scaleClamp,
				exit.position.scale,
			);
			const target: MotorTarget = {
				...placed,
				setPosition(x, y) {
					this.x = x;
					this.y = y;
				},
				setScale() {},
				setDepth() {},
			};
			planner = new CharacterMotor(target, this.area, () => {}, this.animation);
			planner.stanceCache = this.stanceCache;
			planner.pose = idle;
			planner.anchor = { ...exit.anchor };
			planner.foot = exit.foot;
			planner.scale = placed.scale;
			planner.heading = last.heading;
			planner.goal = this.goal;
			const next = planner.buildSegment({
				...shared,
				initialRoute: segment.routeState,
			});
			if (!next) break;
			// Include rejected continuation searches as well as the accepted path.
			result.stats.expanded += next.stats.expanded;
			result.stats.generated += next.stats.generated;
			result.stats.optimal = false;
			result.stats.rejections ??= {};
			const rejections = result.stats.rejections;
			for (const [reason, count] of Object.entries(next.stats.rejections ?? {}))
				rejections[reason] = (rejections[reason] ?? 0) + count;
			if (!next.steps.length || next.distance >= segment.distance - 0.5) break;
			result.steps.push(...next.steps);
			result.distance = next.distance;
			result.complete = next.complete;
			result.arrivalKind = next.arrivalKind;
			result.stats.reason = next.stats.reason;
			segment = next;
		}
		this.planned = result.steps;
		this.planDistance = result.distance;
		this.planComplete = result.complete;
		this.planSearch = result.stats;
		return result;
	}
	private buildSegment(options: SearchOptions = {}) {
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
		this.path = clearanceRoute(mask, this.target, this.goal);
		const points = this.path.map((p) => this.groundPoint(p));
		const screenCorners = routeCorners(this.path);
		const corners = screenCorners.map((p) => this.groundPoint(p));
		const cornerHeadings = screenCorners.map((p) => {
			const i = this.path.indexOf(p),
				a = points[i],
				b = points[i + 1];
			return headingFromGround(
				b.x - a.x,
				b.y - a.y,
				this.heading,
				this.area.perspective.constant === undefined ? a : undefined,
				0,
			);
		});

		options = {
			...options,
			maxHeadingChanges: options.maxHeadingChanges ?? 2 + 2 * corners.length,
			routeCorners: options.routeCorners ?? corners,
			cornerHeadings: options.cornerHeadings ?? cornerHeadings,
			cornerRadius: 0.6,
			minHeadingRun: 2,
		};
		const route = this.path;
		const tail = route.map(() => 0);
		for (let i = route.length - 2; i >= 0; i--)
			tail[i] =
				tail[i + 1] +
				Math.hypot(
					points[i + 1].x - points[i].x,
					points[i + 1].y - points[i].y,
				);
		const remaining = (p: Point) => {
			const g = this.groundPoint(p);
			for (let i = route.length - 1; i >= 0; i--) {
				if (stanceSweep(this.area.clearanceMask ?? this.area.mask, p, route[i]))
					return Math.hypot(g.x - points[i].x, g.y - points[i].y) + tail[i];
			}
			return Math.hypot(g.x - points[0].x, g.y - points[0].y) + tail[0];
		};
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
		const entries = (
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
				if (options.entryPhases === "all" && (!starting || options.startPhases))
					frames.push(
						...selected.cycle.contacts
							.map((_, i) => i)
							.filter((f) => !frames.includes(f)),
					);
				return frames
					.filter(
						(f) =>
							selected.cycle.contacts[f].planted === s.foot &&
							selected.cycle.contacts[(f + 1) % selected.cycle.contacts.length]
								.planted === s.foot,
					)
					.map((frame) => ({ ...selected, frame, firstStance: starting }))
					.filter(
						(p) =>
							(stopping ||
								this.validFacing(
									p,
									s.anchor,
									s.foot,
									s.scale,
									direction,
									30,
								)) &&
							(!starting ||
								this.canStand(
									p,
									s.anchor,
									s.foot,
									s.scale,
									this.startingFloor(),
								)) &&
							(stopping || !!this.predictStance(p, s)),
					);
			};
			const pose = entry();
			if (!pose.length) count(stopping ? "stop-entry" : "entry");
			return pose;
		};
		const result = planFootsteps(
			this.goal,
			initial,
			{
				starts: (s) => {
					if (
						this.animation.standing?.(this.heading)?.cycle.name !==
						s.pose.cycle.name
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
							(idle.cycle.name === s.pose.cycle.name &&
								idle.flipX === s.pose.flipX)
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
									this.startingFloor(),
									true,
								)
							) {
								count("pivot");
								continue;
							}
							let via: FootPose | undefined;
							const previousSupport =
								s.pose.cycle.contacts[s.pose.frame].planted;
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
											this.startingFloor(),
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
				},
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
				entries: (s, h, starting, stopping) => entries(s, h, starting, stopping),
				entry: (s, h, starting, stopping) =>
					entries(s, h, starting, stopping)[0],
				advance: (s, pose) => {
					this.rejectionReason = "no-stance";
					const next = this.predictStance(pose, s);
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
				acceptRest: (s, pose, rest, target) => {
					const stride = this.predictStance(pose, s);
					return (
						!!stride &&
						Math.hypot(rest.x - target.x, rest.y - target.y) <=
							Math.hypot(
								stride.anchor.x - s.anchor.x,
								stride.anchor.y - s.anchor.y,
							) /
								2
					);
				},
				rest: (s, pose, heading) => {
					this.rejectionReason = "no-exit-frame";
					const exit = this.nextExit(pose, s, heading, true);
					if (!exit) count("rest");
					return exit ? { ...exit.anchor, travel: exit.travel } : undefined;
				},
			},
			options,
		);
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
		const result = motor.buildPlan();
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
		const nextStep = this.planned[0];
		if (!step.stop && nextStep)
			this.lastStrideLength = Math.hypot(
				nextStep.state.anchor.x - step.state.anchor.x,
				nextStep.state.anchor.y - step.state.anchor.y,
			);
		if (step.stop) {
			const exit = this.nextExit(step.pose, undefined, step.heading, true);
			if (exit && this.goal) {
				const halfStride = this.authoredHalfStride(step.heading, exit.anchor);
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
	private authoredHalfStride(heading: WalkDirection, anchor: Point): number {
		const selected = this.animation.select(heading);
		const frame =
			selected.cycle.switchFrames.find(
				(f) => selected.cycle.contacts[f].planted === this.foot,
			) ?? 0;
		const sampled = this.stanceSamples(
			{ ...selected, frame },
			anchor,
			this.foot,
			this.scale,
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

	/** Resume the source cycle clock after a partial entry; its slower entry
	 * interval must not stretch every later support in a full-cycle exit. */
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
		const direction = GROUND_SECTORS.find((d) => {
			const selected = this.animation.select(d);
			return (
				selected.cycle.name === pose.cycle.name && selected.flipX === pose.flipX
			);
		});
		if (!direction) return true;
		const idle = this.animation.standing(direction);
		if (!idle) return true;
		const poses = (
			standingOnly ? [idle.frame] : (idle.cycle.settleFrames ?? [idle.frame])
		).map((frame) => ({
			...idle,
			frame,
		}));
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
		const first = sampled.samples[0],
			last = sampled.samples[sampled.samples.length - 1];
		const valid = stanceFacesHeading(
			this.groundPoint({ x: first.x + shift, y: first.y }),
			this.groundPoint({ x: last.x + shift, y: last.y }),
			heading,
			this.area.perspective.constant === undefined,
			toleranceDegrees,
		);
		if (!valid) this.rejectionReason = "facing-invalid";
		return valid;
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
		const key = `${pose.cycle.name}:${pose.flipX}:${pose.frame}:${foot}:${originX}:${anchor.y}:${lateral ? scale : 0}`;
		const cached = this.stanceCache.get(key);
		if (cached) return cached;
		if (
			pose.cycle.contacts.some(
				(c) => c[c.planted].y < 0 || c[c.planted].y > pose.cycle.frameHeight,
			)
		)
			return;
		const origin = { x: originX, y: anchor.y };
		const samples: (Point & { scale: number })[] = [];
		let current = pose;
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
				if (this.stanceCache.size < 12000) this.stanceCache.set(key, result);
				return result;
			}
			current = { ...pose, frame };
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
		// While this foot is planted the body ground depth is constant. The union
		// of all per-frame swept intervals is exactly [minX,maxX], including entry.
		if (
			!on(mask, { x: minX, y: anchor.y }) ||
			!on(mask, { x: maxX, y: anchor.y })
		)
			return this.reject("body-off-clearance");
		if (!stanceSweep(mask, { x: minX, y: anchor.y }, { x: maxX, y: anchor.y }))
			return this.reject("swept-segment-blocked");
		const last = sampled.samples[sampled.samples.length - 1];
		const position = { ...last, x: last.x + shift };
		const landing = { ...sampled.landing, x: sampled.landing.x + shift };
		if (!this.soleFits(landing)) return;
		const end = { ...sampled.end, x: sampled.end.x + shift };
		const nextBodySafe =
			on(clearance, { x: end.x, y: landing.y }) &&
			stanceSweep(
				mask,
				{ x: position.x, y: anchor.y },
				{ x: end.x, y: landing.y },
			);
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
			if (this.elapsed + 1e-8 < 2000 / 24) return;
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
