import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { fal } from "@fal-ai/client";
import { generateObject } from "ai";
import { z } from "zod";
import { imagePath, PUBLIC, ROOT } from "../lib/backgrounds.js";
import { getModel } from "../lib/model.js";
import { recordCall, reserveCall } from "./costs.js";

export interface Raster {
	width: number;
	height: number;
	data: number[];
}
export interface GroundData {
	groundLine: {
		points: Array<{ x: number; y: number; scaleFactor: number }>;
		interpolation: "linear";
		clampToBounds: boolean;
	};
	freeWalkBounds: { minX: number; maxX: number; minY: number; maxY: number };
	freeWalkRanges: Array<{ minX: number; maxX: number }>;
	floor: Raster;
	horizonY: number;
	scaleSlope: number;
	baseScale: number;
	ground: "derived" | "inherited";
	verdicts: Array<{ pass: boolean; why: string }>;
}
// Fit inverse depth = ax + by + c on segmented floor (least squares).
// Relative depth has an unknown shift: depthZero is calibrated once on anchors.
export function fitPlane(mask: Raster, depth: Raster, depthZero = 0) {
	const matrix = [
		[0, 0, 0, 0],
		[0, 0, 0, 0],
		[0, 0, 0, 0],
	];
	for (let y = 0; y < mask.height; y++)
		for (let x = 0; x < mask.width; x++) {
			if (!mask.data[y * mask.width + x]) continue;
			const value =
				depth.data[
					Math.floor((y * depth.height) / mask.height) * depth.width +
						Math.floor((x * depth.width) / mask.width)
				] - depthZero;
			if (!Number.isFinite(value)) continue;
			const row = [x / mask.width, y / mask.height, 1];
			for (let i = 0; i < 3; i++) {
				for (let j = 0; j < 3; j++) matrix[i][j] += row[i] * row[j];
				matrix[i][3] += row[i] * value;
			}
		}
	for (let i = 0; i < 3; i++) {
		let pivot = i;
		for (let j = i + 1; j < 3; j++)
			if (Math.abs(matrix[j][i]) > Math.abs(matrix[pivot][i])) pivot = j;
		[matrix[i], matrix[pivot]] = [matrix[pivot], matrix[i]];
		const divisor = matrix[i][i];
		if (Math.abs(divisor) < 1e-9) throw new Error("Degenerate floor plane");
		for (let k = i; k < 4; k++) matrix[i][k] /= divisor;
		for (let j = 0; j < 3; j++)
			if (j !== i) {
				const f = matrix[j][i];
				for (let k = i; k < 4; k++) matrix[j][k] -= f * matrix[i][k];
			}
	}
	const [a, b, c] = matrix.map((row) => row[3]);
	if (b <= 1e-6) throw new Error("Floor depth does not increase toward camera");
	return { a, b, c, horizonY: (-(c + a / 2) / b) * 1080 };
}
export function scaleAt(y: number, horizonY: number, slope: number): number {
	return Math.max(0.05, (y - horizonY) * slope);
}
export function maskToGround(
	mask: Raster,
	horizonY: number,
	slope: number,
	fraction = 0.55,
	smoothing = 5,
): GroundData {
	const columns: Array<{ x: number; top: number; bottom: number; y: number }> =
		[];
	for (let x = 0; x < mask.width; x++) {
		// Use the longest contiguous floor span; holes are never bridged vertically.
		let start = -1,
			bestStart = -1,
			bestEnd = -1;
		for (let y = 0; y <= mask.height; y++) {
			if (y < mask.height && mask.data[y * mask.width + x]) {
				if (start < 0) start = y;
			} else if (start >= 0) {
				if (y - start > bestEnd - bestStart) {
					bestStart = start;
					bestEnd = y - 1;
				}
				start = -1;
			}
		}
		if (bestEnd - bestStart < 4) continue;
		columns.push({
			x,
			top: bestStart,
			bottom: bestEnd,
			y: bestStart + (bestEnd - bestStart) * fraction,
		});
	}
	if (columns.length < 6) throw new Error("No walkable floor");
	const ranges: Array<{ minX: number; maxX: number }> = [];
	for (const column of columns) {
		const last = ranges.at(-1);
		if (last && column.x <= last.maxX + 1) last.maxX = column.x;
		else ranges.push({ minX: column.x, maxX: column.x });
	}
	const smooth = columns.map((column, i) => {
		const neighbours = columns
			.slice(Math.max(0, i - smoothing), i + smoothing + 1)
			.filter((p) => Math.abs(p.x - column.x) <= smoothing);
		return {
			...column,
			y: Math.max(
				column.top + 1,
				Math.min(
					column.bottom - 1,
					neighbours.reduce((s, p) => s + p.y, 0) / neighbours.length,
				),
			),
		};
	});
	const points = Array.from(
		{ length: 6 },
		(_, i) => smooth[Math.round((i * (smooth.length - 1)) / 5)],
	).map((p) => ({
		x: (p.x / mask.width) * 1920,
		y: (p.y / mask.height) * 1080,
		scaleFactor: scaleAt((p.y / mask.height) * 1080, horizonY, slope),
	}));
	return {
		groundLine: { points, interpolation: "linear", clampToBounds: true },
		freeWalkBounds: {
			minX: points[0].x,
			maxX: points.at(-1)?.x ?? 1920,
			minY: (Math.min(...columns.map((p) => p.top)) / mask.height) * 1080,
			maxY: (Math.max(...columns.map((p) => p.bottom)) / mask.height) * 1080,
		},
		freeWalkRanges: ranges.map((r) => ({
			minX: (r.minX / mask.width) * 1920,
			maxX: (r.maxX / mask.width) * 1920,
		})),
		floor: mask,
		horizonY,
		scaleSlope: slope,
		baseScale: 0.5,
		ground: "derived",
		verdicts: [],
	};
}
const cacheRoot = resolve(ROOT, "api/data/perception");
function raster(path: string): Raster {
	const bytes = execFileSync("magick", [
		path,
		"-resize",
		"192x108!",
		"-colorspace",
		"gray",
		"-depth",
		"8",
		"gray:-",
	]);
	return { width: 192, height: 108, data: [...bytes] };
}
export async function perceive(
	image: string,
): Promise<{ mask: Raster; depth: Raster }> {
	const bytes = await readFile(imagePath(image));
	const hash = createHash("sha256").update(bytes).digest("hex");
	await mkdir(cacheRoot, { recursive: true });
	const cache = resolve(cacheRoot, `${hash}.json`);
	const stored = await readFile(cache, "utf8").catch(() => null);
	if (stored) {
		recordCall("perception", 0, true);
		return JSON.parse(stored);
	}
	const imageUrl = await fal.storage.upload(
		new Blob([bytes], { type: "image/png" }),
	);
	reserveCall("perception");
	const start = Date.now();
	let segmentation = await fal.subscribe("fal-ai/sam-3/image", {
		input: {
			image_url: imageUrl,
			prompt: "floor / ground / road / pavement / sand / dock / boards",
			apply_mask: false,
			return_multiple_masks: true,
			max_masks: 8,
		},
	});
	recordCall("segmentation", Date.now() - start);
	if (!segmentation.data.masks.length) {
		reserveCall("perception");
		segmentation = await fal.subscribe("fal-ai/sam-3/image", {
			input: {
				image_url: imageUrl,
				prompt: "floor",
				apply_mask: false,
				return_multiple_masks: true,
				max_masks: 8,
			},
		});
	}
	const masks = segmentation.data.masks;
	if (!masks.length) throw new Error("SAM returned no floor mask");
	const union: Raster = {
		width: 192,
		height: 108,
		data: Array(192 * 108).fill(0),
	};
	for (let i = 0; i < masks.length; i++) {
		const path = resolve(cacheRoot, `${hash}-mask-${i}.png`);
		await writeFile(
			path,
			Buffer.from(await (await fetch(masks[i].url)).arrayBuffer()),
		);
		const m = raster(path);
		m.data.forEach((v, j) => {
			if (v > 127) union.data[j] = 1;
		});
	}
	reserveCall("perception");
	const depthStart = Date.now();
	const depthResult = await fal.subscribe(
		"fal-ai/image-preprocessors/depth-anything/v2",
		{ input: { image_url: imageUrl } },
	);
	recordCall("depth", Date.now() - depthStart);
	const depthPath = resolve(cacheRoot, `${hash}-depth.png`);
	await writeFile(
		depthPath,
		Buffer.from(await (await fetch(depthResult.data.image.url)).arrayBuffer()),
	);
	const result = { mask: union, depth: raster(depthPath) };
	await writeFile(cache, JSON.stringify(result));
	return result;
}
export async function deriveGround(
	image: string,
	template: "exterior" | "interior",
	fraction?: number,
): Promise<GroundData> {
	const { mask, depth } = await perceive(image);
	const plane = fitPlane(mask, depth, template === "exterior" ? -32.9 : 0);
	// ponytail: relative-depth shift is calibrated on the two anchor cameras, not metric depth.
	const horizonY = plane.horizonY;
	const slope = template === "exterior" ? 0.0019284 : 0.0039;
	const data = maskToGround(
		mask,
		horizonY,
		slope,
		fraction ?? (template === "exterior" ? 0.62 : 0.25),
		template === "exterior" ? 5 : 100,
	);
	data.baseScale = template === "exterior" ? 0.5 : 0.43;
	return data;
}
export async function judgeGround(
	image: string,
	data: GroundData,
): Promise<Array<{ pass: boolean; why: string }>> {
	const source = imagePath(image);
	const id = basename(source, ".png");
	const out = resolve(ROOT, "tmp/open-world-demo/ground-judges");
	await mkdir(out, { recursive: true });
	const sprite = resolve(
		PUBLIC,
		"assets/sprites/hermes/hermes-idle-v2-normalized.png",
	);
	const verdicts = [];
	for (let i = 0; i < 5; i++) {
		const point =
			data.groundLine.points[
				Math.round((i * (data.groundLine.points.length - 1)) / 4)
			];
		const scale = data.baseScale * point.scaleFactor;
		const path = resolve(out, `${id}-${i}-${point.y.toFixed(0)}.png`);
		execFileSync("magick", [
			source,
			"-resize",
			"1920x1080!",
			"(",
			sprite,
			"-crop",
			"612x1059+0+0",
			"+repage",
			"-resize",
			`${Math.round(612 * scale)}x${Math.round(1059 * scale)}!`,
			")",
			"-geometry",
			`+${Math.round(point.x - 306 * scale)}+${Math.round(point.y - 1059 * scale)}`,
			"-composite",
			path,
		]);
		const started = Date.now();
		const { object } = await generateObject({
			model: getModel(),
			mode: "json",
			schema: z.object({ pass: z.boolean(), why: z.string() }),
			messages: [
				{
					role: "user",
					content: [
						{
							type: "text",
							text: "Judge only the composited bespectacled man with a satchel: are the feet on the ground, and is the size plausible next to the surroundings? yes/no + why. pass=true only if both. Do not provide coordinates.",
						},
						{
							type: "image",
							image: await readFile(path),
							mediaType: "image/png",
						},
					],
				},
			],
		});
		recordCall("ground-judge", Date.now() - started);
		verdicts.push(object);
	}
	return verdicts;
}
