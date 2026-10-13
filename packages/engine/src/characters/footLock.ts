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
	// With no lateral residual, solve the contact/perspective fixed point
	// directly. The clamped solution has the same fixed point as iteration.
	if (!perspective.residual?.length) {
		const denominator = 1 + baseScale * perspective.slope * q.y;
		if (perspective.constant !== undefined || denominator > 0) {
			const raw =
				perspective.constant !== undefined
					? baseScale * perspective.constant
					: (baseScale *
							perspective.slope *
							(anchor.y - perspective.horizonY)) /
						denominator;
			const scale = Math.max(
				baseScale * clamp.min,
				Math.min(baseScale * clamp.max, raw),
			);
			return { x: anchor.x - q.x * scale, y: anchor.y - q.y * scale, scale };
		}
	}
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
