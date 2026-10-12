/** Screen-space heading, independent of Phaser and grid cell size. */
export type WalkDirection =
	| "left"
	| "right"
	| "away"
	| "toward"
	| "away-left"
	| "away-right"
	| "toward-left"
	| "toward-right";
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

/** Eight ground sectors, relative to the view ray at the character. */
export const GROUND_SECTORS: readonly WalkDirection[] = [
	"right",
	"away-right",
	"away",
	"away-left",
	"left",
	"toward-left",
	"toward",
	"toward-right",
];
export function headingFromGround(
	dX: number,
	dZ: number,
	previous: WalkDirection = "left",
	position: WalkPoint = { x: 0, y: 1 },
	hysteresis = Math.PI / 36,
): WalkDirection {
	if (Math.hypot(dX, dZ) < 1e-8) return previous;
	const view = Math.atan2(position.x, position.y);
	const angle = Math.atan2(
		dX * Math.sin(view) + dZ * Math.cos(view),
		dX * Math.cos(view) - dZ * Math.sin(view),
	);
	const old = (GROUND_SECTORS.indexOf(previous) * Math.PI) / 4;
	const difference = Math.atan2(Math.sin(angle - old), Math.cos(angle - old));
	if (Math.abs(difference) <= Math.PI / 8 + hysteresis) return previous;
	return GROUND_SECTORS[(Math.round(angle / (Math.PI / 4)) + 8) % 8];
}
/** Look ahead in metres along a string-pulled ground path. */
export function groundPathHeading(
	position: WalkPoint,
	path: readonly WalkPoint[],
	index: number,
	previous: WalkDirection,
): WalkDirection {
	let target = position,
		budget = 0.35;
	for (let i = index; i < path.length && budget > 0; i++) {
		const next = path[i],
			length = Math.hypot(next.x - target.x, next.y - target.y);
		const f = length ? Math.min(1, budget / length) : 1;
		target = {
			x: target.x + (next.x - target.x) * f,
			y: target.y + (next.y - target.y) * f,
		};
		budget -= length;
	}
	if (Math.hypot(target.x - position.x, target.y - position.y) < 0.03)
		return previous;
	return headingFromGround(
		target.x - position.x,
		target.y - position.y,
		previous,
		position,
	);
}
