import type { FloorMask } from "@anima/engine";

export type { FloorMask } from "@anima/engine";

// Clip cached floor geometry above captions after footprint erosion.
export function clipFloorBelow(mask: FloorMask, maxY: number): FloorMask {
	const lastRow = Math.floor((maxY * mask.height) / 1080 - 0.5);
	return {
		...mask,
		data: mask.data.map((v, i) =>
			Math.floor(i / mask.width) > lastRow ? 0 : v,
		),
	};
}
