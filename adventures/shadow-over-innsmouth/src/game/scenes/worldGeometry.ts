import { erode, findPath, type Perspective, refineMask } from "@anima/engine";
import type { Point } from "@anima/engine/walkarea/perspective";
export interface FloorMask {
	width: number;
	height: number;
	data: number[];
}
// Drop floor rows whose centre lies below maxY (game space), so Hermes never walks under the caption panel.
export function clipFloorBelow(mask: FloorMask, maxY: number): FloorMask {
	const lastRow = Math.floor((maxY * mask.height) / 1080 - 0.5);
	return {
		...mask,
		data: mask.data.map((v, i) =>
			Math.floor(i / mask.width) > lastRow ? 0 : v,
		),
	};
}
// Engine navigation uses footprint clearance, connected targets and smooth shortcuts.
export function floorPath(
	mask: FloorMask,
	start: Point,
	target: Point,
	perspective: Perspective,
) {
	return findPath(erode(refineMask(mask), perspective), start, target);
}
