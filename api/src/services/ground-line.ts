import type { Raster } from "./ground.js";

/** Longest left-to-right floor-supported lane. Every interpolated segment stays
 * inside floor; disconnected islands cannot be joined by a six-point shortcut. */
export function safeGroundLine(
	mask: Raster,
	horizonY: number,
	slope: number,
	fraction: number,
) {
	const w = mask.width,
		h = mask.height;
	const length = new Uint16Array(w * h),
		cost = new Float64Array(w * h),
		previous = new Int32Array(w * h).fill(-1);
	const floor = (x: number, y: number) =>
		x >= 0 && x < w && y >= 0 && y < h && !!mask.data[y * w + x];
	let best = -1;
	for (let x = 2; x < w - 2; x++) {
		const ys = Array.from({ length: h }, (_, y) => y).filter((y) =>
			floor(x, y),
		);
		if (!ys.length) continue;
		const target = ys[0] + (ys[ys.length - 1] - ys[0]) * fraction;
		for (const y of ys) {
			if (![-2, -1, 0, 1, 2].every((dx) => floor(x + dx, y))) continue;
			const i = y * w + x;
			length[i] = 1;
			cost[i] = Math.abs(y - target);
			for (let dy = -3; dy <= 3; dy++) {
				const py = y + dy,
					p = py * w + x - 1;
				if (py < 0 || py >= h || !length[p]) continue;
				// Both columns must support the segment, including diagonal corners.
				let supported = true;
				for (let yy = Math.min(y, py); yy <= Math.max(y, py); yy++)
					if (!floor(x, yy) || !floor(x - 1, yy)) {
						supported = false;
						break;
					}
				if (!supported) continue;
				const nextCost = cost[p] + Math.abs(y - target) + Math.abs(dy);
				if (
					length[p] + 1 > length[i] ||
					(length[p] + 1 === length[i] && nextCost < cost[i])
				) {
					length[i] = length[p] + 1;
					cost[i] = nextCost;
					previous[i] = p;
				}
			}
			if (
				best < 0 ||
				length[i] > length[best] ||
				(length[i] === length[best] && cost[i] < cost[best])
			)
				best = i;
		}
	}
	if (best < 0 || length[best] < 6)
		throw new Error("No continuous floor-supported walking line");
	const chain: number[] = [];
	for (let i = best; i >= 0; i = previous[i]) chain.push(i);
	const dense = chain.reverse().map((i) => {
		const y = ((Math.floor(i / w) + 0.5) / h) * 1080;
		return {
			x: (((i % w) + 0.5) / w) * 1920,
			y,
			scaleFactor: Math.max(0.05, (y - horizonY) * slope),
		};
	});
	const supported = (a: (typeof dense)[number], b: (typeof dense)[number]) => {
		const steps = Math.ceil(
			Math.max(
				(Math.abs(b.x - a.x) / 1920) * w,
				(Math.abs(b.y - a.y) / 1080) * h,
			) * 4,
		);
		for (let j = 0; j <= steps; j++) {
			const t = j / Math.max(1, steps);
			if (
				!floor(
					Math.floor(((a.x + (b.x - a.x) * t) / 1920) * w),
					Math.floor(((a.y + (b.y - a.y) * t) / 1080) * h),
				)
			)
				return false;
		}
		return true;
	};
	const points = [dense[0]];
	for (let i = 0; i < dense.length - 1; ) {
		let next = dense.length - 1;
		while (next > i + 1 && !supported(dense[i], dense[next])) next--;
		points.push(dense[next]);
		i = next;
	}
	// Preserve the existing six-point contract (including its third-point spawn).
	// Very intricate lanes use their widest horizontal floor run for legacy use;
	// the complete 2D floor mask remains authoritative for navigation.
	if (points.length > 6) {
		let longest: { a: number; b: number; y: number } | undefined;
		for (let y = 0; y < h; y++) {
			let start = -1;
			for (let x = 2; x <= w - 2; x++) {
				if (x < w - 2 && floor(x, y)) {
					if (start < 0) start = x;
				} else if (start >= 0) {
					if (!longest || x - start > longest.b - longest.a)
						longest = { a: start, b: x - 1, y };
					start = -1;
				}
			}
		}
		if (!longest) throw new Error("No safe legacy lane");
		const lane = longest,
			y = ((lane.y + 0.5) / h) * 1080;
		return Array.from({ length: 6 }, (_, i) => ({
			x: ((lane.a + ((lane.b - lane.a) * i) / 5 + 0.5) / w) * 1920,
			y,
			scaleFactor: Math.max(0.05, (y - horizonY) * slope),
		}));
	}
	while (points.length < 6) {
		let at = 0;
		for (let i = 1; i < points.length - 1; i++)
			if (points[i + 1].x - points[i].x > points[at + 1].x - points[at].x)
				at = i;
		const a = points[at],
			b = points[at + 1];
		points.splice(at + 1, 0, {
			x: (a.x + b.x) / 2,
			y: (a.y + b.y) / 2,
			scaleFactor: (a.scaleFactor + b.scaleFactor) / 2,
		});
	}
	return points;
}
