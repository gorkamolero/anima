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
	return baselineYAt(occluder, feetX);
}
