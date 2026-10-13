import { floorPixel } from "../occlusion/bridge";
import type { WalkObject } from "./objectApproach";
import type { FloorMask } from "./types";

/** Scene hit testing independent of renderer textures; alpha comes from the adapter. */
export function objectAtPoint<T extends WalkObject>(
	objects: readonly T[],
	layers: readonly {
		data: { label: string };
		alpha(x: number, y: number): boolean;
	}[],
	floor: FloorMask | undefined,
	x: number,
	y: number,
	width: number,
	height: number,
): T | undefined {
	if (floor && floorPixel(floor, x, y)) return undefined;
	const normalizedX = x / width;
	const normalizedY = y / height;
	return objects.find(({ name, bounds }) => {
		const layer = layers.find(
			(l) => l.data.label.toLowerCase() === name.toLowerCase(),
		);
		if (layer) return layer.alpha(x, y);
		const [x0, y0, x1, y1] = bounds;
		return (
			normalizedX >= x0 &&
			normalizedX <= x1 &&
			normalizedY >= y0 &&
			normalizedY <= y1
		);
	});
}
