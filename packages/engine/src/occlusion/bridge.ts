import type { FloorMask } from "../walkarea/types";
import { baselineYAt, type Occluder } from "./occlusion";

export function floorPixel(mask: FloorMask, x: number, y: number): boolean {
	const col = Math.floor((x * mask.width) / 1920),
		row = Math.floor((y * mask.height) / 1080);
	return (
		col >= 0 &&
		row >= 0 &&
		col < mask.width &&
		row < mask.height &&
		!!mask.data[row * mask.width + col]
	);
}
/** Bridge only a bounded silhouette strip with visible floor on BOTH sides,
 * above its supporting contact. No model predicts hidden floor. */
export function bridgeFloor(
	mask: FloorMask,
	object: Occluder,
	alphaAt: (x: number, y: number) => boolean,
): void {
	const dx = 1920 / mask.width,
		dy = 1080 / mask.height;
	const before = [...mask.data];
	for (let row = 0; row < mask.height; row++) {
		const y = (row + 0.5) * dy;
		let start = -1;
		for (let col = 0; col <= mask.width; col++) {
			const x = (col + 0.5) * dx;
			const hidden =
				col < mask.width && y < baselineYAt(object, x) && alphaAt(x, y);
			if (hidden && start < 0) start = col;
			if (!hidden && start >= 0) {
				if (
					start > 0 &&
					col < mask.width &&
					before[row * mask.width + start - 1] &&
					before[row * mask.width + col]
				) {
					for (let c = start; c < col; c++) mask.data[row * mask.width + c] = 1;
				}
				start = -1;
			}
		}
	}
}

/** Overlapping props form one silhouette strip; each covered pixel must be
 * behind every object covering it. Neither prop can hide the other's support. */
export function bridgeOccluders(
	mask: FloorMask,
	layers: readonly {
		data: Occluder;
		alpha: (x: number, y: number) => boolean;
	}[],
): void {
	bridgeFloor(
		mask,
		{
			id: "union",
			label: "union",
			bbox: { x: 0, y: 0, w: 1920, h: 1080 },
			baseline: [{ x: 0, y: 1080 }],
			png: "",
		},
		(x, y) => {
			let covered = false;
			for (const layer of layers)
				if (layer.alpha(x, y)) {
					if (y >= baselineYAt(layer.data, x)) return false;
					covered = true;
				}
			return covered;
		},
	);
}
