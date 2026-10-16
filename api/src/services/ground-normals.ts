import type { Raster } from "./ground.js";

export interface NormalField {
	width: number;
	height: number;
	points: Float32Array;
	normals: Float32Array;
	valid: Uint8Array;
}
export interface GroundReference {
	horizonY: number;
	referenceFootY: number;
	referenceHeight: number;
}
export interface FloorLink {
	from: { x: number; y: number };
	to: { x: number; y: number };
}
const unit = (v: number[]) => {
	const n = Math.hypot(...v);
	if (!(n > 1e-10)) throw new Error("Degenerate ground normal");
	return v.map((x) => x / n);
};
const median = (v: number[]) => {
	v.sort((a, b) => a - b);
	return v[Math.floor(v.length / 2)];
};
const at = (r: Raster, x: number, y: number, w: number, h: number) =>
	r.data[
		Math.min(r.height - 1, Math.floor((y * r.height) / h)) * r.width +
			Math.min(r.width - 1, Math.floor((x * r.width) / w))
	] > 0;

/** Separable Gaussian on unit normals, followed by renormalization. Sigma is in native model pixels. */
export function smoothNormals(
	input: Float32Array,
	w: number,
	h: number,
	sigma = 6,
): Float32Array {
	const radius = Math.ceil(4 * sigma),
		kernel = Array.from({ length: 2 * radius + 1 }, (_, i) =>
			Math.exp(-((i - radius) ** 2) / (2 * sigma * sigma)),
		);
	const total = kernel.reduce((a, b) => a + b, 0);
	for (let i = 0; i < kernel.length; i++) kernel[i] /= total;
	const normalized = new Float32Array(input.length),
		temp = new Float32Array(input.length),
		out = new Float32Array(input.length);
	for (let i = 0; i < input.length; i += 3) {
		const n = Math.hypot(input[i], input[i + 1], input[i + 2]);
		if (n > 1e-8)
			for (let k = 0; k < 3; k++) normalized[i + k] = input[i + k] / n;
	}
	for (let y = 0; y < h; y++)
		for (let x = 0; x < w; x++)
			for (let k = 0; k < 3; k++) {
				let v = 0;
				for (let d = -radius; d <= radius; d++)
					v +=
						normalized[(y * w + Math.max(0, Math.min(w - 1, x + d))) * 3 + k] *
						kernel[d + radius];
				temp[(y * w + x) * 3 + k] = v;
			}
	for (let y = 0; y < h; y++)
		for (let x = 0; x < w; x++) {
			const i = (y * w + x) * 3;
			for (let k = 0; k < 3; k++) {
				let v = 0;
				for (let d = -radius; d <= radius; d++)
					v +=
						temp[(Math.max(0, Math.min(h - 1, y + d)) * w + x) * 3 + k] *
						kernel[d + radius];
				out[i + k] = v;
			}
			const n = Math.hypot(out[i], out[i + 1], out[i + 2]);
			if (n > 1e-8) for (let k = 0; k < 3; k++) out[i + k] /= n;
		}
	return out;
}

/** One-sided Jacobi SVD of centered XYZ columns. The smallest right singular vector is the plane normal. */
export function svdPlane(points: readonly number[][]): {
	normal: number[];
	center: number[];
} {
	if (points.length < 3) throw new Error("Insufficient ground-plane points");
	const center = [0, 1, 2].map(
		(k) => points.reduce((s, p) => s + p[k], 0) / points.length,
	);
	const columns = [0, 1, 2].map((k) =>
		Float64Array.from(points, (p) => p[k] - center[k]),
	);
	const vectors = [
		[1, 0, 0],
		[0, 1, 0],
		[0, 0, 1],
	];
	for (let sweep = 0; sweep < 24; sweep++) {
		let changed = false;
		for (const [p, q] of [
			[0, 1],
			[0, 2],
			[1, 2],
		]) {
			let a = 0,
				b = 0,
				c = 0;
			for (let i = 0; i < points.length; i++) {
				a += columns[p][i] ** 2;
				b += columns[q][i] ** 2;
				c += columns[p][i] * columns[q][i];
			}
			if (Math.abs(c) <= 1e-12 * Math.sqrt(a * b)) continue;
			const tau = (b - a) / (2 * c),
				t = (tau >= 0 ? 1 : -1) / (Math.abs(tau) + Math.sqrt(1 + tau * tau)),
				cs = 1 / Math.sqrt(1 + t * t),
				sn = cs * t;
			for (let i = 0; i < points.length; i++) {
				const x = columns[p][i],
					y = columns[q][i];
				columns[p][i] = cs * x - sn * y;
				columns[q][i] = sn * x + cs * y;
			}
			for (let k = 0; k < 3; k++) {
				const x = vectors[p][k],
					y = vectors[q][k];
				vectors[p][k] = cs * x - sn * y;
				vectors[q][k] = sn * x + cs * y;
			}
			changed = true;
		}
		if (!changed) break;
	}
	const sizes = columns.map((c) => c.reduce((s, v) => s + v * v, 0));
	const order = [0, 1, 2].sort((a, b) => sizes[a] - sizes[b]);
	if (sizes[order[1]] < 1e-12) throw new Error("Collinear ground-plane points");
	return { normal: unit(vectors[order[0]]), center };
}

export function combineNormals(
	field: NormalField,
	floor: Raster,
	water: Raster,
	excluded?: Raster,
): Raster {
	const { width: w, height: h, points, valid } = field;
	if (
		points.length !== w * h * 3 ||
		field.normals.length !== points.length ||
		valid.length !== w * h
	)
		throw new Error("Invalid MoGe raster dimensions");
	const normals = smoothNormals(field.normals, w, h),
		seed: number[][] = [],
		seedNormals: number[][] = [];
	for (let y = 0; y < h; y++)
		for (let x = 0; x < w; x++) {
			const i = y * w + x,
				j = i * 3;
			if (
				valid[i] &&
				at(floor, x, y, w, h) &&
				[points[j], points[j + 1], points[j + 2]].every(Number.isFinite)
			) {
				seed.push([points[j], points[j + 1], points[j + 2]]);
				seedNormals.push([normals[j], normals[j + 1], normals[j + 2]]);
			}
		}
	if (seed.length < 12)
		throw new Error("Insufficient valid floor points for MoGe plane");
	const direction = unit(
		[0, 1, 2].map((k) => median(seedNormals.map((n) => n[k]))),
	);
	let normal = direction,
		center = [0, 0, 0];
	for (let iteration = 0; iteration < 3; iteration++) {
		const distances = seed.map((p) =>
				p.reduce((s, v, k) => s + v * normal[k], 0),
			),
			offset = median([...distances]);
		const errors = distances.map((d) => Math.abs(d - offset)),
			sorted = [...errors].sort((a, b) => a - b),
			threshold = sorted[Math.floor(sorted.length * 0.7)];
		const kept = seed.filter((_, i) => errors[i] <= threshold);
		({ normal, center } = svdPlane(kept));
		if (normal.reduce((s, v, k) => s + v * direction[k], 0) < 0)
			normal = normal.map((v) => -v);
	}
	const offset = center.reduce((s, v, k) => s + v * normal[k], 0),
		depth = median(seed.map((p) => Math.hypot(...p))),
		waterMask = new Uint8Array(w * h);
	for (let y = 0; y < h; y++)
		for (let x = 0; x < w; x++)
			if (at(water, x, y, w, h))
				for (let dy = -2; dy <= 2; dy++)
					for (let dx = -2; dx <= 2; dx++)
						if (
							Math.abs(dx) + Math.abs(dy) <= 2 &&
							x + dx >= 0 &&
							x + dx < w &&
							y + dy >= 0 &&
							y + dy < h
						)
							waterMask[(y + dy) * w + x + dx] = 1;
	const data = Array<number>(w * h).fill(0),
		strict = Math.cos(Math.PI / 9),
		gentle = Math.cos((35 * Math.PI) / 180);
	for (let y = 0; y < h; y++)
		for (let x = 0; x < w; x++) {
			const i = y * w + x,
				j = i * 3;
			if (waterMask[i] || (excluded && at(excluded, x, y, w, h))) continue;
			// Missing geometry is not evidence against an existing SAM floor pixel.
			if (
				!valid[i] ||
				!Number.isFinite(points[j]) ||
				!Number.isFinite(points[j + 1]) ||
				!Number.isFinite(points[j + 2])
			) {
				if (at(floor, x, y, w, h)) data[i] = 1;
				continue;
			}
			const dot = normal.reduce((s, v, k) => s + v * normals[j + k], 0),
				distance = Math.abs(
					normal.reduce((s, v, k) => s + v * points[j + k], 0) - offset,
				);
			if (
				(dot > strict && distance < 0.08 * depth) ||
				(at(floor, x, y, w, h) && dot > gentle)
			)
				data[i] = 1;
		}
	return { width: w, height: h, data };
}

/** Apply a 0.3 m body disk in ground space, projected through the guidance camera.
 * Row prefix sums avoid scanning every pixel in each projected disk. */
function bodyMorph(
	mask: Raster,
	g: GroundReference,
	dilate: boolean,
): number[] {
	const { width: w, height: h } = mask,
		cw = 1920 / w,
		ch = 1080 / h;
	const hz = g.horizonY * 1080,
		fy = g.referenceFootY * 1080,
		rh = g.referenceHeight * 1080;
	if (!(fy > hz && rh > 0)) throw new Error("Invalid ground reference");
	const k = rh / 1.7 / (fy - hz),
		radius = 0.15;
	const prefix = new Int32Array((w + 1) * h);
	for (let y = 0; y < h; y++)
		for (let x = 0; x < w; x++)
			prefix[y * (w + 1) + x + 1] =
				prefix[y * (w + 1) + x] + (mask.data[y * w + x] ? 1 : 0);
	const data = Array<number>(w * h).fill(0);
	for (let y = 0; y < h; y++) {
		const sy = (y + 0.5) * ch,
			ppm = k * (sy - hz);
		if (!(ppm > 0)) continue;
		const z = 1000 / ppm;
		const lo = Math.max(
			0,
			Math.ceil((hz + 1000 / (k * (z + radius))) / ch - 0.5),
		);
		const hi = Math.min(
			h - 1,
			Math.floor((hz + 1000 / (k * Math.max(1e-6, z - radius))) / ch - 0.5),
		);
		for (let x = 0; x < w; x++) {
			if (!dilate && !mask.data[y * w + x]) continue;
			const wx = ((x + 0.5) * cw - 960) / ppm;
			let value = dilate ? 0 : 1;
			for (let yy = lo; yy <= hi; yy++) {
				const rowPpm = k * ((yy + 0.5) * ch - hz),
					dz = 1000 / rowPpm - z;
				const span = Math.sqrt(Math.max(0, radius * radius - dz * dz));
				const left = Math.max(
					0,
					Math.ceil(((wx - span) * rowPpm + 960) / cw - 0.5 - 1e-9),
				);
				const right = Math.min(
					w - 1,
					Math.floor(((wx + span) * rowPpm + 960) / cw - 0.5 + 1e-9),
				);
				if (right < left) continue;
				const n =
					prefix[yy * (w + 1) + right + 1] - prefix[yy * (w + 1) + left];
				if (dilate ? n > 0 : n < right - left + 1) {
					value = dilate ? 1 : 0;
					break;
				}
			}
			data[y * w + x] = value;
		}
	}
	return data;
}
/** Coordinates in links are scene pixels (1920x1080). No endpoint can create floor. */
export function cleanMainFloor(
	mask: Raster,
	g: GroundReference,
	links: readonly FloorLink[] = [],
	samFloor?: Raster,
): Raster {
	const { width: w, height: h } = mask;
	const hz = g.horizonY * 1080,
		fy = g.referenceFootY * 1080,
		rh = g.referenceHeight * 1080;
	if (!(fy > hz && rh > 0)) throw new Error("Invalid ground reference");
	// Body diameter 0.3 m, adult height 1.7 m. Radius is half a body width, not a foot-width kernel.
	const radii = Array.from({ length: h }, (_, y) =>
		Math.max(
			0.5,
			(((((rh * Math.max(0, ((y + 0.5) * 1080) / h - hz)) / (fy - hz)) *
				(0.3 / 1.7)) /
				2) *
				h) /
				1080,
		),
	);
	const eroded = bodyMorph(mask, g, false);
	const expanded = bodyMorph({ ...mask, data: eroded }, g, true);
	const core = mask.data.map((v, i) =>
		v &&
		(expanded[i] || (samFloor && at(samFloor, i % w, Math.floor(i / w), w, h)))
			? 1
			: 0,
	);
	const labels = new Int32Array(w * h),
		sizes = [0];
	let label = 0;
	const visit = (i: number, fn: (j: number) => void) => {
		const x = i % w,
			y = Math.floor(i / w);
		for (const [dx, dy] of [
			[-1, 0],
			[1, 0],
			[0, -1],
			[0, 1],
		])
			if (x + dx >= 0 && x + dx < w && y + dy >= 0 && y + dy < h)
				fn(i + dy * w + dx);
	};
	for (let i = 0; i < core.length; i++)
		if (core[i] && !labels[i]) {
			label++;
			sizes[label] = 0;
			const queue = [i];
			labels[i] = label;
			for (let j = 0; j < queue.length; j++) {
				sizes[label]++;
				visit(queue[j], (n) => {
					if (core[n] && !labels[n]) {
						labels[n] = label;
						queue.push(n);
					}
				});
			}
		}
	const standable = new Set<number>();
	for (let i = 0; i < eroded.length; i++)
		if (labels[i] && eroded[i]) standable.add(labels[i]);
	if (!standable.size) throw new Error("No body-width floor component remains");
	const nearest = (p: { x: number; y: number }) => {
		const x = (p.x * w) / 1920,
			y = (p.y * h) / 1080;
		let best = 0,
			d = Infinity;
		const radius = Math.ceil(Math.max(...radii)) + 1;
		for (
			let yy = Math.max(0, Math.floor(y - radius));
			yy <= Math.min(h - 1, Math.ceil(y + radius));
			yy++
		)
			for (
				let xx = Math.max(0, Math.floor(x - radius));
				xx <= Math.min(w - 1, Math.ceil(x + radius));
				xx++
			) {
				const i = yy * w + xx;
				if (!labels[i] || !standable.has(labels[i])) continue;
				const dd = (xx + 0.5 - x) ** 2 + (yy + 0.5 - y) ** 2;
				if (dd < d && dd <= (radii[yy] + 1) ** 2) {
					best = labels[i];
					d = dd;
				}
			}
		return best;
	};
	const kept = new Set([
			sizes.reduce(
				(best, size, i) => (standable.has(i) && size > sizes[best] ? i : best),
				0,
			),
		]),
		edges = links.map((l) => [nearest(l.from), nearest(l.to)]);
	let changed = true;
	while (changed) {
		changed = false;
		for (const [a, b] of edges)
			if (a && b && (kept.has(a) || kept.has(b))) {
				if (!kept.has(a) || !kept.has(b)) changed = true;
				kept.add(a);
				kept.add(b);
			}
	}
	// Label the reconstructed opening, not its eroded centers: separate center
	// islands may support one continuous passage after reconstruction.
	const data = core.map((v, i) => (v && kept.has(labels[i]) ? 1 : 0));
	return { width: w, height: h, data };
}
export function reduceFloor(mask: Raster, width = 192, height = 108): Raster {
	return {
		width,
		height,
		data: Array.from({ length: width * height }, (_, i) =>
			at(mask, (i % width) + 0.5, Math.floor(i / width) + 0.5, width, height)
				? 1
				: 0,
		),
	};
}
