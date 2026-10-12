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
	private visitedSupports = new Set<string>();
	private resolve?: () => void;
	private recoveries = 0;
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
	private nextExit(source: FootPose):
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
			foot = this.foot,
			anchor = this.anchor;
		let position = { x: this.target.x, y: this.target.y, scale: this.scale };
		const mask = this.area.clearanceMask ?? this.area.mask;
		const raw = this.area.rawMask ?? this.area.mask;

		for (let n = 0; n < pose.cycle.contacts.length; n++) {
			if (
				(pose.cycle.matchedCut?.exitFrames.includes(pose.frame) ?? true) &&
				this.canStand(pose, anchor, foot, position.scale) &&
				this.canResume(pose, anchor, foot, position)
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
		this.recoveries = 0;
		this.visitedSupports.clear();
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
		if (!this.planStance(true, false, initialHeading)) {
			if (!this.animation.standing || !from) return Promise.resolve();
			// Standing is double support: if the held boot cannot start a safe
			// stride, try the other grounded boot without moving the sprite.
			this.stop(true);
			this.pose = from;
			this.foot = this.foot === "L" ? "R" : "L";
			this.anchor = contactOnScreen(from, this.foot, this.target, this.scale);
			if (!this.planStance(true, false, initialHeading))
				return Promise.resolve();
		}
		this.walking = true;
		this.animate("walk", this.heading, 1);
		this.animation.show(this.pose);

		return new Promise((resolve) => {
			this.resolve = resolve;
		});
	}
	/** Replan from the actual locked body, and evaluate the drawing, not a nominal heading. */
	private planStance(
		starting = false,
		turning = false,
		initialHeading?: WalkDirection,
	): boolean {
		if (!this.pose || !this.goal) return false;
		this.path = findPath(this.area.mask, this.target, this.goal);
		if (!this.path.length) return false;
		const goal = this.path[this.path.length - 1];
		this.goal = goal;
		const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
		const remaining = (p: Point) => {
			const route = lineOfSight(this.area.mask, p, goal)
				? [p, goal]
				: findPath(this.area.mask, p, goal);
			return route.length
				? route.slice(1).reduce((n, q, i) => n + distance(route[i], q), 0)
				: Infinity;
		};
		let best:
			| { heading: WalkDirection; pose: FootPose; score: number }
			| undefined;
		const here = remaining(this.target);
		const alternatives: {
			heading: WalkDirection;
			pose: FootPose;
			predicted: PredictedStance;
		}[] = [];
		for (const heading of GROUND_SECTORS) {
			if (starting && initialHeading && heading !== initialHeading) continue;
			const next = this.animation.select(heading);
			const same =
				next.cycle.name === this.pose.cycle.name &&
				next.flipX === this.pose.flipX;
			const placementDistance = (frame: number) => {
				const p = lockedPlacement(
					this.anchor,
					{ ...next, frame },
					this.foot,
					this.area.perspective,
					this.area.baseScale,
					this.area.scaleClamp,
					this.scale,
				);
				return distance(p, this.target);
			};
			const remainingFrames = (frame: number) => {
				let count = 1;
				while (
					count < next.cycle.contacts.length &&
					next.cycle.contacts[(frame + count) % next.cycle.contacts.length]
						.planted === this.foot
				)
					count++;
				return count;
			};
			// An idle foot can enter mid-stance. Pick the closest safe drawing pose,
			// avoiding an artificial backwards body jump just to start a depth walk.
			if (turning && same) continue;
			const frames =
				starting || turning
					? next.cycle.contacts
							.flatMap((c, i) =>
								c.planted === this.foot &&
								(!starting ||
									!next.cycle.matchedCut ||
									next.cycle.matchedCut.entryFrames.includes(i))
									? [i]
									: [],
							)
							.sort(
								(a, b) =>
									(starting
										? (next.cycle.matchedCut?.entryFrames.indexOf(a) ?? 0) -
											(next.cycle.matchedCut?.entryFrames.indexOf(b) ?? 0)
										: 0) ||
									(turning ? remainingFrames(b) - remainingFrames(a) : 0) ||
									placementDistance(a) - placementDistance(b),
							)
					: [
							same
								? this.pose.frame
								: next.cycle.switchFrames.find(
										(i) => next.cycle.contacts[i].planted === this.foot,
									),
						];
			for (const frame of frames) {
				if (frame === undefined) continue;
				const pose = { ...next, frame };
				// A one-frame pivot can switch support twice between rendered frames.
				// Require a visible stance instead of hiding a second landing in one tick.
				if (
					(starting || turning) &&
					next.cycle.contacts[(frame + 1) % next.cycle.contacts.length]
						.planted !== this.foot
				)
					continue;
				const predicted = this.predictStance(pose);
				if (!predicted) continue;
				// An arrival must remain escapable too: otherwise the next
				// click cannot turn from the held contact in a narrow pocket.
				{
					let continuation = false;
					for (const following of GROUND_SECTORS) {
						const selected = this.animation.select(following);
						for (let f = 0; f < selected.cycle.contacts.length; f++) {
							if (
								selected.cycle.contacts[f].planted !== predicted.foot ||
								selected.cycle.contacts[
									(f + 1) % selected.cycle.contacts.length
								].planted !== predicted.foot
							)
								continue;
							if (this.predictStance({ ...selected, frame: f }, predicted)) {
								continuation = true;
								break;
							}
						}
						if (continuation) break;
					}
					if (!continuation) continue;
				}
				let score = remaining(
					starting
						? {
								x: this.target.x + predicted.end.x - predicted.start.x,
								y: this.target.y + predicted.end.y - predicted.start.y,
							}
						: predicted.end,
				);
				// Score the actual source-frame standing endpoint, including any
				// intervening support transfers. Never assume the current anchor
				// will still be the support when the cut comes around.
				if (here < 200 && this.animation.standing && next.cycle.matchedCut) {
					const exit = this.nextExit(pose);
					if (exit) {
						const end = lockedPlacement(
							exit.anchor,
							this.animation.standing(heading),
							exit.foot,
							this.area.perspective,
							this.area.baseScale,
							this.area.scaleClamp,
							exit.position.scale,
						);
						score = Math.min(score, remaining(end));
					}
				}
				if (score >= here - 0.01) {
					alternatives.push({ heading, pose, predicted });
					continue;
				}
				if (
					!best ||
					score < best.score - 0.01 ||
					(Math.abs(score - best.score) <= 0.01 && heading === this.heading)
				)
					best = { heading, pose, score };
				break;
			}
		}
		// A short sidestep may be needed to change support foot at a narrow edge.
		// Only take it when a fully validated following stance makes net progress.
		if (!best)
			for (const candidate of alternatives) {
				for (const heading of GROUND_SECTORS) {
					const state = candidate.predicted;
					const next = this.animation.select(heading);
					const frame =
						next.cycle.name === state.pose.cycle.name &&
						next.flipX === state.pose.flipX
							? state.pose.frame
							: next.cycle.switchFrames.find(
									(i) => next.cycle.contacts[i].planted === state.foot,
								);
					if (frame === undefined) continue;
					const follow = this.predictStance({ ...next, frame }, state);
					if (!follow) continue;
					const score = remaining(follow.end);
					if (score < here - 0.01 && (!best || score < best.score))
						best = { heading: candidate.heading, pose: candidate.pose, score };
				}
			}
		// Bounded lookahead finds a safe detour when a single stance cannot progress.
		if (!best && alternatives.length) {
			let beam = alternatives.map((first) => ({
				first,
				state: first.predicted,
				score: remaining(first.predicted.end),
			}));
			const visited = new Set<string>();
			for (let depth = 0; depth < 6 && !best; depth++) {
				const nextBeam: typeof beam = [];
				for (const node of beam)
					for (const direction of GROUND_SECTORS) {
						const selected = this.animation.select(direction);
						for (const frame of selected.cycle.switchFrames.filter(
							(i) => selected.cycle.contacts[i].planted === node.state.foot,
						)) {
							const state = this.predictStance(
								{ ...selected, frame },
								node.state,
							);
							if (!state) continue;
							const key = `${Math.round(state.anchor.x / 5)},${Math.round(state.anchor.y / 5)},${state.foot}`;
							if (visited.has(key)) continue;
							visited.add(key);
							const score = remaining(state.end);
							if (score < here - 1 && (!best || score < best.score))
								best = {
									heading: node.first.heading,
									pose: node.first.pose,
									score,
								};
							nextBeam.push({ first: node.first, state, score });
						}
					}
				beam = nextBeam.sort((a, b) => a.score - b.score).slice(0, 12);
			}
		}

		if (!best) {
			// Turning on the held foot can enter a partial stance when a full
			// landing pose would put the body beyond a boundary.
			if (!starting && !turning) return this.planStance(false, true);
			if (!starting && this.animation.standing && this.recoveries < 2) {
				this.recoveries++;
				this.recoverAfterStanding = true;
			}
			this.stop();
			return false;
		}
		this.pose = best.pose;
		// Keep full supports on their source clock. Partial turns get the
		// available step time below, capped at one output frame per source pose.
		const contacts = this.pose.cycle.contacts;
		let first = this.pose.frame;
		for (let n = 0; n < contacts.length - 1; n++) {
			const previous = (first + contacts.length - 1) % contacts.length;
			if (contacts[previous].planted !== this.foot) break;
			first = previous;
		}
		let count = 1;
		while (
			count < contacts.length &&
			contacts[(first + count) % contacts.length].planted === this.foot
		)
			count++;
		// Use the natural upper cadence consistently: even four-support approaches
		// must satisfy the reviewer's three-switch whole-clip estimator.
		const cadence = 2.2;
		const switches = this.pose.cycle.switchFrames;
		const lengths = switches.map(
			(frame, i) =>
				(switches[(i + 1) % switches.length] - frame + contacts.length) %
					contacts.length || contacts.length,
		);
		let supportFrames = 1;
		while (
			supportFrames < contacts.length &&
			contacts[(this.pose.frame + supportFrames) % contacts.length].planted ===
				this.foot
		)
			supportFrames++;
		// A partial entry or turn must not create a faster-than-natural step.
		// Keep at least 1/2.2 seconds of support, including exit approaches.
		this.frameMs = Math.max(
			stanceFrameMs(lengths, count, cadence),
			1000 / (2.2 * supportFrames),
		);
		this.heading = best.heading;
		this.apply();
		// Zero is within the one-pixel steering allowance. All steering is now discrete.

		return true;
	}
	/** A stop must leave a usable source-frame entry, not strand the next click. */
	private canResume(
		pose: FootPose,
		anchor: Point,
		foot: Foot,
		position: Point & { scale: number },
	): boolean {
		if (!pose.cycle.matchedCut) return true;
		const state = this.predictStance(pose, {
			start: position,
			end: position,
			anchor,
			foot,
			pose,
			scale: position.scale,
		});
		if (!state) return false;
		for (const direction of GROUND_SECTORS) {
			const selected = this.animation.select(direction);
			for (let frame = 0; frame < selected.cycle.contacts.length; frame++) {
				if (
					selected.cycle.contacts[frame].planted !== state.foot ||
					selected.cycle.contacts[(frame + 1) % selected.cycle.contacts.length]
						.planted !== state.foot
				)
					continue;
				if (this.predictStance({ ...selected, frame }, state)) return true;
			}
		}
		return false;
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
		const placed = lockedPlacement(
			anchor,
			idle,
			foot,
			this.area.perspective,
			this.area.baseScale,
			this.area.scaleClamp,
			scale,
		);
		const raw = this.area.rawMask ?? this.area.mask;
		return (["L", "R"] as const).every(
			(sole) =>
				raw.data[
					cellAt(raw, contactOnScreen(idle, sole, placed, placed.scale))
				] > 0,
		);
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
	private stanceEnd(): FootPose {
		const pose = this.pose as FootPose,
			n = pose.cycle.contacts.length;
		let frame = (pose.frame + 1) % n;
		while (
			frame !== pose.frame &&
			pose.cycle.contacts[frame].planted === this.foot
		)
			frame = (frame + 1) % n;
		return { ...pose, frame: (frame + n - 1) % n };
	}
	private atSwitch(passingOnly = false): boolean {
		if (!this.pose || !this.goal) return false;
		const end = this.stanceEnd();
		const predicted = lockedPlacement(
			this.anchor,
			end,
			this.foot,
			this.area.perspective,
			this.area.baseScale,
			this.area.scaleClamp,
			this.scale,
		);
		const goal = this.goal;
		const exit = this.pose.cycle.matchedCut
			? this.nextExit(this.pose)
			: undefined;
		const standing = exit ? this.animation.standing?.(this.heading) : undefined;
		const arrivalPosition =
			standing && exit
				? lockedPlacement(
						exit.anchor,
						standing,
						exit.foot,
						this.area.perspective,
						this.area.baseScale,
						this.area.scaleClamp,
						exit.position.scale,
					)
				: this.target;
		const distance = Math.hypot(
			goal.x - arrivalPosition.x,
			goal.y - arrivalPosition.y,
		);
		const stride = Math.hypot(
			predicted.x - this.target.x,
			predicted.y - this.target.y,
		);
		let halfStride = Math.max(2, stride / 2);
		if (passingOnly) {
			let first = this.pose.frame;
			const contacts = this.pose.cycle.contacts;
			for (let n = 0; n < contacts.length - 1; n++) {
				const previous = (first + contacts.length - 1) % contacts.length;
				if (contacts[previous].planted !== this.foot) break;
				first = previous;
			}
			const start = lockedPlacement(
				this.anchor,
				{ ...this.pose, frame: first },
				this.foot,
				this.area.perspective,
				this.area.baseScale,
				this.area.scaleClamp,
				this.scale,
			);
			halfStride = Math.max(
				2,
				Math.hypot(predicted.x - start.x, predicted.y - start.y) / 2,
			);
		}
		// At a turn, arrival tolerance belongs to the stride aimed at the goal,
		// not only to the cycle we happened to arrive on. Evaluate that stride
		// without executing it: an overshooting step need not leave the floor.
		if (
			lineOfSight(this.area.mask, this.target, goal) &&
			distance > halfStride
		) {
			let alignment = -Infinity;
			for (const direction of GROUND_SECTORS) {
				const selected = this.animation.select(direction);
				const first = selected.cycle.switchFrames.find(
					(i) => selected.cycle.contacts[i].planted === this.foot,
				);
				if (first === undefined) continue;
				let last = first;
				while (
					selected.cycle.contacts[(last + 1) % selected.cycle.contacts.length]
						.planted === this.foot
				) {
					last = (last + 1) % selected.cycle.contacts.length;
					if (last === first) break;
				}
				const positions = [first, last].map((frame) =>
					lockedPlacement(
						this.anchor,
						{ ...selected, frame },
						this.foot,
						this.area.perspective,
						this.area.baseScale,
						this.area.scaleClamp,
						this.scale,
					),
				);
				const dx = positions[1].x - positions[0].x,
					dy = positions[1].y - positions[0].y;
				const length = Math.hypot(dx, dy);
				const dot =
					(dx * (goal.x - this.target.x) + dy * (goal.y - this.target.y)) /
					Math.max(
						1e-9,
						length * Math.hypot(goal.x - this.target.x, goal.y - this.target.y),
					);
				if (dot > alignment) {
					alignment = dot;
					halfStride = Math.max(2, (length * dot) / 2);
				}
			}
			if (alignment <= 0) halfStride = Math.max(2, stride / 2);
		}
		if (
			distance <= halfStride &&
			(!this.pose.cycle.matchedCut || exit !== undefined) &&
			this.canStand(this.pose, this.anchor, this.foot, this.scale)
		) {
			this.arrival = {
				target: { ...goal },
				anchor: { ...(exit?.anchor ?? this.anchor) },
				distance,
				halfStride,
				switchFrame: this.pose.frame,
			};
			this.stop();
			return true;
		}
		if (passingOnly) return false;
		// A route can be connected in pixels but impossible for the drawn
		// feet. Do not repeat the same support detour indefinitely.
		const support = `${Math.round(this.anchor.x * 10)},${Math.round(this.anchor.y * 10)},${this.foot},${this.heading}`;
		if (this.visitedSupports.has(support)) {
			this.stop();
			return true;
		}
		this.visitedSupports.add(support);
		return !this.planStance();
	}
	update(delta: number): void {
		if (!this.walking || !this.pose || delta <= 0) return;
		this.elapsed += delta;
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
					this.finish();
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
			const previous = {
				pose: this.pose,
				foot: this.foot,
				anchor: { ...this.anchor },
			};
			if (switched) {
				// Capture the incoming sole before changing frames: transfer support without snapping.
				this.anchor = contactOnScreen(this.pose, foot, this.target, this.scale);
				this.foot = foot;
			}
			this.pose = next;
			if (switched) {
				const placement = lockedPlacement(
					this.anchor,
					next,
					this.foot,
					this.area.perspective,
					this.area.baseScale,
					this.area.scaleClamp,
					this.scale,
				);
				if (
					!lineOfSight(
						this.area.clearanceMask ?? this.area.mask,
						{ x: this.target.x, y: previous.anchor.y },
						{ x: placement.x, y: this.anchor.y },
					)
				) {
					if (!this.planStance()) {
						this.pose = previous.pose;
						this.foot = previous.foot;
						this.anchor = previous.anchor;
						this.stop();
						break;
					}
				} else this.apply();
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
			if (switched && this.atSwitch()) break;
		}
	}
	snapshot() {
		return {
			ground: toMetres(this.area.perspective, this.target),
			arrival: this.arrival,
			heading: this.heading,
			walking: this.walking,
			cut: this.lastCut,
			unmatchedCut: this.unmatchedCut,
			settling: Boolean(this.transition),
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
