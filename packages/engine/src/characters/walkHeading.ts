/** Drawing directions, selected in ground space independently of Phaser. */
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

/** Same per-stance ground/view-ray convention as the independent facing gate. */
export function stanceFacesHeading(
	start: WalkPoint,
	end: WalkPoint,
	heading: WalkDirection,
	perspective = true,
): boolean {
	const dx = end.x - start.x,
		dz = end.y - start.y;
	if (Math.hypot(dx, dz) < 0.05) return true;
	const angle =
		Math.atan2(dz, dx) + (perspective ? Math.atan2(end.x, end.y) : 0);
	const expected = (GROUND_SECTORS.indexOf(heading) * Math.PI) / 4;
	return (
		Math.abs(
			Math.atan2(Math.sin(angle - expected), Math.cos(angle - expected)),
		) <=
		Math.PI / 6
	);
}
