import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { imagePath, ROOT } from "../lib/backgrounds.js";
import type { GroundData, GroundVerdict, Raster } from "./ground.js";
import { safeGroundLine } from "./ground-line.js";
import { erodeFloor, readRaster } from "./ground-perception.js";

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
export function repairGround(
	ground: GroundData,
	verdict: GroundVerdict,
): boolean {
	let floor = { ...ground.floor, data: [...ground.floor.data] };
	const before = floor.data.filter(Boolean).length;
	const globalHazard = (verdict.rejected ?? []).some(
		(k) => !verdict.questions?.[k]?.bounds,
	);
	const boundsToRemove = verdict.hazardBounds?.length
		? verdict.hazardBounds
		: (globalHazard
				? Object.keys(verdict.questions ?? {}).filter(
						(k) =>
							verdict.questions?.[k]?.bounds && !verdict.questions[k].advisory,
					)
				: (verdict.rejected ?? [])
			).flatMap((k) =>
				verdict.questions?.[k]?.bounds
					? [verdict.questions[k].bounds as number[]]
					: [],
			);
	for (const bounds of boundsToRemove) {
		const padding = verdict.hazardBounds?.length ? 0.05 : 0;
		const [bx0, by0, bx1, by1] = bounds;
		const [x0, y0, x1, y1] = [
			bx0 - padding,
			by0 - padding,
			bx1 + padding,
			by1 + padding,
		];
		floor.data = floor.data.map((v, i) => {
			const x = ((i % floor.width) + 0.5) / floor.width,
				y = (Math.floor(i / floor.width) + 0.5) / floor.height;
			return x >= x0 && x <= x1 && y >= y0 && y <= y1 ? 0 : v;
		});
	}
	// An unlocalized hazard excludes all overlapping candidate obstacle boxes,
	// plus boundary clearance. Known standable labels are never subtraction targets.
	if (globalHazard) floor = erodeFloor(floor);
	if (floor.data.filter(Boolean).length === before) return false;
	replaceFloor(ground, floor);
	ground.notes = [
		...(ground.notes ?? []),
		`Conservatively removed ${before - floor.data.filter(Boolean).length} cells after ${verdict.why}`,
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
		const mask = readRaster(resolve(root, name));
		mask.data.forEach((v, i) => {
			if (v <= 32) return;
			const x = i % mask.width,
				y = Math.floor(i / mask.width);
			for (let dy = -1; dy <= 1; dy++)
				for (let dx = -1; dx <= 1; dx++)
					if (
						x + dx >= 0 &&
						x + dx < mask.width &&
						y + dy >= 0 &&
						y + dy < mask.height
					)
						excluded[(y + dy) * mask.width + x + dx] = 1;
		});
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
	return {
		...floor,
		data: floor.data.map((v, i) => (v && !excluded[i] ? 1 : 0)),
	};
}
export function excludeUnscaledStairs(ground: GroundData, stairs?: Raster) {
	if (!stairs) return;
	const scaled = new Uint8Array(ground.floor.data.length);
	for (const r of ground.regions ?? [])
		if (
			r.kind === "stairs" &&
			r.scaleAtY.length &&
			r.scaleAtY.every(
				(s) => Number.isFinite(s.scaleFactor) && s.scaleFactor > 0,
			)
		)
			r.mask.data.forEach((v, i) => {
				if (v) scaled[i] = 1;
			});
	const floor = {
		...ground.floor,
		data: ground.floor.data.map((v, i) =>
			v && (!stairs.data[i] || scaled[i]) ? 1 : 0,
		),
	};
	const removed =
		ground.floor.data.filter(Boolean).length -
		floor.data.filter(Boolean).length;
	if (removed) {
		replaceFloor(ground, floor);
		ground.notes = [
			...(ground.notes ?? []),
			`Excluded ${removed} stair cells without derived region scale.`,
		];
	}
}
