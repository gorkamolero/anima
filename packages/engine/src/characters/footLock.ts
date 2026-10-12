import { type Perspective, type Point, scaleAt } from "../walkarea/perspective";

export type Foot = "L" | "R";
export interface ContactFrame {
	planted: Foot;
	L: Point;
	R: Point;
}
export interface FootCycle {
	name: string;
	frameWidth: number;
	frameHeight: number;
	fps: number;
	contacts: ContactFrame[];
	switchFrames: number[];
}
export interface FootPose {
	cycle: FootCycle;
	frame: number;
	flipX: boolean;
}
export function contactOffset(pose: FootPose, foot: Foot): Point {
	const point = pose.cycle.contacts[pose.frame][foot];
	return {
		x: (point.x - pose.cycle.frameWidth / 2) * (pose.flipX ? -1 : 1),
		y: point.y - pose.cycle.frameHeight,
	};
}
export function contactOnScreen(
	pose: FootPose,
	foot: Foot,
	position: Point,
	scale: number,
): Point {
	const q = contactOffset(pose, foot);
	return { x: position.x + q.x * scale, y: position.y + q.y * scale };
}
/** Solve perspective at the body while applying that scale about the contact. */
export function lockedPlacement(
	anchor: Point,
	pose: FootPose,
	foot: Foot,
	perspective: Perspective,
	baseScale: number,
	clamp: { min: number; max: number },
	initialScale: number,
) {
	const q = contactOffset(pose, foot);
	let scale = initialScale;
	for (let i = 0; i < 32; i++) {
		const next =
			baseScale *
			scaleAt(
				perspective,
				{ x: anchor.x - q.x * scale, y: anchor.y - q.y * scale },
				clamp,
			);
		if (Math.abs(next - scale) < 1e-12) {
			scale = next;
			break;
		}
		scale = next;
	}
	return { x: anchor.x - q.x * scale, y: anchor.y - q.y * scale, scale };
}
