import { GroundLine } from "../groundline/GroundLine";
import type { GroundLineConfig } from "../groundline/types";
import type { LandmarksFile } from "../verification/ArtLandmarks";
import { fitFromLine } from "./perspective";
import type { WalkArea } from "./types";

/** Authoring lines remain intact; only the playable band stops at the caption. */
export function walkAreaFromAnchor(
	scene: {
		groundLine: GroundLineConfig;
		freeWalkBounds?: {
			minX: number;
			maxX: number;
			minY?: number;
			maxY?: number;
		};
		freeWalkRanges?: { minX: number; maxX: number }[];
		characters: { hermes?: { scale: number } };
	},
	landmarks: Pick<LandmarksFile, "horizonY">,
	maxFeetY = 944,
): WalkArea {
	const line = new GroundLine(scene.groundLine),
		width = 384,
		height = 216;
	const bounds = scene.freeWalkBounds ?? { minX: 140, maxX: 1780, minY: 700 };
	const ranges = scene.freeWalkRanges ?? [bounds];
	const baseScale = scene.characters.hermes?.scale ?? 0.5;
	return {
		mask: {
			width,
			height,
			data: Array.from({ length: width * height }, (_, i) => {
				const x = (((i % width) + 0.5) * 1920) / width,
					y = ((Math.floor(i / width) + 0.5) * 1080) / height;
				return ranges.some((r) => x >= r.minX && x <= r.maxX) &&
					y >= (bounds.minY ?? 760) &&
					y <= Math.min(bounds.maxY ?? line.getYAtX(x), maxFeetY)
					? 1
					: 0;
			}),
		},
		perspective: {
			...fitFromLine(scene.groundLine.points, landmarks.horizonY),
			pixelsPerMetre: (baseScale * 1059) / 1.75,
		},
		baseScale,
		scaleClamp: { min: 0.18, max: 1.5 },
	};
}
