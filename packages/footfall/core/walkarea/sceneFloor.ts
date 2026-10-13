import type { Exit } from "../occlusion/exits";
import { walkAreaFromAnchor } from "./anchor";
import { cellPoint, erode, nearestCell, refineMask } from "./navigation";
import type { Point } from "./perspective";
import type { FloorMask, WalkArea } from "./types";
import { clipFloorBelow } from "./worldGeometry";

export function sceneFloor(
	ground:
		| {
				floor: FloorMask;
				horizonY: number;
				scaleSlope: number;
				baseScale: number;
				walkArea?: { scaleClamp: WalkArea["scaleClamp"] };
		  }
		| undefined,
	scene: Parameters<typeof walkAreaFromAnchor>[0],
	maxFeetY: number,
) {
	const area: WalkArea = ground
		? {
				mask: refineMask(ground.floor),
				perspective: {
					horizonY: ground.horizonY,
					slope: ground.scaleSlope,
					pixelsPerMetre: (ground.baseScale * 1059) / 1.75,
				},
				baseScale: ground.baseScale,
				scaleClamp: ground.walkArea?.scaleClamp ?? { min: 0.18, max: 1.5 },
			}
		: walkAreaFromAnchor(scene, {}, 1080);
	const visible = { ...area.mask, data: [...area.mask.data] };
	area.rawMask = visible;
	area.mask = clipFloorBelow(erode(area.mask, area.perspective), maxFeetY);
	return { area, visible };
}
/** Preserve the existing spawn exclusion around travel-gate vertices. */
export function interiorSpawn(
	spawnMask: FloorMask,
	exits: readonly Exit[],
	position: Point,
): Point | undefined {
	const safe = {
		...spawnMask,
		data: spawnMask.data.map((value, i) => {
			if (!value) return 0;
			const p = cellPoint(spawnMask, i);
			return exits.some((e) =>
				e.region.some((q) => Math.hypot(p.x - q.x, p.y - q.y) < 60),
			)
				? 0
				: 1;
		}),
	};
	const cell = nearestCell(safe, position);
	if (cell >= 0) return cellPoint(safe, cell);
}
