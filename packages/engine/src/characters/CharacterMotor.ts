import {
	cellAt,
	cellPoint,
	findPath,
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
	stop(immediate = false, absorb = false): void {
		this.absorption = undefined;
		if (this.pendingPlan) {
			this.finish();
			return;
		}
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
			const matched = this.nextExit(this.pose, undefined, undefined, absorb);
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
		let firstStance = source.firstStance ?? false;
		const facing = (last = false) =>
			!heading ||
			stanceFacesHeading(
				stanceStart,
				this.groundPoint(position),
				heading,
				this.area.perspective.constant === undefined,
				firstStance || last ? 35 : 30,
			);

		for (let n = 0; n < pose.cycle.contacts.length; n++) {
			if (
				(pose.cycle.matchedCut?.exitFrames.includes(pose.frame) ?? true) &&
				this.canStand(pose, anchor, foot, position.scale) &&
				facing(true)
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
				firstStance = false;
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
	private buildPlan(options: SearchOptions = {}) {
		// Fixed work budget makes worker and Node route selection identical.
		// elapsedMs belongs to the virtual planning clock; measure wall time at
		// the caller, outside frame telemetry.
		options = {
			now: () => 0,
			timeBudgetMs: Infinity,
			nodeBudget: 4000,
			resolution: 0.005,
			stopWeight: 32,
			turnCost: 1.2,
			...options,
		};
		this.stanceCache.clear();
		if (!this.pose || !this.goal) return;
		this.path = findPath(this.area.mask, this.target, this.goal).map((p) => ({
			x: p.x,
			y: p.y,
		}));
		this.goal = this.path[this.path.length - 1] ?? this.goal;
		const points = this.path.map((p) => this.groundPoint(p));
		let corners = 0;
		for (let i = 1; i + 1 < points.length; i++) {
			const a = points[i - 1],
				b = points[i],
				c = points[i + 1];
			const turn =
				Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(b.y - a.y, b.x - a.x);
			if (
				Math.abs(Math.atan2(Math.sin(turn), Math.cos(turn))) >
				(25 * Math.PI) / 180
			)
				corners++;
		}
		options = {
			...options,
			maxHeadingChanges: 1 + 2 * corners,
			minHeadingRun: 2,
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
					return [
						{
							...s,
							foot,
							anchor: contactOnScreen(s.pose, foot, s.end, s.scale),
						},
					];
				},
				offset: (s, slide) => ({
					...s,
					anchor: { x: s.anchor.x + slide.x, y: s.anchor.y + slide.y },
					end: { x: s.end.x + slide.x, y: s.end.y + slide.y },
				}),
				position: (s) => s.anchor,
				ground: (p) => this.groundPoint(p),
				support: (s) => `${s.foot}:${s.pose.frame}`,
				entry: (s, direction, starting, stopping) => {
					this.rejectionReason = "no-entry-frame";
					const entry = () => {
						const idle = this.animation.standing?.(direction);
						// Reverse settle must use the support actually drawn in the sheet.
						if (
							starting &&
							idle &&
							idle.cycle.contacts[idle.frame].planted !== s.foot
						)
							return;
						const selected = this.animation.select(direction);
						const same =
							selected.cycle.name === s.pose.cycle.name &&
							selected.flipX === s.pose.flipX;
						const frames = same
							? [s.pose.frame]
							: starting
								? [
										...(selected.cycle.matchedCut?.entryFrames ?? []),
										...selected.cycle.switchFrames,
									]
								: selected.cycle.switchFrames;
						return frames
							.filter(
								(f) =>
									selected.cycle.contacts[f].planted === s.foot &&
									selected.cycle.contacts[
										(f + 1) % selected.cycle.contacts.length
									].planted === s.foot,
							)
							.map((frame) => ({ ...selected, frame, firstStance: starting }))
							.find(
								(p) =>
									(stopping ||
										this.validFacing(
											p,
											s.anchor,
											s.foot,
											s.scale,
											direction,
											starting ? 35 : 30,
										)) &&
									(!starting ||
										this.canStand(
											p,
											s.anchor,
											s.foot,
											s.scale,
											this.startingClearance({ x: s.end.x, y: s.anchor.y }),
										)) &&
									(stopping || !!this.predictStance(p, s)),
							);
					};
					const pose = entry();
					if (!pose) count(stopping ? "stop-entry" : "entry");
					return pose;
				},
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
			const exit = this.nextExit(step.pose, undefined, undefined, true);
			if (exit && this.goal) {
				const stride = this.predictStance(step.pose);
				const halfStride = stride
					? Math.hypot(
							stride.anchor.x - this.anchor.x,
							stride.anchor.y - this.anchor.y,
						) / 2
					: this.lastStrideLength / 2;
				this.arrival = {
					target: { ...this.goal },
					anchor: { ...exit.anchor },
					distance: Math.hypot(
						exit.anchor.x - this.goal.x,
						exit.anchor.y - this.goal.y,
					),
					halfStride: Math.max(2, halfStride),
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
			this.stop(false, true);
		}
		return true;
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
		const poses = (idle.cycle.settleFrames ?? [idle.frame]).map((frame) => ({
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
	/** A marginal spawn may leave its one boundary cell, but cannot cross a
	 * second blocked cell or stop there. Sole and object checks stay strict. */
	private startingClearance(point: Point) {
		const mask = this.area.clearanceMask ?? this.area.mask;
		const i = cellAt(mask, point);
		if (i < 0 || mask.data[i] || !this.soleFits(point)) return mask;
		const x = i % mask.width,
			y = Math.floor(i / mask.width);
		const adjacent = [
			[x - 1, y],
			[x + 1, y],
			[x, y - 1],
			[x, y + 1],
		].some(
			([cx, cy]) =>
				cx >= 0 &&
				cy >= 0 &&
				cx < mask.width &&
				cy < mask.height &&
				mask.data[cy * mask.width + cx],
		);
		if (!adjacent) return mask;
		const data = mask.data.slice();
		data[i] = 1;
		return { ...mask, data };
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
		const mask = pose.firstStance
			? this.startingClearance({
					x: state?.end.x ?? this.target.x,
					y: anchor.y,
				})
			: clearance;
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
		const previous = state?.end ?? this.target;
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
