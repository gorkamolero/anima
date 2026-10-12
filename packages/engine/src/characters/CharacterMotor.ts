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
	private planStance(starting = false): boolean {
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
			const frames = starting
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
				const predicted = this.predictStance(pose);
				if (!predicted) continue;
				const score = remaining(
					starting
						? {
								x: this.target.x + predicted.end.x - predicted.start.x,
								y: this.target.y + predicted.end.y - predicted.start.y,
							}
						: predicted.end,
				);
				if (score >= here - 0.01) continue;
				if (
					!best ||
					score < best.score - 0.01 ||
					(Math.abs(score - best.score) <= 0.01 && heading === this.heading)
				)
					best = { heading, pose, score };
				break;
			}
		}
		if (!best) {
			this.stop();
			return false;
		}
		this.pose = best.pose;
		this.heading = best.heading;
		this.apply();
		// Zero is within the one-pixel steering allowance. All steering is now discrete.

		return true;
	}
	/** Validate every body frame and the next planted landing before committing a stance. */
	private predictStance(
		pose: FootPose,
	): { start: Point; end: Point } | undefined {
		const raw = this.area.rawMask ?? this.area.mask;
		const on = (mask: typeof raw, p: Point) => mask.data[cellAt(mask, p)] > 0;
		if (!on(raw, this.anchor)) return;
		let current = pose,
			scale = this.scale;
		let position: Point = this.target;
		let start: Point = this.target;
		for (let i = 0; i < pose.cycle.contacts.length; i++) {
			const p = lockedPlacement(
				this.anchor,
				current,
				this.foot,
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
			const foot = pose.cycle.contacts[frame].planted;
			if (foot !== this.foot) {
				const landing = contactOnScreen(current, foot, position, scale);
				if (!on(raw, landing)) return;
				const end = lockedPlacement(
					landing,
					{ ...pose, frame },
					foot,
					this.area.perspective,
					this.area.baseScale,
					this.area.scaleClamp,
					scale,
				);
				if (
					!on(this.area.mask, end) ||
					!lineOfSight(this.area.mask, position, end)
				)
					return;
				return { start, end };
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
		if (distance <= Math.max(2, stride / 2)) {
			this.arrival = {
				target: { ...goal },
				distance,
				halfStride: Math.max(2, stride / 2),
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
		while (
			this.walking &&
			this.pose &&
			this.elapsed + 1e-8 >= 1000 / this.pose.cycle.fps
		) {
			this.elapsed -= 1000 / this.pose.cycle.fps;
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
			this.apply();
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
