import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { bridgeOccluders } from "@anima/footfall/core/occlusion/bridge";
import {
	objectFootprints,
	subtractFootprints,
} from "@anima/footfall/core/occlusion/footprints";
import {
	classifyOccluder,
	type Occluder,
} from "@anima/footfall/core/occlusion/occlusion";
import { erode, refineMask } from "@anima/footfall/core/walkarea/navigation";
import { imagePath } from "../lib/backgrounds.js";
import type { Raster } from "./ground.js";
import { calibrateGround } from "./ground-calibration.js";
import {
	type FloorLink,
	type GroundReference,
	reduceFloor,
} from "./ground-normals.js";

/** Preserve visible floor connected by the same bounded occluder bridges used
 * during walking. These links never add pixels to the visible floor mask. */
export async function occluderWalkLinks(
	image: string,
	floor: Raster,
	guidance: GroundReference,
	destinationFloor: Raster = floor,
): Promise<FloorLink[]> {
	const source = imagePath(image);
	const text = await readFile(
		source.replace(/\.png$/, ".occluders.json"),
		"utf8",
	).catch(() => null);
	if (!text) return [];
	const perspective = {
		...calibrateGround(guidance),
		pixelsPerMetre: (0.5 * 1059) / 1.75,
	};
	const objects = (JSON.parse(text) as Occluder[]).map((o) =>
		classifyOccluder(o, perspective),
	);
	const layers = objects.map((data) => {
		const alpha = execFileSync(
			"magick",
			[
				resolve(dirname(source), data.png),
				"-resize",
				`${Math.ceil(data.bbox.w)}x${Math.ceil(data.bbox.h)}!`,
				"-alpha",
				"extract",
				"-depth",
				"8",
				"gray:-",
			],
			{ maxBuffer: 32 * 1024 * 1024, stdio: ["pipe", "pipe", "pipe"] },
		);
		const w = Math.ceil(data.bbox.w),
			h = Math.ceil(data.bbox.h);
		return {
			data,
			alpha: (x: number, y: number) => {
				const cx = Math.floor(x - data.bbox.x),
					cy = Math.floor(y - data.bbox.y);
				return (
					cx >= 0 && cy >= 0 && cx < w && cy < h && alpha[cy * w + cx] > 127
				);
			},
		};
	});
	const visible = refineMask(reduceFloor(floor)),
		bridged = { ...visible, data: [...visible.data] };
	bridgeOccluders(bridged, layers);
	const footprints = objectFootprints(bridged, layers, perspective);
	subtractFootprints(bridged, footprints);
	// Match the runtime navigation resolution and its one-cell edge margin.
	// Traverse its connected graph rather
	// than requiring a straight bridge row. Paths may turn around a prop before
	// reaching the interior of a visible floor component.
	const nav = erode(bridged, perspective, 0.3, footprints);
	return connectedFloorLinks(nav, refineMask(reduceFloor(destinationFloor)));
}

/** Link visible components through the preserved walking graph, including turns. */
export function connectedFloorLinks(
	nav: Raster,
	destination: Raster,
): FloorLink[] {
	const { width: w, height: h } = destination;
	if (nav.width !== w || nav.height !== h)
		throw new Error("Walk-link raster dimensions differ");
	const adjacent = (i: number) => [
		i % w > 0 ? i - 1 : -1,
		i % w < w - 1 ? i + 1 : -1,
		i >= w ? i - w : -1,
		i < w * (h - 1) ? i + w : -1,
	];
	const components = (data: readonly number[]) => {
		const labels = new Int32Array(w * h);
		let label = 0;
		for (let i = 0; i < labels.length; i++)
			if (data[i] && !labels[i]) {
				const queue = [i];
				labels[i] = ++label;
				for (let j = 0; j < queue.length; j++)
					for (const n of adjacent(queue[j]))
						if (n >= 0 && data[n] && !labels[n]) {
							labels[n] = label;
							queue.push(n);
						}
			}
		return labels;
	};
	const exposed = components(
			destination.data.map((v, i) => (v && nav.data[i] ? 1 : 0)),
		),
		connected = components(nav.data);
	const groups = new Map<number, Map<number, number>>();
	for (let i = 0; i < exposed.length; i++)
		if (exposed[i] && connected[i]) {
			let group = groups.get(connected[i]);
			if (!group) {
				group = new Map();
				groups.set(connected[i], group);
			}
			if (!group.has(exposed[i])) group.set(exposed[i], i);
		}
	const point = (i: number) => ({
		x: (((i % w) + 0.5) * 1920) / w,
		y: ((Math.floor(i / w) + 0.5) * 1080) / h,
	});
	const links: FloorLink[] = [];
	for (const group of groups.values()) {
		const cells = [...group.values()];
		for (const i of cells.slice(1))
			links.push({ from: point(cells[0]), to: point(i) });
	}
	return links;
}
