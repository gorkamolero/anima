import type { Perspective, Point } from "./perspective";
import { fromMetres, scaleAt, toMetres } from "./perspective";
import type { FloorMask, WalkArea } from "./types";

export function cellPoint(mask: FloorMask, i: number): Point {
	return {
		x: (((i % mask.width) + 0.5) * 1920) / mask.width,
		y: ((Math.floor(i / mask.width) + 0.5) * 1080) / mask.height,
	};
}
export function cellAt(mask: FloorMask, p: Point): number {
	const x = Math.floor((p.x * mask.width) / 1920),
		y = Math.floor((p.y * mask.height) / 1080);
	return x < 0 || y < 0 || x >= mask.width || y >= mask.height
		? -1
		: y * mask.width + x;
}
export function nearestCell(
	mask: FloorMask,
	p: Point,
	allowed?: Set<number>,
): number {
	let best = -1,
		distance = Infinity;
	for (let i = 0; i < mask.data.length; i++)
		if (mask.data[i] && (!allowed || allowed.has(i))) {
			const q = cellPoint(mask, i),
				d = (p.x - q.x) ** 2 + (p.y - q.y) ** 2;
			if (d < distance) {
				best = i;
				distance = d;
			}
		}
	return best;
}
function neighbours(mask: FloorMask, i: number): number[] {
	const x = i % mask.width,
		y = Math.floor(i / mask.width),
		out: number[] = [];
	for (let dy = -1; dy <= 1; dy++)
		for (let dx = -1; dx <= 1; dx++) {
			if (
				(!dx && !dy) ||
				x + dx < 0 ||
				y + dy < 0 ||
				x + dx >= mask.width ||
				y + dy >= mask.height
			)
				continue;
			const next = i + dy * mask.width + dx;
			if (
				mask.data[next] &&
				(!dx || !dy || (mask.data[i + dx] && mask.data[i + dy * mask.width]))
			)
				out.push(next);
		}
	return out;
}
/** Target snapping is restricted to the starting floor component. */
export function nearestReachable(
	mask: FloorMask,
	start: Point,
	target: Point,
): number {
	const from = nearestCell(mask, start);
	if (from < 0) return -1;
	const component = new Set([from]),
		queue = [from];
	for (let head = 0; head < queue.length; head++)
		for (const next of neighbours(mask, queue[head]))
			if (!component.has(next)) {
				component.add(next);
				queue.push(next);
			}
	return nearestCell(mask, target, component);
}
/** Upsample cached segmentation without claiming new perception detail. */
export function refineMask(mask: FloorMask): FloorMask {
	const width = 384,
		height = 216;
	return {
		width,
		height,
		data: Array.from({ length: width * height }, (_, i) =>
			mask.data[
				Math.floor((Math.floor(i / width) * mask.height) / height) *
					mask.width +
					Math.floor(((i % width) * mask.width) / width)
			]
				? 1
				: 0,
		),
	};
}
/** Circular 0.3 m footprint diameter. When supports are supplied, dilate only
 * objects. A single raster-cell margin rejects unresolved boundary slivers;
 * raw floor edges are also checked against the actual boot contacts. */
export function erode(
	mask: FloorMask,
	perspective: Perspective,
	diameterM = 0.3,
	obstacles?: FloorMask,
	floorMarginCells = 1,
): FloorMask {
	const data = mask.data.slice(),
		cw = 1920 / mask.width,
		ch = 1080 / mask.height;
	for (let y = 0; y < mask.height; y++) {
		const radius = Math.max(
			Math.min(cw, ch),
			(diameterM / 2) *
				(perspective.pixelsPerMetre ?? 300) *
				scaleAt(perspective, { x: 960, y: (y + 0.5) * ch }),
		);
		const screenY = (y + 0.5) * ch;
		const projective = perspective.slope > 0 && screenY > perspective.horizonY;
		const ground = toMetres(perspective, { x: 960, y: screenY });
		const depthRadius = projective
			? Math.max(
					Math.abs(
						fromMetres(perspective, {
							x: ground.x,
							y: ground.y + diameterM / 2,
						}).y - screenY,
					),
					Math.abs(
						fromMetres(perspective, {
							x: ground.x,
							y: ground.y - diameterM / 2,
						}).y - screenY,
					),
				)
			: radius;
		const rx = Math.ceil(radius / cw) + 1,
			ry = Math.max(floorMarginCells, Math.ceil(depthRadius / ch));
		for (let x = 0; x < mask.width; x++) {
			const i = y * mask.width + x;
			if (!data[i]) continue;
			outer: for (let dy = -ry; dy <= ry; dy++)
				for (let dx = -rx; dx <= rx; dx++) {
					const rasterMargin =
						(dx * cw) ** 2 + (dy * ch) ** 2 <=
						(floorMarginCells * Math.min(cw, ch)) ** 2;
					const a = toMetres(perspective, { x: (x + 0.5) * cw, y: screenY });
					const b = toMetres(perspective, {
						x: (x + dx + 0.5) * cw,
						y: screenY + dy * ch,
					});
					const within = projective
						? Math.hypot(a.x - b.x, a.y - b.y) <= diameterM / 2
						: (dx * cw) ** 2 + (dy * ch) ** 2 <= radius ** 2;
					if (!within && !rasterMargin) continue;
					if (
						obstacles
							? x + dx >= 0 &&
								y + dy >= 0 &&
								x + dx < mask.width &&
								y + dy < mask.height &&
								((within && !!obstacles.data[(y + dy) * mask.width + x + dx]) ||
									((dx * cw) ** 2 + (dy * ch) ** 2 <=
										(floorMarginCells * Math.min(cw, ch)) ** 2 &&
										!mask.data[(y + dy) * mask.width + x + dx]))
							: x + dx < 0 ||
								y + dy < 0 ||
								x + dx >= mask.width ||
								y + dy >= mask.height ||
								!mask.data[(y + dy) * mask.width + x + dx]
					) {
						data[i] = 0;
						break outer;
					}
				}
		}
	}
	return { ...mask, data };
}
export function lineOfSight(mask: FloorMask, a: Point, b: Point): boolean {
	const steps = Math.ceil(
		Math.max(
			(Math.abs(b.x - a.x) * mask.width) / 1920,
			(Math.abs(b.y - a.y) * mask.height) / 1080,
		) * 3,
	);
	let previous = cellAt(mask, a);
	if (previous < 0 || !mask.data[previous]) return false;
	for (let n = 1; n <= steps; n++) {
		const i = cellAt(mask, {
			x: a.x + ((b.x - a.x) * n) / steps,
			y: a.y + ((b.y - a.y) * n) / steps,
		});
		if (i < 0 || !mask.data[i]) return false;
		if (i !== previous && !neighbours(mask, previous).includes(i)) return false;
		previous = i;
	}
	return true;
}
export function stringPull(mask: FloorMask, path: Point[]): Point[] {
	if (path.length < 3) return path;
	const out = [path[0]];
	for (let i = 0; i < path.length - 1; ) {
		let j = path.length - 1;
		while (j > i + 1 && !lineOfSight(mask, path[i], path[j])) j--;
		out.push(path[j]);
		i = j;
	}
	return out;
}
class MinHeap {
	private items: { i: number; score: number }[] = [];
	push(i: number, score: number) {
		const value = { i, score };
		let n = this.items.length;
		this.items.push(value);
		while (n > 0) {
			const parent = (n - 1) >> 1;
			if (this.items[parent].score <= score) break;
			this.items[n] = this.items[parent];
			n = parent;
		}
		this.items[n] = value;
	}
	pop(): number | undefined {
		const first = this.items[0],
			last = this.items.pop();
		if (!first || !last) return undefined;
		if (this.items.length) {
			let n = 0;
			while (n * 2 + 1 < this.items.length) {
				let child = n * 2 + 1;
				if (
					child + 1 < this.items.length &&
					this.items[child + 1].score < this.items[child].score
				)
					child++;
				if (last.score <= this.items[child].score) break;
				this.items[n] = this.items[child];
				n = child;
			}
			this.items[n] = last;
		}
		return first.i;
	}
}
/** Eight-connected A*, no corner cutting, followed by conservative visibility shortcuts. */
export function findPath(
	mask: FloorMask,
	start: Point,
	target: Point,
): Point[] {
	const from = nearestCell(mask, start),
		to = nearestReachable(mask, start, target);
	if (from < 0 || to < 0) return [];
	const goal = cellPoint(mask, to),
		previous = new Int32Array(mask.data.length).fill(-1),
		g = new Float64Array(mask.data.length).fill(Infinity),
		closed = new Set<number>(),
		open = new MinHeap();
	const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
	g[from] = 0;
	open.push(from, 0);
	for (let i = open.pop(); i !== undefined; i = open.pop()) {
		if (closed.has(i)) continue;
		if (i === to) break;
		closed.add(i);
		for (const next of neighbours(mask, i)) {
			const score = g[i] + distance(cellPoint(mask, i), cellPoint(mask, next));
			if (score >= g[next]) continue;
			g[next] = score;
			previous[next] = i;
			open.push(next, score + distance(cellPoint(mask, next), goal));
		}
	}
	const path: Point[] = [];
	for (let i = to; i >= 0; i = previous[i]) path.push(cellPoint(mask, i));
	path.reverse();
	if (
		cellAt(mask, start) >= 0 &&
		mask.data[cellAt(mask, start)] &&
		lineOfSight(mask, start, path[0])
	)
		path[0] = start;
	if (
		cellAt(mask, target) === to &&
		lineOfSight(mask, path[path.length - 1], target)
	)
		path[path.length - 1] = target;
	return stringPull(mask, path);
}

/** Keep the routing margin unless it disconnects a target that remains reachable
 * with physical body clearance. The motor still validates every sole and sweep. */
export function findWalkPath(
	area: Pick<WalkArea, "mask" | "clearanceMask">,
	start: Point,
	target: Point,
): Point[] {
	const preferred = findPath(area.mask, start, target);
	if (!area.clearanceMask || !preferred.length) return preferred;
	const intended = nearestCell(area.mask, target);
	if (cellAt(area.mask, preferred[preferred.length - 1]) === intended)
		return preferred;
	const point = cellPoint(area.mask, intended);
	const physical = findPath(area.clearanceMask, start, point);
	const end = physical[physical.length - 1];
	return end && Math.hypot(end.x - point.x, end.y - point.y) < 1e-6
		? physical
		: preferred;
}

/** Round a string-pulled corner only when every replacement segment stays on floor. */
export function roundCorners(
	mask: FloorMask,
	path: readonly Point[],
	radius = 24,
): Point[] {
	if (path.length < 3) return [...path];
	const out = [path[0]];
	for (let i = 1; i < path.length - 1; i++) {
		const a = path[i - 1],
			b = path[i],
			c = path[i + 1];
		const ab = Math.hypot(b.x - a.x, b.y - a.y),
			bc = Math.hypot(c.x - b.x, c.y - b.y);
		if (!ab || !bc) continue;
		const r = Math.min(radius, ab / 3, bc / 3);
		const entry = {
			x: b.x + ((a.x - b.x) * r) / ab,
			y: b.y + ((a.y - b.y) * r) / ab,
		};
		const exit = {
			x: b.x + ((c.x - b.x) * r) / bc,
			y: b.y + ((c.y - b.y) * r) / bc,
		};
		const arc = Array.from({ length: 9 }, (_, j) => {
			const t = j / 8,
				u = 1 - t;
			return {
				x: u * u * entry.x + 2 * u * t * b.x + t * t * exit.x,
				y: u * u * entry.y + 2 * u * t * b.y + t * t * exit.y,
			};
		});
		const check = [out[out.length - 1], ...arc, c];
		if (check.slice(1).every((point, j) => lineOfSight(mask, check[j], point)))
			out.push(...arc);
		else out.push(b);
	}
	out.push(path[path.length - 1]);
	return out;
}
