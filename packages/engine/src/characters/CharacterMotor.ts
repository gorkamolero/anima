import { cellPoint, nearestCell, roundCorners } from "../walkarea/navigation";
import { type Point, scaleAt, toMetres } from "../walkarea/perspective";
import type { WalkArea } from "../walkarea/types";
import {
	contactOnScreen,
	type Foot,
	type FootPose,
	lockedPlacement,
} from "./footLock";
import { headingFromGround, type WalkDirection } from "./walkHeading";

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
	anchor: Point = { x: 0, y: 0 };
	private pose?: FootPose;
	private foot: Foot = "L";
	private scale = 1;
	private elapsed = 0;
	private path: Point[] = [];
	private index = 0;
	private resolve?: () => void;
	private correction: Point = { x: 0, y: 0 };
	private correctionFrames = 1;
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
		this.path = roundCorners(this.area.mask, [
			{ x: this.target.x, y: this.target.y },
			...points,
		]);
		this.index = 1;
		if (this.path.length < 2) return Promise.resolve();
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
		this.heading = this.chooseHeading();
		this.changeCycle(this.heading, this.foot);
		this.walking = true;
		this.animate("walk", this.heading, 1);
		this.animation.show(this.pose);
		this.beginStance();
		return new Promise((resolve) => {
			this.resolve = resolve;
		});
	}
	private chooseHeading(): WalkDirection {
		const p = toMetres(this.area.perspective, this.target),
			q = toMetres(this.area.perspective, this.path[this.index]);
		return headingFromGround(q.x - p.x, q.y - p.y, this.heading, p);
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
	private changeCycle(heading: WalkDirection, foot: Foot): void {
		const next = this.animation.select(heading);
		if (
			this.pose?.cycle.name === next.cycle.name &&
			this.pose.flipX === next.flipX
		)
			return;
		const frame =
			next.cycle.switchFrames.find(
				(i) => next.cycle.contacts[i].planted === foot,
			) ?? next.cycle.contacts.findIndex((c) => c.planted === foot);
		if (frame < 0)
			throw new Error(`Cycle ${next.cycle.name} lacks foot ${foot}`);
		this.pose = { ...next, frame };
		this.foot = foot;
		this.apply();
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
	private beginStance(): void {
		if (!this.pose) return;
		const end = this.stanceEnd();
		this.correctionFrames =
			((end.frame - this.pose.frame + this.pose.cycle.contacts.length) %
				this.pose.cycle.contacts.length) +
			1;
		const predicted = lockedPlacement(
			this.anchor,
			end,
			this.foot,
			this.area.perspective,
			this.area.baseScale,
			this.area.scaleClamp,
			this.scale,
		);
		const target = this.path[this.index],
			dx = target.x - this.target.x,
			dy = target.y - this.target.y,
			length = Math.hypot(dx, dy);
		const travel = Math.hypot(
			predicted.x - this.target.x,
			predicted.y - this.target.y,
		);
		const ex =
				this.target.x + (dx / Math.max(length, 1e-9)) * travel - predicted.x,
			ey = this.target.y + (dy / Math.max(length, 1e-9)) * travel - predicted.y;
		const norm = Math.max(1, Math.hypot(ex, ey));
		this.correction = {
			x: ex / norm / this.correctionFrames,
			y: ey / norm / this.correctionFrames,
		};
	}
	private atSwitch(): boolean {
		if (!this.pose) return false;
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
		const stride = Math.hypot(
			predicted.x - this.target.x,
			predicted.y - this.target.y,
		);
		while (
			this.index < this.path.length - 1 &&
			Math.hypot(
				this.path[this.index].x - this.target.x,
				this.path[this.index].y - this.target.y,
			) < Math.max(8, stride)
		)
			this.index++;
		const goal = this.path[this.index];
		const distance = Math.hypot(goal.x - this.target.x, goal.y - this.target.y);
		if (
			this.index === this.path.length - 1 &&
			distance <= Math.max(2, stride / 2)
		) {
			this.stop();
			return true;
		}
		const heading = this.chooseHeading();
		this.changeCycle(heading, this.foot);
		this.heading = heading;
		this.beginStance();
		return false;
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
			} else {
				this.anchor.x += this.correction.x;
				this.anchor.y += this.correction.y;
			}
			this.pose = next;
			this.apply();
			if (switched && this.atSwitch()) break;
		}
	}
	snapshot() {
		return {
			ground: toMetres(this.area.perspective, this.target),
			heading: this.heading,
			walking: this.walking,
			anchor: { ...this.anchor },
			planted: this.foot,
			frame: this.pose?.frame,
			cycle: this.pose?.cycle.name,
		};
	}
}
