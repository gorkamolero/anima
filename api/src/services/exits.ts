// Wire contract mirrors the engine occlusion module without importing unexported source.
export interface Point {
	x: number;
	y: number;
}
export interface Exit {
	id: string;
	kind: "edge-left" | "edge-right" | "far" | "door";
	region: Point[];
	label?: string;
	to?: string;
}
export interface FloorRaster {
	width: number;
	height: number;
	data: number[];
}
export interface LabelledBox {
	name: string;
	bounds: number[];
}
export function floorAt(floor: FloorRaster, x: number, y: number): boolean {
	const col = Math.floor((x / 1920) * floor.width),
		row = Math.floor((y / 1080) * floor.height);
	return (
		col >= 0 &&
		row >= 0 &&
		col < floor.width &&
		row < floor.height &&
		!!floor.data[row * floor.width + col]
	);
}
/** Trace cell boundaries, preserving concavity. Disconnected strips become separate exits. */
function regions(
	floor: FloorRaster,
	select: (x: number, y: number) => boolean,
): Point[][] {
	const { width: w, height: h } = floor;
	const cells = new Set<number>();
	for (let y = 0; y < h; y++)
		for (let x = 0; x < w; x++)
			if (floor.data[y * w + x] && select(x, y)) cells.add(y * w + x);
	const output: Point[][] = [];
	while (cells.size) {
		const seed = cells.values().next().value as number;
		const component = new Set([seed]),
			queue = [seed];
		cells.delete(seed);
		for (let i = 0; i < queue.length; i++) {
			const n = queue[i],
				x = n % w,
				y = Math.floor(n / w);
			for (const [nx, ny] of [
				[x - 1, y],
				[x + 1, y],
				[x, y - 1],
				[x, y + 1],
			]) {
				const k = ny * w + nx;
				if (nx >= 0 && nx < w && ny >= 0 && ny < h && cells.delete(k)) {
					component.add(k);
					queue.push(k);
				}
			}
		}
		if (component.size < 2) continue;
		const edges = new Map<string, Point[]>();
		const has = (x: number, y: number) =>
			x >= 0 && x < w && y >= 0 && y < h && component.has(y * w + x);
		const add = (a: Point, b: Point) => {
			const key = `${a.x},${a.y}`;
			edges.set(key, [...(edges.get(key) ?? []), b]);
		};
		for (const n of component) {
			const x = n % w,
				y = Math.floor(n / w);
			if (!has(x, y - 1)) add({ x, y }, { x: x + 1, y });
			if (!has(x + 1, y)) add({ x: x + 1, y }, { x: x + 1, y: y + 1 });
			if (!has(x, y + 1)) add({ x: x + 1, y: y + 1 }, { x, y: y + 1 });
			if (!has(x - 1, y)) add({ x, y: y + 1 }, { x, y });
		}
		const loops: Point[][] = [];
		while (edges.size) {
			const start = edges.keys().next().value as string;
			let key = start;
			const loop: Point[] = [];
			do {
				const [x, y] = key.split(",").map(Number);
				loop.push({ x, y });
				const next = edges.get(key)?.pop();
				if (!edges.get(key)?.length) edges.delete(key);
				if (!next) break;
				key = `${next.x},${next.y}`;
			} while (key !== start && loop.length <= component.size * 4 + 4);
			loops.push(loop);
		}
		// A polygon cannot encode holes. Split rare perforated components into
		// row runs instead of accidentally making their non-floor cells exits.
		if (loops.length > 1) {
			for (let row = 0; row < h; row++) {
				let start = -1;
				for (let col = 0; col <= w; col++) {
					if (col < w && component.has(row * w + col)) {
						if (start < 0) start = col;
					} else if (start >= 0) {
						output.push([
							{ x: (start / w) * 1920, y: (row / h) * 1080 },
							{ x: (col / w) * 1920, y: (row / h) * 1080 },
							{ x: (col / w) * 1920, y: ((row + 1) / h) * 1080 },
							{ x: (start / w) * 1920, y: ((row + 1) / h) * 1080 },
						]);
						start = -1;
					}
				}
			}
			continue;
		}
		// The remaining loop is the exterior boundary.
		const area = (p: Point[]) =>
			Math.abs(
				p.reduce((s, a, i) => {
					const b = p[(i + 1) % p.length];
					return s + a.x * b.y - b.x * a.y;
				}, 0),
			);
		const loop = loops.sort((a, b) => area(b) - area(a))[0];
		if (loop)
			output.push(
				loop
					.filter((b, i) => {
						const a = loop[(i + loop.length - 1) % loop.length],
							c = loop[(i + 1) % loop.length];
						return (b.x - a.x) * (c.y - b.y) !== (b.y - a.y) * (c.x - b.x);
					})
					.map((p) => ({ x: (p.x / w) * 1920, y: (p.y / h) * 1080 })),
			);
	}
	return output;
}
export function deriveExits(
	floor: FloorRaster,
	objects: readonly LabelledBox[],
	horizonY?: number,
	options: { allowFar?: boolean } = {},
): Exit[] {
	const exits: Exit[] = [];
	const append = (kind: Exit["kind"], polygons: Point[][], label?: string) => {
		for (const region of polygons)
			exits.push({
				id: `${kind}${exits.some((e) => e.id === kind) ? `-${exits.length}` : ""}`,
				kind,
				region,
				...(label ? { label } : {}),
			});
	};
	const dx = 1920 / floor.width,
		dy = 1080 / floor.height;
	for (const object of objects) {
		if (!/\b(door|doorway|gate|entrance)\b/i.test(object.name)) continue;
		const [x0, , x1, y1] = object.bounds;
		const bottom = y1 * 1080;
		// Thresholds must actually meet floor; a high window/door receives no exit.
		if (
			!Array.from({ length: 5 }, (_, i) =>
				floorAt(
					floor,
					(x0 + ((x1 - x0) * i) / 4) * 1920,
					Math.min(1079, bottom + dy),
				),
			).some(Boolean)
		)
			continue;
		const polygons = regions(
			floor,
			(x, y) =>
				(x + 0.5) * dx >= x0 * 1920 &&
				(x + 0.5) * dx <= x1 * 1920 &&
				(y + 0.5) * dy >= bottom - dy &&
				(y + 0.5) * dy <= bottom + 3 * dy,
		);
		append("door", polygons, object.name);
	}
	// Only the edge-connected portion of a narrow floor strip is an exit.
	for (const side of ["edge-left", "edge-right"] as const) {
		const polys = regions(floor, (x) =>
			side === "edge-left" ? x < 3 : x >= floor.width - 3,
		);
		append(
			side,
			polys.filter((p) =>
				p.some((v) => (side === "edge-left" ? v.x === 0 : v.x === 1920)),
			),
		);
	}
	// Enclosed rooms need a labelled door, not an inferred exit into a rear shelf/wall.
	if (options.allowFar === false) return exits;
	// A receding open corridor must have several floor cells across, widen toward
	// the camera, and terminate near the horizon; a flat floor/wall seam is not far travel.
	for (let y = 0; y < floor.height - 5; y++) {
		const runs: Array<[number, number]> = [];
		let start = -1;
		for (let x = 0; x <= floor.width; x++) {
			if (x < floor.width && floor.data[y * floor.width + x]) {
				if (start < 0) start = x;
			} else if (start >= 0) {
				if (x - start >= 3) runs.push([start, x]);
				start = -1;
			}
		}
		if (!runs.length) continue;
		for (const [a, b] of runs) {
			const mid = ((a + b) / 2) * dx,
				top = y * dy;
			if (a === 0 || b === floor.width || b - a > floor.width * 0.4) continue;
			if (horizonY !== undefined && top > horizonY + 180) continue;
			if (!floorAt(floor, mid, top + 5 * dy)) continue;
			let left = Math.floor((a + b) / 2),
				right = left;
			while (left > 0 && floor.data[(y + 5) * floor.width + left - 1]) left--;
			while (right < floor.width && floor.data[(y + 5) * floor.width + right])
				right++;
			if (right - left <= b - a) continue;
			const blocked = objects.some(
				(o) =>
					!/\b(road|path|street|alley|ground|floor)\b/i.test(o.name) &&
					mid >= o.bounds[0] * 1920 &&
					mid <= o.bounds[2] * 1920 &&
					Math.abs(o.bounds[3] * 1080 - top) < 3 * dy,
			);
			if (blocked) continue;
			append(
				"far",
				regions(floor, (x, row) => x >= a && x < b && row >= y && row < y + 3),
				"Continue into the distance",
			);
		}
		break;
	}
	// Multiple disconnected fragments on the first floor row do not mean
	// multiple onward journeys. Prefer the broad central corridor.
	const far = exits.filter((e) => e.kind === "far");
	if (far.length > 1) {
		const score = (e: Exit) => {
			const xs = e.region.map((p) => p.x);
			return (
				Math.max(...xs) -
				Math.min(...xs) -
				Math.abs((Math.max(...xs) + Math.min(...xs)) / 2 - 960) * 0.1
			);
		};
		const best = far.sort((a, b) => score(b) - score(a))[0];
		return exits
			.filter((e) => e.kind !== "far" || e === best)
			.map((e) => (e === best ? { ...e, id: "far" } : e));
	}
	return exits;
}
