import { type Perspective, scaleAt } from "../walkarea/perspective";
/** All coordinates and depths are in 1920 x 1080 game space. */
export interface Point {
	x: number;
	y: number;
}
export interface Occluder {
	id: string;
	label: string;
	bbox: { x: number; y: number; w: number; h: number };
	/** Sorted by x; endpoint values extend across the sprite's entire bbox. */
	baseline: Point[];
	png: string;
	floorDecal?: boolean;
	obstacle?: boolean;
	heightMetres?: number;
}
export function baselineYAt(occluder: Occluder, x: number): number {
	const points = occluder.baseline;
	if (!points.length) return occluder.bbox.y + occluder.bbox.h;
	if (x <= points[0].x) return points[0].y;
	for (let i = 1; i < points.length; i++) {
		const a = points[i - 1],
			b = points[i];
		if (x <= b.x)
			return b.x === a.x ? b.y : a.y + ((b.y - a.y) * (x - a.x)) / (b.x - a.x);
	}
	return points[points.length - 1].y;
}
export function isBehind(feet: Point, occluder: Occluder): boolean {
	return (
		!occluder.floorDecal &&
		feet.x >= occluder.bbox.x &&
		feet.x <= occluder.bbox.x + occluder.bbox.w &&
		feet.y < baselineYAt(occluder, feet.x)
	);
}
/** Ascending depth draws back to front. At equal depth draw the character last. */
export function depthFor(feet: Point): number {
	return feet.y;
}
/** Re-evaluate at the character's x each frame, including when moving sideways. */
export function depthForOccluder(occluder: Occluder, feetX: number): number {
	return occluder.floorDecal ? 0 : baselineYAt(occluder, feetX);
}

/** Resolve renderer ties on the correct side of the baseline. An unconditional
 * negative offset would put feet just behind the baseline in front of it. */
export function renderDepthForOccluder(
	occluder: Occluder,
	feet: Point,
): number {
	const baseline = depthForOccluder(occluder, feet.x);
	const behind = !occluder.floorDecal && feet.y < baseline;
	return 10 + baseline / 20 + (behind ? 0.001 : -0.001);
}

/** Height above the physical baseline, measured at that baseline's depth.
 * Classification never deletes a low obstacle's footprint. */
export function classifyOccluder<T extends Occluder>(
	object: T,
	perspective: Perspective,
): T {
	const x = object.bbox.x + object.bbox.w / 2;
	const baseline = baselineYAt(object, x);
	const ppm =
		(perspective.pixelsPerMetre ?? 300) *
		scaleAt(perspective, { x, y: baseline });
	if (!(ppm > 0)) return object;
	const heightMetres = Math.max(0, baseline - object.bbox.y) / ppm;
	const floorDecal = object.floorDecal === true || heightMetres < 0.25;
	return {
		...object,
		heightMetres,
		floorDecal,
		obstacle:
			!floorDecal ||
			!/\b(debris|fragments?|litter|leaves|scattered)\b/i.test(object.label),
	};
}
