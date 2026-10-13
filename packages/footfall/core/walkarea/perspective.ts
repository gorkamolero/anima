export interface Point {
	x: number;
	y: number;
}
export interface Perspective {
	horizonY: number;
	slope: number;
	residual?: { x: number; k: number }[];
	/** Constant model for degenerate legacy calibration. */
	constant?: number;
	cx?: number;
	/** Camera focal length in pixels; needed to compare lateral and depth metres. */
	focalLength?: number;
	pixelsPerMetre?: number;
}
export function scaleAt(
	p: Perspective,
	point: Point,
	clamp = { min: 0, max: Infinity },
): number {
	const r = p.residual;
	let k = 1;
	if (r?.length) {
		const right = r.findIndex((v) => v.x >= point.x);
		if (right <= 0) k = r[right === 0 ? 0 : r.length - 1].k;
		else {
			const a = r[right - 1],
				b = r[right];
			k = a.k + ((b.k - a.k) * (point.x - a.x)) / (b.x - a.x);
		}
	}
	return Math.max(
		clamp.min,
		Math.min(clamp.max, (p.constant ?? p.slope * (point.y - p.horizonY)) * k),
	);
}
/** Raw projective coordinates, exactly inverse to fromGround. */
export function toGround(
	p: Perspective,
	point: Point,
): { X: number; Z: number } {
	const Z = 1 / (p.slope * (point.y - p.horizonY));
	return { X: (point.x - (p.cx ?? 960)) * Z, Z };
}
export function fromGround(
	p: Perspective,
	point: { X: number; Z: number },
): Point {
	return {
		x: (p.cx ?? 960) + point.X / point.Z,
		y: p.horizonY + 1 / (p.slope * point.Z),
	};
}
/** Camera coordinates in metres (default reference: 300 px/m at scale factor 1). */
export function toMetres(p: Perspective, point: Point): Point {
	const g = toGround(p, point),
		ppm = p.pixelsPerMetre ?? 300;
	return { x: g.X / ppm, y: (g.Z * (p.focalLength ?? 1000)) / ppm };
}
export function fromMetres(p: Perspective, point: Point): Point {
	const ppm = p.pixelsPerMetre ?? 300;
	return fromGround(p, {
		X: point.x * ppm,
		Z: (point.y * ppm) / (p.focalLength ?? 1000),
	});
}
/** Shared least-squares calibration, also used by the legacy art verifier. */
export function fitLinear(
	points: readonly { y: number; scaleFactor?: number }[],
): Perspective {
	const n = points.length;
	if (!n) throw new Error("Cannot fit an empty line");
	const my = points.reduce((s, p) => s + p.y, 0) / n;
	const ms = points.reduce((s, p) => s + (p.scaleFactor ?? 1), 0) / n;
	const variance = points.reduce((s, p) => s + (p.y - my) ** 2, 0);
	const slope = variance
		? points.reduce((s, p) => s + (p.y - my) * ((p.scaleFactor ?? 1) - ms), 0) /
			variance
		: 0;
	return slope
		? { slope, horizonY: my - ms / slope }
		: { slope: 0, horizonY: 0, constant: ms };
}
export function fitFromLine(
	points: readonly (Point & { scaleFactor?: number })[],
	horizonY?: number,
): Perspective {
	const fit = fitLinear(points);
	const h = horizonY ?? fit.horizonY;
	const slope =
		horizonY === undefined
			? fit.slope
			: points.reduce((s, p) => s + (p.scaleFactor ?? 1) / (p.y - h), 0) /
				points.length;
	if (!(slope > 0) || points.some((p) => p.y <= h))
		throw new Error("Invalid ground perspective");
	return {
		horizonY: h,
		slope,
		residual: points
			.map((p) => ({ x: p.x, k: (p.scaleFactor ?? 1) / (slope * (p.y - h)) }))
			.sort((a, b) => a.x - b.x),
	};
}
