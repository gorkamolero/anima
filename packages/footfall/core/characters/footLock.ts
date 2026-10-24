import type { Point } from "../walkarea/perspective";

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
	/** Authored deterministic retiming; preserves source poses and support paths. */
	frameDurationsMs?: number[];
	contacts: ContactFrame[];
	switchFrames: number[];
	/** Drawn stop poses in exit-to-rest order; each intermediate holds two 24 fps ticks. */
	settleFrames?: number[];
	matchedCut?: {
		standing: string;
		headings: string[];
		exitFrames: number[];
		entryFrames: number[];
	};
	/** Visually verified passing poses; free-foot tracking alone is ambiguous at overlap. */
	passingFrames?: number[];
	/** Mean horizontal centre of the drawn body (opaque pixels), in sheet pixels. */
	bodyCentreX?: number;
	/** Mean vertical centre of the drawn body (opaque pixels), in sheet pixels. */
	bodyCentreY?: number;
	/** Mean height of the drawn body in sheet pixels, for cross-sheet size normalisation. */
	drawnHeight?: number;
	/** Sheet pixels per canonical pixel: 0.5 for a sheet stored at half resolution. */
	pixelScale?: number;
	/** Bottom row of the drawn figure in each frame: where the drawing puts the feet. */
	soleRows?: number[];
}
export interface FootPose {
	/** Only the entry stance from standing gets the start-facing tolerance. */
	firstStance?: boolean;
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
