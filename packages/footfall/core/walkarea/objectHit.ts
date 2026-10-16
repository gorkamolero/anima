import { floorPixel } from "../occlusion/bridge";
import type { WalkObject } from "./objectApproach";
import type { FloorMask } from "./types";

/** Scene hit testing independent of renderer textures; alpha comes from the adapter. */
export function objectAtPoint<T extends WalkObject>(
	objects: readonly T[],
	layers: readonly {
		data: {
			label: string;
			bbox?: { x: number; y: number; w: number; h: number };
		};
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
	// Segmentation can name separate instances "buildings-3", while the
	// interactable is "left building". Associate those outlines spatially;
	// do not let a broad background box win just because labels differ.
	const category = (label: string) =>
		label
			.toLowerCase()
			.replace(/-\d+$/, "")
			.replace(/[-_]/g, " ")
			.replace(/s$/, "")
			.trim();
	const matches = (name: string, label: string) => {
		const part = category(label);
		const object = category(name);
		return object === part || object.endsWith(` ${part}`);
	};
	const assigned = layers.map((layer) => {
		const exact = objects.find(
			(o) => o.name.toLowerCase() === layer.data.label.toLowerCase(),
		);
		if (exact) return exact;
		const box = layer.data.bbox;
		if (!box) return undefined;
		let best: T | undefined,
			bestOverlap = 0;
		for (const object of objects) {
			if (!matches(object.name, layer.data.label)) continue;
			const [x0, y0, x1, y1] = object.bounds;
			const overlap =
				Math.max(
					0,
					Math.min(x1 * width, box.x + box.w) - Math.max(x0 * width, box.x),
				) *
				Math.max(
					0,
					Math.min(y1 * height, box.y + box.h) - Math.max(y0 * height, box.y),
				);
			if (overlap > bestOverlap) {
				best = object;
				bestOverlap = overlap;
			}
		}
		return best;
	});
	return objects.find((object) => {
		const outlines = layers.filter((_, i) => assigned[i] === object);
		if (outlines.some((layer) => layer.alpha(x, y))) return true;
		// An exact object mask can reject its box. A semantic category may
		// cover only one part of the object, so it only contributes positive hits.
		if (
			outlines.some(
				(layer) => layer.data.label.toLowerCase() === object.name.toLowerCase(),
			)
		)
			return false;
		const [x0, y0, x1, y1] = object.bounds;
		return (
			normalizedX >= x0 &&
			normalizedX <= x1 &&
			normalizedY >= y0 &&
			normalizedY <= y1
		);
	});
}
