import type { Point } from "./occlusion.js";
export interface Exit {
	id: string;
	kind: "edge-left" | "edge-right" | "far" | "door";
	region: Point[];
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
