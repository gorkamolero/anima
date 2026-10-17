import { baselineYAt, type Occluder } from "../occlusion/occlusion";
import { cellPoint, findWalkPath } from "./navigation";
import type { Point } from "./perspective";
import type { WalkArea } from "./types";
export interface WalkObject {
	name: string;
	bounds: number[];
}
export function objectFacingPoint(object: WalkObject): Point {
	const b = object.bounds;
	return { x: (b[0] + b[2]) * 960, y: b[3] * 1080 };
}
/** Identical object approach for renderer-backed clicks and offline playback. */
export function objectApproach(
	area: WalkArea,
	start: Point,
	objects: readonly Occluder[],
	object: WalkObject,
	x: number,
): Point[] {
	const layer = objects.find(
		(o) => o.label.toLowerCase() === object.name.toLowerCase(),
	);
	const y = layer ? baselineYAt(layer, x) + 5 : object.bounds[3] * 1080 + 5;
	const mask = area.mask;
	const candidates = mask.data
		.flatMap((v, i) => (v ? [cellPoint(mask, i)] : []))
		.filter((p) => !layer || p.y >= baselineYAt(layer, p.x));
	candidates.sort(
		(a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y),
	);
	for (const point of candidates.slice(0, 128)) {
		const path = findWalkPath(area, start, point),
			end = path[path.length - 1];
		if (end && Math.hypot(end.x - point.x, end.y - point.y) < 1) return path;
	}
	return findWalkPath(area, start, { x, y });
}
