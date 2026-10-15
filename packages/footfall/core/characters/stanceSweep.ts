import { cellAt } from "../walkarea/navigation";
import type { Point } from "../walkarea/perspective";
import type { FloorMask } from "../walkarea/types";

/** Traverse every cell actually intersected by a physical body segment.
 * The mask already includes body clearance. Navigation's sampled adjacency
 * test can skip a short free interval near a grid corner and falsely reject it.
 * No inflation, rounding of endpoints, or blocked-cell tolerance is added here.
 */
export function stanceSweep(mask: FloorMask, a: Point, b: Point): boolean {
	const from = cellAt(mask, a),
		to = cellAt(mask, b);
	if (from < 0 || to < 0 || !mask.data[from] || !mask.data[to]) return false;
	if (from === to) return true;
	// A straight segment whose endpoints share a row or column cannot leave it.
	// Scan its exact cells directly, including thin blocked intervals.
	const lo = Math.min(from, to),
		hi = Math.max(from, to);
	if (Math.floor(from / mask.width) === Math.floor(to / mask.width)) {
		for (let i = lo + 1; i < hi; i++) if (!mask.data[i]) return false;
		return true;
	}
	if (from % mask.width === to % mask.width) {
		for (let i = lo + mask.width; i < hi; i += mask.width)
			if (!mask.data[i]) return false;
		return true;
	}
	const ax = (a.x * mask.width) / 1920,
		ay = (a.y * mask.height) / 1080;
	const bx = (b.x * mask.width) / 1920,
		by = (b.y * mask.height) / 1080;
	const dx = bx - ax,
		dy = by - ay;
	const sx = Math.sign(dx),
		sy = Math.sign(dy);
	let x = Math.floor(ax),
		y = Math.floor(ay);
	const endX = Math.floor(bx),
		endY = Math.floor(by);
	const stepX = dx ? 1 / Math.abs(dx) : Infinity;
	const stepY = dy ? 1 / Math.abs(dy) : Infinity;
	let tx = dx ? ((sx > 0 ? x + 1 : x) - ax) / dx : Infinity;
	let ty = dy ? ((sy > 0 ? y + 1 : y) - ay) / dy : Infinity;
	while (x !== endX || y !== endY) {
		if (tx < ty) {
			x += sx;
			tx += stepX;
		} else if (ty < tx) {
			y += sy;
			ty += stepY;
		} else {
			x += sx;
			y += sy;
			tx += stepX;
			ty += stepY;
		}
		if (
			x < 0 ||
			y < 0 ||
			x >= mask.width ||
			y >= mask.height ||
			!mask.data[y * mask.width + x]
		)
			return false;
	}
	return true;
}
