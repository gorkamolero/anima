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
				// Alpha holes between overlapping props can be smaller than one
				// pair of source floor samples. Keep that bounded run together, then
				// require real floor at both outer ends as usual.
				let resumes = false;
				if (col < mask.width && !before[row * mask.width + col]) {
					for (
						let gap = 1;
						gap <= Math.floor(20 / dx) && col + gap < mask.width;
						gap++
					) {
						const nextX = (col + gap + 0.5) * dx;
						if (y < baselineYAt(object, nextX) && alphaAt(nextX, y)) {
							resumes = true;
							break;
						}
					}
				}
				if (resumes) continue;
				// Cached floor cells and dark cast shadows disagree with full
				// resolution alpha. Allow a bounded 20 px shadow gap at each
				// silhouette edge, still requiring visible floor on both sides.
				const tolerance = Math.floor(20 / dx);
				let left = start - 1,
					right = col;
				while (
					left > 0 &&
					start - 1 - left < tolerance &&
					!before[row * mask.width + left]
				)
					left--;
				while (
					right < mask.width - 1 &&
					right - col < tolerance &&
					!before[row * mask.width + right]
				)
					right++;
				if (
					left >= 0 &&
					right < mask.width &&
					before[row * mask.width + left] &&
					before[row * mask.width + right]
				) {
					for (let c = left + 1; c < right; c++)
						mask.data[row * mask.width + c] = 1;
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
	const hidden = (x: number, y: number) => {
		let covered = false;
		for (const layer of layers)
			if (layer.alpha(x, y)) {
				if (y >= baselineYAt(layer.data, x)) return false;
				covered = true;
			}
		return covered;
	};
	bridgeFloor(
		mask,
		{
			id: "union",
			label: "union",
			bbox: { x: 0, y: 0, w: 1920, h: 1080 },
			baseline: [{ x: 0, y: 1080 }],
			png: "",
		},
		hidden,
	);
	// Join neighbouring two-sided strips only inside the occluding silhouette.
	// Small alpha/floor raster disagreements must not fragment a rear walkway.
	// Both vertical endpoints already have floor evidence; supports are subtracted
	// by the caller afterwards. Never extend past an endpoint or across open sky.
	const before = [...mask.data];
	const dx = 1920 / mask.width,
		dy = 1080 / mask.height;
	for (let col = 0; col < mask.width; col++) {
		for (let row = 1; row < mask.height; row++) {
			if (
				before[row * mask.width + col] ||
				!before[(row - 1) * mask.width + col]
			)
				continue;
			let end = row;
			while (
				end < mask.height &&
				!before[end * mask.width + col] &&
				(end - row + 1) * dy <= 80 &&
				(hidden((col + 0.5) * dx, (end + 0.5) * dy) ||
					Array.from(
						{ length: Math.floor(20 / dy) },
						(_, n) => end + n + 1,
					).some(
						(next) =>
							next < mask.height && hidden((col + 0.5) * dx, (next + 0.5) * dy),
					))
			)
				end++;
			if (end < mask.height && before[end * mask.width + col])
				for (let y = row; y < end; y++) mask.data[y * mask.width + col] = 1;
		}
	}
}
