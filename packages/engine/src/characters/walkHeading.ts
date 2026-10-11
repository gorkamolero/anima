/** Screen-space heading, independent of Phaser and grid cell size. */
export type WalkDirection = "left" | "right" | "away" | "toward";
export interface WalkPoint {
	x: number;
	y: number;
}
export const WALK_LOOKAHEAD = 100;
export const VERTICAL_ENTER_RATIO = 1.15;
export const VERTICAL_EXIT_RATIO = 0.75;

/** Walk along the polyline, not just to the next (possibly 4-connected) cell. */
export function walkHeading(
	position: WalkPoint,
	path: readonly WalkPoint[],
	index: number,
	previous: WalkDirection,
	lookahead = WALK_LOOKAHEAD,
): WalkDirection {
	let target = position;
	let remaining = lookahead;
	for (let i = index; i < path.length && remaining > 0; i++) {
		const next = path[i];
		const distance = Math.hypot(next.x - target.x, next.y - target.y);
		if (distance <= remaining) {
			target = next;
			remaining -= distance;
		} else {
			const fraction = remaining / distance;
			target = {
				x: target.x + (next.x - target.x) * fraction,
				y: target.y + (next.y - target.y) * fraction,
			};
			remaining = 0;
		}
	}
	const dx = target.x - position.x,
		dy = target.y - position.y;
	// Retain heading in the last grid cell: no last-moment sideways flash.
	if (Math.hypot(dx, dy) < 20) return previous;
	const vertical = previous === "away" || previous === "toward";
	const ratio = vertical ? VERTICAL_EXIT_RATIO : VERTICAL_ENTER_RATIO;
	if (Math.abs(dy) > Math.abs(dx) * ratio) return dy < 0 ? "away" : "toward";
	return dx < 0 ? "left" : "right";
}

/** Distance per second in source-image pixels determines the step cadence. */
export function walkPlaybackRate(
	screenSpeed: number,
	scale: number,
	sourceSpeed: number,
): number {
	if (scale <= 0 || sourceSpeed <= 0) return 0;
	return Math.max(0, screenSpeed) / (scale * sourceSpeed);
}
