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
// Four-connected shortest path on the segmentation grid: no diagonal corner cuts or wall crossings.
export function floorPath(
	mask: FloorMask,
	start: { x: number; y: number },
	target: { x: number; y: number },
) {
	const nearest = (p: { x: number; y: number }) => {
		let best = -1,
			distance = Infinity;
		for (let i = 0; i < mask.data.length; i++)
			if (mask.data[i]) {
				const x = (((i % mask.width) + 0.5) * 1920) / mask.width,
					y = ((Math.floor(i / mask.width) + 0.5) * 1080) / mask.height;
				const d = (p.x - x) ** 2 + (p.y - y) ** 2;
				if (d < distance) {
					best = i;
					distance = d;
				}
			}
		return best;
	};
	const from = nearest(start),
		to = nearest(target);
	if (from < 0 || to < 0) return [];
	const previous = new Int32Array(mask.data.length).fill(-2);
	previous[from] = -1;
	const queue = [from];
	let found = from,
		best = Infinity;
	for (let head = 0; head < queue.length; head++) {
		const i = queue[head];
		const d =
			((i % mask.width) - (to % mask.width)) ** 2 +
			(Math.floor(i / mask.width) - Math.floor(to / mask.width)) ** 2;
		if (d < best) {
			found = i;
			best = d;
		}
		if (i === to) break;
		for (const next of [
			i - mask.width,
			i + mask.width,
			...(i % mask.width > 0 ? [i - 1] : []),
			...(i % mask.width < mask.width - 1 ? [i + 1] : []),
		]) {
			if (
				next >= 0 &&
				next < mask.data.length &&
				mask.data[next] &&
				previous[next] === -2
			) {
				previous[next] = i;
				queue.push(next);
			}
		}
	}
	const path = [];
	for (let i = found; i >= 0; i = previous[i])
		path.push({
			x: (((i % mask.width) + 0.5) * 1920) / mask.width,
			y: ((Math.floor(i / mask.width) + 0.5) * 1080) / mask.height,
		});
	return path.reverse();
}
