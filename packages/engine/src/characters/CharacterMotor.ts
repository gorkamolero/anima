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
	private start: Point = { x: 0, y: 0 };
	private resolve?: () => void;
	/** Optional animation-owned displacement in screen pixels for this update. */
	rootStep?: (direction: WalkDirection, tangent: Point) => number;
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
		this.start = { x: this.target.x, y: this.target.y };
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
			if (this.rootStep) {
				let screen = { x: this.target.x, y: this.target.y };
				while (
					this.index < this.path.length &&
					Math.hypot(
						fromMetres(p, this.path[this.index]).x - screen.x,
						fromMetres(p, this.path[this.index]).y - screen.y,
					) < 0.001
				)
					this.index++;
				const next =
					this.path[this.index] && fromMetres(p, this.path[this.index]);
				if (!next) {
					this.stop();
					this.applyPresentation();
					return;
				}
				const length = Math.hypot(next.x - screen.x, next.y - screen.y);
				let pixels = this.rootStep(this.heading, {
					x: (next.x - screen.x) / length,
					y: (next.y - screen.y) / length,
				});
				while (pixels < 0) {
					const previous =
						this.index > 0
							? fromMetres(p, this.path[this.index - 1])
							: this.start;
					const distance = Math.hypot(
						previous.x - screen.x,
						previous.y - screen.y,
					);
					const fraction = distance ? Math.min(1, -pixels / distance) : 1;
					screen = {
						x: screen.x + (previous.x - screen.x) * fraction,
						y: screen.y + (previous.y - screen.y) * fraction,
					};
					pixels += distance * fraction;
					if (fraction === 1 && this.index > 0) this.index--;
					else break;
				}
				while (pixels > 0 && this.index < this.path.length) {
					const end = fromMetres(p, this.path[this.index]);
					const distance = Math.hypot(end.x - screen.x, end.y - screen.y);
					const fraction = distance ? Math.min(1, pixels / distance) : 1;
					screen = {
						x: screen.x + (end.x - screen.x) * fraction,
						y: screen.y + (end.y - screen.y) * fraction,
					};
					pixels -= distance;
					if (fraction === 1) this.index++;
				}
				this.target.setPosition(screen.x, screen.y);
				if (this.index >= this.path.length) this.stop();
				this.applyPresentation();
				return;
			}
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
