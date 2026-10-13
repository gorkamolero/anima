import { cellPoint } from "../walkarea/navigation";
import {
	fromMetres,
	type Perspective,
	scaleAt,
	toMetres,
} from "../walkarea/perspective";
import type { FloorMask } from "../walkarea/types";
import { baselineYAt, type Occluder } from "./occlusion";

export interface ObjectMask {
	data: Occluder;
	alpha: (x: number, y: number) => boolean;
}

/** Physical support occupies the silhouette at and just above its baseline.
 * Sample below the baseline too: segmented feet and irregular bases can extend
 * beyond a fitted baseline. Reserve a depth-scaled 0.15 m support strip. */
export function objectFootprints(
	grid: FloorMask,
	layers: readonly ObjectMask[],
	perspective: Perspective,
): FloorMask {
	const dx = 1920 / grid.width;
	const dy = 1080 / grid.height;
	const data = grid.data.map((_, i) => {
		const { x, y } = cellPoint(grid, i);
		return layers.some((layer) => {
			if (layer.data.obstacle === false) return false;
			const baseline = baselineYAt(layer.data, x);
			const ground = toMetres(perspective, { x, y: baseline });
			const strip = Math.max(
				dy,
				perspective.slope > 0 && baseline > perspective.horizonY
					? baseline -
							fromMetres(perspective, { x: ground.x, y: ground.y + 0.15 }).y
					: 0.15 *
							(perspective.pixelsPerMetre ?? 300) *
							scaleAt(perspective, { x, y: baseline }),
			);
			// A bench's seat occupies the space between its supporting legs.
			// Treating only opaque leg pixels as support lets a route walk through
			// the seat and abruptly flip its entire overlap at the front baseline.
			// Follow the contact polyline (not the object's rectangular bounds).
			if (/\b(bench|desk|counter)\b/i.test(layer.data.label)) {
				const contacts = layer.data.baseline;
				if (
					contacts.length > 1 &&
					x >= contacts[0].x &&
					x <= contacts[contacts.length - 1].x &&
					y >= baseline - strip &&
					y <= baseline + dy / 2
				)
					return true;
			}
			// Conservative subcell sampling catches thin posts and mask edges.
			for (const ox of [-0.4, 0, 0.4])
				for (const oy of [-0.4, 0, 0.4]) {
					const px = x + ox * dx,
						py = y + oy * dy;
					if (py >= baselineYAt(layer.data, px) - strip && layer.alpha(px, py))
						return true;
				}
			return false;
		})
			? 1
			: 0;
	});
	return { width: grid.width, height: grid.height, data };
}

/** Subtract after bridging, so no hidden-floor fill can reopen a support. Body
 * clearance is applied by the normal perspective-aware erosion afterwards. */
export function subtractFootprints(
	floor: FloorMask,
	footprints: FloorMask,
): void {
	if (floor.width !== footprints.width || floor.height !== footprints.height)
		throw new Error("Footprint and floor grids must match");
	for (let i = 0; i < floor.data.length; i++)
		if (footprints.data[i]) floor.data[i] = 0;
}
