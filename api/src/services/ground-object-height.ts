import type { Raster } from "./ground.js";
import { type NormalField, svdPlane } from "./ground-normals.js";

type Vec3 = readonly [number, number, number];
export interface FloorPlane {
	normal: Vec3;
	center: Vec3;
	residual90: number;
}
const quantile = (values: number[], fraction: number) => {
	const sorted = [...values].sort((a, b) => a - b);
	return sorted[Math.floor((sorted.length - 1) * fraction)];
};
const dot = (a: readonly number[], b: readonly number[]) =>
	a.reduce((sum, v, i) => sum + v * b[i], 0);
const marked = (mask: Raster, x: number, y: number, w: number, h: number) =>
	mask.data[
		Math.min(mask.height - 1, Math.floor(((y + 0.5) * mask.height) / h)) *
			mask.width +
			Math.min(mask.width - 1, Math.floor(((x + 0.5) * mask.width) / w))
	] > 0;
const point = (field: NormalField, i: number): Vec3 | undefined => {
	if (!field.valid[i]) return undefined;
	const p: Vec3 = [
		field.points[i * 3],
		field.points[i * 3 + 1],
		field.points[i * 3 + 2],
	];
	return p.every(Number.isFinite) && p[2] > 0 ? p : undefined;
};

/** Robust floor orientation, in the same arbitrary units as MoGe points. */
export function measureFloorPlane(
	field: NormalField,
	mask: Raster,
): FloorPlane | undefined {
	const points: number[][] = [];
	for (let y = 0; y < field.height; y += 4)
		for (let x = 0; x < field.width; x += 4) {
			const p = point(field, y * field.width + x);
			if (p && marked(mask, x, y, field.width, field.height))
				points.push([...p]);
		}
	if (points.length < 16) return undefined;
	let retained = points;
	let plane: ReturnType<typeof svdPlane>;
	try {
		plane = svdPlane(retained);
		for (let n = 0; n < 4; n++) {
			const offset = dot(plane.center, plane.normal);
			const distances = points.map((p) =>
				Math.abs(dot(p, plane.normal) - offset),
			);
			const limit = Math.max(1e-8, quantile(distances, 0.8));
			retained = points.filter((_, i) => distances[i] <= limit);
			if (retained.length < 16) return undefined;
			plane = svdPlane(retained);
		}
	} catch {
		return undefined;
	}
	const normal = plane.normal.map((v) =>
		plane.normal[1] > 0 ? -v : v,
	) as unknown as Vec3;
	const offset = dot(plane.center, normal);
	return {
		normal,
		center: plane.center as unknown as Vec3,
		residual90: quantile(
			points.map((p) => Math.abs(dot(p, normal) - offset)),
			0.9,
		),
	};
}

/** A segmented object's vertical extent is not its image bounding-box height.
 * This rejects elevated fragments and uncertain floor support. It does not
 * establish the object's real-world dimensions or semantic identity.
 */
export function measureObjectHeight(
	field: NormalField,
	mask: Raster,
	plane: FloorPlane,
	shape: "general" | "upright-panel" = "general",
) {
	const heights: number[] = [];
	const columns = new Map<number, { y: number; height: number }[]>();
	let minY = field.height;
	let maxY = -1;
	let clipped = false;
	let supported = 0;
	let markedPixels = 0;
	const offset = dot(plane.center, plane.normal);
	for (let y = 0; y < field.height; y++)
		for (let x = 0; x < field.width; x++) {
			if (!marked(mask, x, y, field.width, field.height)) continue;
			markedPixels++;
			minY = Math.min(minY, y);
			maxY = Math.max(maxY, y);
			if (y === 0 || y === field.height - 1) clipped = true;
			const p = point(field, y * field.width + x);
			if (!p) continue;
			supported++;
			const height = dot(p, plane.normal) - offset;
			heights.push(height);
			if (shape === "upright-panel") {
				const column = columns.get(x) ?? [];
				column.push({ y, height });
				columns.set(x, column);
			}
		}
	const reject = (reason: string) => ({ status: "rejected" as const, reason });
	if (clipped) return reject("object height clipped by image boundary");
	if (supported < 32 || supported < markedPixels * 0.8)
		return reject("insufficient valid object geometry");
	let bottom = quantile(heights, 0.05);
	let top = quantile(heights, 0.95);
	if (shape === "upright-panel") {
		// Door panels have full-height columns. Taking area quantiles trims real
		// height from both ends; use the median of complete column boundaries
		// instead, so isolated bad depth samples cannot set the object's height.
		const spans = [...columns.values()]
			.filter(
				(c) =>
					c.length >= 8 && c[c.length - 1].y - c[0].y >= (maxY - minY) * 0.8,
			)
			.map((c) => ({
				bottom: Math.min(...c.map((p) => p.height)),
				top: Math.max(...c.map((p) => p.height)),
			}));
		if (spans.length < 3) return reject("insufficient complete panel columns");
		bottom = quantile(
			spans.map((c) => c.bottom),
			0.5,
		);
		top = quantile(
			spans.map((c) => c.top),
			0.5,
		);
		if (
			quantile(
				spans.map((c) => Math.abs((c.top - c.bottom) / (top - bottom) - 1)),
				0.5,
			) > 0.1
		)
			return reject("inconsistent panel boundaries");
	}
	const extent = top - bottom;
	if (!(extent > 1e-8)) return reject("degenerate object height");
	if (plane.residual90 > extent * 0.1)
		return reject("floor uncertainty too large for this reference");
	if (bottom > extent * 0.35)
		return reject(
			"object base is missing or elevated above the reference floor",
		);
	if (bottom < -extent * 0.25)
		return reject("object extends below the reference floor");
	return {
		status: "measured" as const,
		extent,
		bottom,
		top,
		supportedPixels: supported,
	};
}

/** Project a known physical height using the measured camera and floor plane.
 * The caller must retain the assumption/uncertainty of realHeightM. */
export function projectObjectScale(
	field: NormalField,
	floor: Raster,
	plane: FloorPlane,
	objectExtent: number,
	realHeightM: number,
) {
	const reject = (reason: string) => ({ status: "rejected" as const, reason });
	if (!(objectExtent > 0) || !(realHeightM > 0))
		return reject("invalid physical reference");
	const camera: Array<{ x: number; y: number }> = [];
	const feet: Vec3[] = [];
	for (let y = 0; y < field.height; y += 4)
		for (let x = 0; x < field.width; x += 4) {
			const p = point(field, y * field.width + x);
			if (!p) continue;
			camera.push({ x: p[1] / p[2], y: ((y + 0.5) / field.height) * 1080 });
			if (marked(floor, x, y, field.width, field.height)) feet.push(p);
		}
	const fit = (values: Array<{ x: number; y: number }>) => {
		const mx = values.reduce((s, p) => s + p.x, 0) / values.length;
		const my = values.reduce((s, p) => s + p.y, 0) / values.length;
		const a =
			values.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0) /
			values.reduce((s, p) => s + (p.x - mx) ** 2, 0);
		return { a, b: my - a * mx };
	};
	if (camera.length < 32 || feet.length < 16)
		return reject("insufficient camera or floor geometry");
	const intrinsics = fit(camera);
	if (!(intrinsics.a > 0) || !Number.isFinite(intrinsics.b))
		return reject("invalid camera projection");
	if (
		quantile(
			camera.map((p) => Math.abs(p.y - (intrinsics.a * p.x + intrinsics.b))),
			0.9,
		) > 2
	)
		return reject("inconsistent camera projection");
	const adult = (objectExtent * 1.75) / realHeightM;
	const projected = feet.flatMap((p) => {
		const z = p[2] + plane.normal[2] * adult;
		if (!(z > 0)) return [];
		const y = (intrinsics.a * p[1]) / p[2] + intrinsics.b;
		const headY =
			(intrinsics.a * (p[1] + plane.normal[1] * adult)) / z + intrinsics.b;
		return [{ x: y, y: y - headY }];
	});
	if (
		projected.length < feet.length * 0.95 ||
		projected.some((p) => !(p.y > 0))
	)
		return reject("adult projection crosses camera plane");
	const model = fit(projected);
	if (!(model.a > 0) || !Number.isFinite(model.b))
		return reject("invalid projected scale line");
	const residual90 = quantile(
		projected.map((p) => Math.abs((model.a * p.x + model.b) / p.y - 1)),
		0.9,
	);
	if (residual90 > 0.1)
		return reject("projected heights require a non-linear scale model");
	const horizonY = -model.b / model.a;
	const referenceFootY =
		quantile(
			projected.map((p) => p.x),
			0.5,
		) / 1080;
	return {
		status: "estimated" as const,
		horizonY,
		slope: model.a / 529.5,
		referenceFootY,
		referenceFactor: (model.a * referenceFootY * 1080 + model.b) / 529.5,
		residual90,
	};
}
