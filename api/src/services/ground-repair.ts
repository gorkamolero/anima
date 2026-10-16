import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { imagePath, ROOT } from "../lib/backgrounds.js";
import { isFloorCovering } from "./floor-surfaces.js";
import type { GroundData, GroundVerdict, Raster } from "./ground.js";
import { safeGroundLine } from "./ground-line.js";
import { readRaster } from "./ground-perception.js";

/** Subtraction only. Region membership and the legacy line follow the new floor. */
export function replaceFloor(ground: GroundData, floor: Raster) {
	ground.floor = floor;
	if (ground.walkArea) ground.walkArea.mask = floor;
	ground.regions = ground.regions
		?.map((r) => ({
			...r,
			mask: {
				...r.mask,
				data: r.mask.data.map((v, i) => (v && floor.data[i] ? 1 : 0)),
			},
		}))
		.filter((r) => r.mask.data.some(Boolean));
	ground.groundLine.points = safeGroundLine(
		floor,
		ground.horizonY,
		ground.scaleSlope,
		0.62,
	);
	const xs = ground.groundLine.points.map((p) => p.x);
	ground.freeWalkRanges = [{ minX: Math.min(...xs), maxX: Math.max(...xs) }];
	ground.freeWalkBounds = {
		...ground.freeWalkBounds,
		...ground.freeWalkRanges[0],
	};
}
/** A localization box is a search hint, never an exclusion. Only segmented
 * object pixels may repair a rejection; unresolved hazards still fail closed. */
export function repairGround(
	ground: GroundData,
	verdict: GroundVerdict,
	objectMask: Raster | undefined = verdict.exclusionMask,
): boolean {
	if (!objectMask) return false;
	const floor = ground.floor;
	if (objectMask.width !== floor.width || objectMask.height !== floor.height)
		throw new Error("Object exclusion grid mismatch");
	const next = {
		...floor,
		data: floor.data.map((v, i) => (v && !objectMask.data[i] ? 1 : 0)),
	};
	const removed =
		floor.data.filter(Boolean).length - next.data.filter(Boolean).length;
	if (!removed) return false;
	replaceFloor(ground, next);
	ground.notes = [
		...(ground.notes ?? []),
		`Removed ${removed} segmented object cells after ${verdict.why}`,
	];
	return true;
}
export async function subtractCachedObstacles(
	image: string,
	floor: Raster,
): Promise<Raster> {
	const hash = createHash("sha256")
		.update(await readFile(imagePath(image)))
		.digest("hex");
	const root = resolve(ROOT, "api/data/perception");
	const names = (await readdir(root)).filter(
		(n) => n.startsWith(`${hash}-obstacle-`) && n.endsWith(".png"),
	);
	const excluded = new Uint8Array(floor.data.length);
	for (const name of names) {
		if (
			isFloorCovering(
				name.replace(`${hash}-obstacle-`, "").replace(/\.png$/, ""),
			)
		)
			continue;
		const mask = readRaster(resolve(root, name));
		// Resample to the destination grid. Legacy floors may use
		// 384x216; indexing a 192x108 obstacle directly corrupts those floors.
		for (let y = 0; y < floor.height; y++)
			for (let x = 0; x < floor.width; x++) {
				const mx = Math.min(
					mask.width - 1,
					Math.floor(((x + 0.5) * mask.width) / floor.width),
				);
				const my = Math.min(
					mask.height - 1,
					Math.floor(((y + 0.5) * mask.height) / floor.height),
				);
				if (mask.data[my * mask.width + mx] <= 32) continue;
				excluded[y * floor.width + x] = 1;
			}
	}
	const source = imagePath(image);
	const segmented = await readFile(
		source.replace(/\.png$/, ".occluders.json"),
		"utf8",
	).catch(() => null);
	if (segmented)
		for (const o of JSON.parse(segmented) as Array<{
			png: string;
			bbox: { x: number; y: number; w: number; h: number };
		}>) {
			const bytes = execFileSync(
				"magick",
				[
					"-size",
					"1920x1080",
					"xc:none",
					resolve(dirname(source), o.png),
					"-geometry",
					`+${o.bbox.x}+${o.bbox.y}`,
					"-composite",
					"-alpha",
					"extract",
					"-resize",
					`${floor.width}x${floor.height}!`,
					"-depth",
					"8",
					"gray:-",
				],
				{ maxBuffer: 8 * 1024 * 1024 },
			);
			bytes.forEach((v, i) => {
				if (v > 32) excluded[i] = 1;
			});
		}
	// Physical support clearance belongs to the baseline-depth footprint pass
	// after runtime bridging. Dilating whole silhouettes here erases floor
	// beside the tops of foreground objects and applies clearance twice.
	return {
		...floor,
		data: floor.data.map((v, i) => (v && !excluded[i] ? 1 : 0)),
	};
}
export function excludeUnscaledStairs(ground: GroundData, stairs?: Raster) {
	if (!stairs) return;
	const floor = {
		...ground.floor,
		data: ground.floor.data.map((v, i) => (v && !stairs.data[i] ? 1 : 0)),
	};
	const removed =
		ground.floor.data.filter(Boolean).length -
		floor.data.filter(Boolean).length;
	if (removed) {
		replaceFloor(ground, floor);
		ground.notes = [
			...(ground.notes ?? []),
			`Excluded ${removed} stair cells: local scale does not supply tread-aware foot placement.`,
		];
	}
}
