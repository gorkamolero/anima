import type { Point } from "./occlusion.js";
export interface Exit {
	id: string;
	kind: "edge-left" | "edge-right" | "far" | "near" | "door";
	region: Point[];
	approach?: Point;
	label?: string;
	to?: string;
}
/** Boundary-inclusive polygon test. First matching exit wins (doors should precede edges). */
export function exitAt(point: Point, exits: readonly Exit[]): Exit | undefined {
	return exits.find(({ region }) => {
		if (region.length < 3) return false;
		let inside = false;
		for (let i = 0, j = region.length - 1; i < region.length; j = i++) {
			const a = region[j],
				b = region[i];
			const cross =
				(point.x - a.x) * (b.y - a.y) - (point.y - a.y) * (b.x - a.x);
			if (
				Math.abs(cross) < 1e-7 &&
				point.x >= Math.min(a.x, b.x) &&
				point.x <= Math.max(a.x, b.x) &&
				point.y >= Math.min(a.y, b.y) &&
				point.y <= Math.max(a.y, b.y)
			)
				return true;
			if (
				a.y > point.y !== b.y > point.y &&
				point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x
			)
				inside = !inside;
		}
		return inside;
	});
}

/** A specifically requested exit may complete at the nearest valid footfall. */
export function exitAtArrival(
	position: Point,
	requestedId: string | undefined,
	arrival: { target: Point; halfStride: number } | undefined,
	exits: readonly Exit[],
): Exit | undefined {
	if (
		!requestedId ||
		!arrival ||
		!Number.isFinite(arrival.halfStride) ||
		arrival.halfStride < 0
	)
		return undefined;
	if (
		Math.hypot(position.x - arrival.target.x, position.y - arrival.target.y) >
		arrival.halfStride + 1e-6
	)
		return undefined;
	const requested = exits.find((exit) => exit.id === requestedId);
	if (
		requested?.approach &&
		Math.hypot(
			arrival.target.x - requested.approach.x,
			arrival.target.y - requested.approach.y,
		) < 1e-6
	)
		return requested;
	const exit = exitAt(arrival.target, exits);
	return exit?.id === requestedId ? exit : undefined;
}
