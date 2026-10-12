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
import { GROUND_SECTORS, type WalkDirection } from "./walkHeading";

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
	private resolve?: () => void;

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
		this.stop();
		if (this.target.motor === this) this.target.motor = undefined;
	}
	stop(): void {
		this.walking = false;
		this.path = [];
		this.elapsed = 0;
		// Holding the current contact pose is the idle settlement. No origin reset.
		this.animate("idle", this.heading, 1);
		if (this.pose) this.animation.show(this.pose);
		const resolve = this.resolve;
		this.resolve = undefined;
		resolve?.();
	}
	place(position: Point): void {
		// Teleport callers may have selected a fresh pose; do not restore the previous walk.
		this.pose = undefined;
		this.stop();
		const cell = nearestCell(this.area.mask, position);
		if (cell < 0) throw new Error("Walk area has no floor");
		const p = cellPoint(this.area.mask, cell);
		this.target.setPosition(p.x, p.y);
		this.scale =
			this.area.baseScale *
			scaleAt(this.area.perspective, p, this.area.scaleClamp);
		this.target.setScale(this.scale);
		this.target.setDepth(10 + p.y / 20);
		this.pose = this.animation.current();
		this.foot = this.pose.cycle.contacts[this.pose.frame].planted;
		this.anchor = contactOnScreen(this.pose, this.foot, p, this.scale);
	}
	walk(points: readonly Point[]): Promise<void> {
		this.stop();
		this.arrival = undefined;
		this.goal = points[points.length - 1];
		if (!this.goal) return Promise.resolve();
		this.pose = this.animation.current();
		this.foot = this.pose.cycle.contacts[this.pose.frame].planted;
		this.scale =
			this.area.baseScale *
			scaleAt(this.area.perspective, this.target, this.area.scaleClamp);
		this.anchor = contactOnScreen(
			this.pose,
			this.foot,
			this.target,
			this.scale,
		);
		if (!this.planStance(true)) return Promise.resolve();
		this.walking = true;
		this.animate("walk", this.heading, 1);
		this.animation.show(this.pose);
		return new Promise((resolve) => {
			this.resolve = resolve;
		});
	}
	/** Replan from the actual locked body, and evaluate the drawing, not a nominal heading. */
	private planStance(starting = false, turning = false): boolean {
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
			// An idle foot can enter mid-stance. Pick the closest safe drawing pose,
			// avoiding an artificial backwards body jump just to start a depth walk.
			if (turning && same) continue;
			const frames =
				starting || turning
					? next.cycle.contacts
							.flatMap((c, i) => (c.planted === this.foot ? [i] : []))
							.sort((a, b) => placementDistance(a) - placementDistance(b))
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
				// Avoid stepping into a support state with no safe continuation.
				const terminal =
					distance(predicted.end, goal) <=
					Math.max(2, distance(predicted.start, predicted.end) / 2);
				if (!terminal) {
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
				const score = remaining(
					starting
						? {
								x: this.target.x + predicted.end.x - predicted.start.x,
								y: this.target.y + predicted.end.y - predicted.start.y,
							}
						: predicted.end,
				);
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
			this.stop();
			return false;
		}
		this.pose = best.pose;
		// A partial turn keeps the full source stance's frame timing. Stretching
		// its few remaining poses over a whole step caused frozen walking frames.
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
		// Modulate only the animation clock: the contact solver still owns every
		// pixel of travel. Far poses use slower cadence; near poses quicker.
		const mask = this.area.mask;
		let far = mask.height,
			near = 0;
		for (let i = 0; i < mask.data.length; i++)
			if (mask.data[i]) {
				const row = Math.floor(i / mask.width);
				far = Math.min(far, row);
				near = Math.max(near, row);
			}
		const row = (this.target.y * mask.height) / 1080 - 0.5;
		const depth = Math.max(
			0,
			Math.min(1, (row - far) / Math.max(1, near - far)),
		);
		const cadence = 1.6 + 0.6 * depth;
		this.frameMs = 1000 / (cadence * count);
		this.heading = best.heading;
		this.apply();
		// Zero is within the one-pixel steering allowance. All steering is now discrete.

		return true;
	}
	/** Validate every body frame and the next planted landing before committing a stance. */
	private predictStance(
		pose: FootPose,
		state?: PredictedStance,
	): PredictedStance | undefined {
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
			if (!on(this.area.mask, p) || !lineOfSight(this.area.mask, position, p))
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
					on(this.area.mask, end) && lineOfSight(this.area.mask, position, end);
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
		this.target.setDepth(10 + p.y / 20);
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
	private atSwitch(): boolean {
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
		const distance = Math.hypot(goal.x - this.target.x, goal.y - this.target.y);
		const stride = Math.hypot(
			predicted.x - this.target.x,
			predicted.y - this.target.y,
		);
		let halfStride = Math.max(2, stride / 2);
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
					Math.max(1e-9, length * distance);
				if (dot > alignment) {
					alignment = dot;
					halfStride = Math.max(2, (length * dot) / 2);
				}
			}
			if (alignment <= 0) halfStride = Math.max(2, stride / 2);
		}
		if (distance <= halfStride) {
			this.arrival = {
				target: { ...goal },
				distance,
				halfStride,
				switchFrame: this.pose.frame,
			};
			this.stop();
			return true;
		}
		return !this.planStance();
	}
	update(delta: number): void {
		if (!this.walking || !this.pose || delta <= 0) return;
		this.elapsed += delta;
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
				if (!lineOfSight(this.area.mask, this.target, placement)) {
					if (!this.planStance()) {
						this.pose = previous.pose;
						this.foot = previous.foot;
						this.anchor = previous.anchor;
						this.stop();
						break;
					}
				} else this.apply();
			} else this.apply();
			if (switched && this.atSwitch()) break;
		}
	}
	snapshot() {
		return {
			ground: toMetres(this.area.perspective, this.target),
			arrival: this.arrival,
			heading: this.heading,
			walking: this.walking,
			anchor: { ...this.anchor },
			planted: this.foot,
			frame: this.pose?.frame,
			cycle: this.pose?.cycle.name,
		};
	}
}
