import { cellAt, cellPoint, nearestCell } from "../walkarea/navigation";
import type { Point } from "../walkarea/perspective";
import type { FloorMask } from "../walkarea/types";

/** Shared navigation guidance to the goal, independent of a chosen polyline.
 * Contact and body collision validation remain the footstep planner's job. */
export function clearanceDistance(
	mask: FloorMask,
	target: Point,
	ground: (p: Point) => Point,
) {
	const goal = nearestCell(mask, target);
	const { width, height, data } = mask;
	const distances = new Float64Array(data.length).fill(Infinity);
	const xs = new Float64Array(data.length),
		ys = new Float64Array(data.length);
	for (let i = 0; i < data.length; i++)
		if (data[i]) {
			const p = ground(cellPoint(mask, i));
			xs[i] = p.x;
			ys[i] = p.y;
		}
	const heap: { i: number; d: number }[] = [];
	const push = (i: number, d: number) => {
		let n = heap.length;
		heap.push({ i, d });
		while (n) {
			const p = (n - 1) >> 1;
			if (heap[p].d <= d) break;
			heap[n] = heap[p];
			n = p;
		}
		heap[n] = { i, d };
	};
	const pop = () => {
		const first = heap[0],
			last = heap.pop();
		if (!last) return first;
		if (heap.length) {
			let n = 0;
			while (n * 2 + 1 < heap.length) {
				let c = n * 2 + 1;
				if (c + 1 < heap.length && heap[c + 1].d < heap[c].d) c++;
				if (last.d <= heap[c].d) break;
				heap[n] = heap[c];
				n = c;
			}
			heap[n] = last;
		}
		return first;
	};
	if (goal >= 0) {
		distances[goal] = 0;
		push(goal, 0);
	}
	while (heap.length) {
		const { i, d } = pop();
		if (d !== distances[i]) continue;
		const x = i % width,
			y = Math.floor(i / width);
		for (let dx = -1; dx <= 1; dx++)
			for (let dy = -1; dy <= 1; dy++) {
				if (
					(!dx && !dy) ||
					x + dx < 0 ||
					x + dx >= width ||
					y + dy < 0 ||
					y + dy >= height
				)
					continue;
				const j = i + dx + dy * width;
				if (!data[j]) continue;
				const next = d + Math.hypot(xs[j] - xs[i], ys[j] - ys[i]);
				if (next < distances[j]) {
					distances[j] = next;
					push(j, next);
				}
			}
	}
	const end = ground(target);
	return (point: Point) => {
		const at = cellAt(mask, point),
			p = ground(point);
		if (at < 0 || !Number.isFinite(distances[at]))
			return Math.hypot(p.x - end.x, p.y - end.y);
		// Retain the obstacle detour at this cell, but measure the final radial
		// distance from the exact support. A whole cell must not be a zero-cost goal.
		const direct = Math.hypot(p.x - end.x, p.y - end.y);
		const centre = Math.hypot(xs[at] - end.x, ys[at] - end.y);
		return Math.max(direct, distances[at] + direct - centre);
	};
}
