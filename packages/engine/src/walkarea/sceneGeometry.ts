import { bridgeOccluders } from "../occlusion/bridge";
import type { Exit } from "../occlusion/exits";
import {
	type ObjectMask,
	objectFootprints,
	subtractFootprints,
} from "../occlusion/footprints";
import { cellPoint, erode, nearestCell, refineMask } from "./navigation";
import type { FloorMask, WalkArea } from "./types";

/** Build physical floor from stored segmentation and renderer-independent masks. */
export function applySceneFootprints(
	area: WalkArea,
	visible: FloorMask,
	segmentedFloor: FloorMask | undefined,
	layers: readonly ObjectMask[],
	maxY: number,
	kat?: {
		x: number;
		y: number;
		scaleX: number;
		scaleY: number;
		visible: boolean;
	},
): void {
	const bridged = { ...visible, data: [...visible.data] };
	if (segmentedFloor) {
		const segmented = refineMask(segmentedFloor);
		bridgeOccluders(segmented, layers);
		for (let i = 0; i < bridged.data.length; i++)
			bridged.data[i] = bridged.data[i] && segmented.data[i] ? 1 : 0;
	} else bridgeOccluders(bridged, layers);
	const footprints = objectFootprints(bridged, layers, area.perspective);
	if (kat?.visible) {
		for (let i = 0; i < footprints.data.length; i++) {
			const p = cellPoint(footprints, i);
			const sx = (p.x - kat.x) / kat.scaleX + 410;
			const sy = (p.y - kat.y) / kat.scaleY + 880;
			if (sx >= 260 && sx <= 800 && sy >= 535 && sy <= 880)
				footprints.data[i] = 1;
		}
	}
	subtractFootprints(bridged, footprints);
	const clip = (mask: FloorMask) => ({
		...mask,
		data: mask.data.map((v, i) =>
			Math.floor(i / mask.width) > Math.floor((maxY * mask.height) / 1080 - 0.5)
				? 0
				: v,
		),
	});
	area.clearanceMask = clip(
		erode(bridged, area.perspective, 0.3, footprints, 0),
	);
	area.objectFootprints = footprints;
	area.rawMask = bridged;
	area.mask = clip(erode(bridged, area.perspective, 0.3, footprints));
}

export function sceneExitApproaches(
	exits: Exit[],
	connections: { exit: string; kind: Exit["kind"]; to: string }[],
	area: WalkArea,
	hotspots:
		| {
				id: string;
				name: string;
				approach?: { x: number; y: number };
				actions: {
					USE?: { transitionTo?: string; moveTo?: { x: number; y: number } };
				};
		  }[]
		| undefined,
	maxY: number,
) {
	for (const link of connections) {
		let exit = exits.find((e) => e.id === link.exit);
		if (!exit && link.kind === "near") {
			exit = {
				id: link.exit,
				kind: "near",
				region: [
					{ x: 900, y: maxY - 16 },
					{ x: 1020, y: maxY - 16 },
					{ x: 1020, y: maxY },
					{ x: 900, y: maxY },
				],
			};
			exits.push(exit);
		}
		if (exit) exit.to = link.to;
		if (link.kind === "edge-left" || link.kind === "edge-right")
			for (const fragment of exits.filter((e) => e.kind === link.kind))
				fragment.to = link.to;
	}
	if (hotspots !== undefined) {
		for (const hotspot of hotspots) {
			const action = hotspot.actions.USE;
			if (!action?.transitionTo || !hotspot.approach) continue;
			const point = action.moveTo ?? hotspot.approach;
			exits = exits.filter((e) => e.kind !== "door");
			exits.unshift({
				id: hotspot.id,
				kind: "door",
				label: hotspot.name,
				to: action.transitionTo,
				region: [
					{ x: point.x - 10, y: point.y - 10 },
					{ x: point.x + 10, y: point.y - 10 },
					{ x: point.x + 10, y: point.y + 10 },
					{ x: point.x - 10, y: point.y + 10 },
				],
			});
		}
	}
	// Caption clipping and footprint erosion can put a raw threshold just
	// outside the navigable mask. Its reachable approach is the trigger.
	const exitMask = area?.mask;
	const approachMask = area ? erode(area.mask, area.perspective) : undefined;
	if (exitMask)
		exits = exits.map((exit) => {
			const center = {
				x: exit.region.reduce((n, p) => n + p.x, 0) / exit.region.length,
				y: exit.region.reduce((n, p) => n + p.y, 0) / exit.region.length,
			};
			// An entry belongs to its physical threshold, independent of the
			// previous scene's sprite position or disconnected floor component.
			const cell = nearestCell(exitMask, center);
			if (cell < 0) return exit;
			const point = cellPoint(exitMask, cell);
			const interior =
				exit.kind !== "door" && approachMask
					? nearestCell(approachMask, point)
					: -1;
			const approach =
				interior >= 0 && approachMask
					? cellPoint(approachMask, interior)
					: point;
			return {
				...exit,
				approach: approach ?? point,
				// Keep physical thresholds at their artwork. Only an explicit
				// exit request may trigger at its reachable stance approach.
			};
		});
	// Fragmented pixels on one image edge are aliases of one journey.
	// Use the same reachable departure, rather than routing each fragment
	// into a different narrow pocket beside a foreground obstacle.
	for (const kind of ["edge-left", "edge-right"] as const) {
		const primary = exits.find((exit) => exit.kind === kind);
		if (primary?.approach)
			for (const exit of exits) {
				if (exit.kind === kind) exit.approach = { ...primary.approach };
			}
	}
	return { exits, exitMask, approachMask };
}
