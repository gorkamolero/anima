import { cellAt, cellPoint, nearestCell } from "../walkarea/navigation";
import type { Point } from "../walkarea/perspective";
import type { FloorMask } from "../walkarea/types";

/** Eight-connected shortest grid route with visibility string pulling, matching
 * the facing reviewer's route definition. This guides turns; actual stances still
 * undergo the stricter swept-foot/body collision checks. */
export function clearanceRoute(
	mask: FloorMask,
	start: Point,
	target: Point,
): Point[] {
	const { width: w, height: h, data } = mask;
	const valid = (x: number, y: number) =>
		x >= 0 && y >= 0 && x < w && y < h && data[y * w + x] > 0;
	const cell = (p: Point) => {
		const i = cellAt(mask, p);
		return i >= 0 && data[i] ? i : nearestCell(mask, p);
	};
	const a = cell(start),
		b = cell(target);
	if (a < 0 || b < 0) return [];
	const dist = new Float64Array(w * h).fill(Infinity),
		prev = new Int32Array(w * h).fill(-1);
	type Entry = { i: number; d: number };
	const heap: Entry[] = [];
	const less = (a: Entry, b: Entry) =>
		a.d !== b.d
			? a.d < b.d
			: a.i % w !== b.i % w
				? a.i % w < b.i % w
				: a.i < b.i;
	const push = (v: Entry) => {
		let i = heap.length;
		heap.push(v);
		while (i) {
			const p = (i - 1) >> 1;
			if (!less(v, heap[p])) break;
			heap[i] = heap[p];
			i = p;
		}
		heap[i] = v;
	};
	const pop = () => {
		const first = heap[0],
			last = heap.pop();
		if (heap.length && last) {
			let i = 0;
			while (2 * i + 1 < heap.length) {
				let c = 2 * i + 1;
				if (c + 1 < heap.length && less(heap[c + 1], heap[c])) c++;
				if (!less(heap[c], last)) break;
				heap[i] = heap[c];
				i = c;
			}
			heap[i] = last;
		}
		return first;
	};
	dist[a] = 0;
	push({ i: a, d: 0 });
	while (heap.length) {
		const { i, d } = pop();
		if (d !== dist[i]) continue;
		if (i === b) break;
		const x = i % w,
			y = Math.floor(i / w);
		for (let dx = -1; dx <= 1; dx++)
			for (let dy = -1; dy <= 1; dy++) {
				if ((!dx && !dy) || !valid(x + dx, y + dy)) continue;
				const j = (y + dy) * w + x + dx,
					// biome-ignore lint/suspicious/noApproximativeNumericConstant: match reviewer grid cost
					nd = d + (dx && dy ? 1.4142 : 1);
				if (nd < dist[j]) {
					dist[j] = nd;
					prev[j] = i;
					push({ i: j, d: nd });
				}
			}
	}
	if (a !== b && prev[b] < 0) return [cellPoint(mask, a)];
	const path: number[] = [];
	for (let i = b; i >= 0; i = prev[i]) path.push(i);
	path.reverse();
	// Python round uses ties-to-even at exact half cells.
	const round = (n: number) =>
		n - Math.floor(n) === 0.5 ? 2 * Math.round(n / 2) : Math.round(n);
	const los = (p: number, q: number) => {
		const x = p % w,
			y = Math.floor(p / w),
			dx = (q % w) - x,
			dy = Math.floor(q / w) - y,
			n = Math.max(Math.abs(dx), Math.abs(dy), 1);
		for (let k = 0; k <= n; k++)
			if (!valid(round(x + (dx * k) / n), round(y + (dy * k) / n)))
				return false;
		return true;
	};
	const out = [path[0]];
	for (let i = 0; i < path.length - 1; ) {
		let j = path.length - 1;
		while (j > i + 1 && !los(path[i], path[j])) j--;
		out.push(path[j]);
		i = j;
	}
	return out.map((i) => cellPoint(mask, i));
}

export function routeCorners(route: readonly Point[]): Point[] {
	return route.filter((b, i) => {
		const a = route[i - 1],
			c = route[i + 1];
		if (!a || !c) return false;
		const turn =
			Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(b.y - a.y, b.x - a.x);
		return (
			Math.abs(Math.atan2(Math.sin(turn), Math.cos(turn))) >
			(25 * Math.PI) / 180
		);
	});
}
