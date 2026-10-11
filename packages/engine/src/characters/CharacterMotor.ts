import { cellPoint, nearestCell } from "../walkarea/navigation";
import {
	fromMetres,
	type Point,
	scaleAt,
	toMetres,
} from "../walkarea/perspective";
import type { WalkArea } from "../walkarea/types";
import { groundPathHeading, type WalkDirection } from "./walkHeading";

export interface MotorTarget extends Point {
	motor?: CharacterMotor;
	setPosition(x: number, y: number): unknown;
	setScale(scale: number): unknown;
	setDepth(depth: number): unknown;
}
/** One owner of position, scale, facing and animation, advanced by the scene clock. */
export class CharacterMotor {
	heading: WalkDirection = "left";
	walking = false;
	speed = 1;
	private path: Point[] = [];
	private index = 0;
	private resolve?: () => void;
	constructor(
		readonly target: MotorTarget,
		public area: WalkArea,
		private animate: (
			state: "walk" | "idle",
			heading: WalkDirection,
			rate: number,
		) => void,
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
		this.animate("idle", this.heading, 1);
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
		this.applyPresentation();
	}
	walk(points: readonly Point[]): Promise<void> {
		this.stop();
		this.path = points.map((p) => toMetres(this.area.perspective, p));
		this.index = 0;
		if (!this.path.length) return Promise.resolve();
		this.walking = true;
		return new Promise((resolve) => {
			this.resolve = resolve;
		});
	}
	private applyPresentation(): void {
		this.target.setScale(
			this.area.baseScale *
				scaleAt(this.area.perspective, this.target, this.area.scaleClamp),
		);
		this.target.setDepth(10 + this.target.y / 20);
	}
	update(delta: number): void {
		if (this.walking && delta > 0) {
			const p = this.area.perspective;
			let position = toMetres(p, this.target),
				budget = (this.speed * delta) / 1000;
			this.heading = groundPathHeading(
				position,
				this.path,
				this.index,
				this.heading,
			);
			this.animate("walk", this.heading, this.speed);
			while (budget > 0 && this.index < this.path.length) {
				const target = this.path[this.index],
					distance = Math.hypot(target.x - position.x, target.y - position.y);
				const fraction = distance ? Math.min(1, budget / distance) : 1;
				position = {
					x: position.x + (target.x - position.x) * fraction,
					y: position.y + (target.y - position.y) * fraction,
				};
				budget -= distance;
				if (fraction === 1) this.index++;
			}
			const screen = fromMetres(p, position);
			this.target.setPosition(screen.x, screen.y);
			if (this.index >= this.path.length) this.stop();
		}
		this.applyPresentation();
	}
	/** Full precision telemetry: rounded screen positions cannot measure slow deep walks. */
	snapshot() {
		return {
			ground: toMetres(this.area.perspective, this.target),
			speed: this.walking ? this.speed : 0,
			heading: this.heading,
			walking: this.walking,
		};
	}
}
