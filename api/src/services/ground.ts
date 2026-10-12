import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import { scaleAt as perspectiveScaleAt } from "@anima/engine/walkarea/perspective";
import type { WalkArea } from "@anima/engine/walkarea/types";
import { generateObject } from "ai";
import { z } from "zod";
import { imagePath, PUBLIC } from "../lib/backgrounds.js";
import { getModel } from "../lib/model.js";
import { recordCall } from "./costs.js";
import { safeGroundLine } from "./ground-line.js";
import {
	DERIVATION_VERSION,
	perceiveFloor,
	proofDirectory,
} from "./ground-perception.js";
import { depthRegions } from "./ground-regions.js";
import {
	excludeUnscaledStairs,
	subtractCachedObstacles,
} from "./ground-repair.js";

export interface Raster {
	width: number;
	height: number;
	data: number[];
}
export interface GroundData {
	walkArea?: WalkArea;
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
	ground: "derived" | "inherited" | "failed";
	reason?: string;
	walkable?: boolean;
	travelEnabled?: boolean;
	regions?: GroundRegion[];
	overlays?: string[];
	derivationVersion?: number;
	verdicts: GroundVerdict[];
	notes?: string[];
}
export interface GroundVerdict {
	pass: boolean;
	why: string;
	question?: string;
	answer?: string;
	reason?: string;
	overlay?: string;
	attempt?: string;
	probabilities?: Record<string, number>;
	questions?: import("./floor-judge.js").FloorQuestions;
	rejected?: string[];
	hazardBounds?: number[][];
}
/** Regions use game coordinates (1920x1080). Intersect polygon AND mask.
 * scaleAtY is piecewise linear, clamped at endpoints; factors multiply baseScale.
 * Regions override the global perspective only inside their visible mask. */
export interface GroundRegion {
	id: string;
	kind: "floor" | "stairs";
	polygon: Array<{ x: number; y: number }>;
	mask: Raster;
	scaleAtY: Array<{ y: number; scaleFactor: number }>;
	interpolation: "linear";
	source: "relative-depth";
}
export function failedGround(
	reason: string,
	candidate?: GroundData,
): GroundData {
	const empty: Raster = {
		width: 192,
		height: 108,
		data: Array(192 * 108).fill(0),
	};
	return {
		...candidate,
		ground: "failed",
		reason,
		walkable: false,
		travelEnabled: false,
		derivationVersion: DERIVATION_VERSION,
		groundLine: { points: [], interpolation: "linear", clampToBounds: true },
		freeWalkBounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 },
		freeWalkRanges: [],
		floor: empty,
		walkArea: {
			mask: empty,
			perspective: { horizonY: 0, slope: 0, pixelsPerMetre: 300 },
			baseScale: 0.5,
			scaleClamp: { min: 0.18, max: 1.5 },
		},
		regions: [],
		horizonY: candidate?.horizonY ?? 0,
		scaleSlope: 0,
		baseScale: 0.5,
		verdicts: candidate?.verdicts ?? [],
	};
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
	return perspectiveScaleAt(
		{ horizonY, slope },
		{ x: 960, y },
		{ min: 0.05, max: Infinity },
	);
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
		// Reject thin floor fringes beside walls and props: they cannot hold a walking figure.
		if (bestEnd - bestStart < 12) continue;
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
		walkArea: {
			mask,
			perspective: { horizonY, slope, pixelsPerMetre: (0.5 * 1059) / 1.75 },
			baseScale: 0.5,
			scaleClamp: { min: 0.18, max: 1.5 },
		},
		floor: mask,
		horizonY,
		scaleSlope: slope,
		baseScale: 0.5,
		ground: "derived",
		derivationVersion: 2,
		verdicts: [],
	};
}
export async function perceive(image: string) {
	return perceiveFloor(image, "", basename(image, ".png"));
}
export async function deriveGround(
	image: string,
	template: "exterior" | "interior",
	fraction?: number,
	description = "",
	key = basename(image, ".png"),
): Promise<GroundData> {
	const perceived = await perceiveFloor(image, description, key);
	const { depth, guidance, stairMask } = perceived;
	const mask = await subtractCachedObstacles(image, perceived.mask);
	const horizonY = guidance.horizonY * 1080;
	const baseScale = 0.5;
	const referenceFactor =
		(guidance.referenceHeight * 1080) / (1059 * baseScale);
	const slope =
		referenceFactor / Math.max(100, guidance.referenceFootY * 1080 - horizonY);
	const data = maskToGround(
		mask,
		horizonY,
		slope,
		fraction ?? (template === "exterior" ? 0.62 : 0.5),
		5,
	);
	data.derivationVersion = DERIVATION_VERSION;
	data.walkable = true;
	data.travelEnabled = true;
	data.groundLine.points = safeGroundLine(
		mask,
		horizonY,
		slope,
		fraction ?? (template === "exterior" ? 0.62 : 0.5),
	);
	const minX = data.groundLine.points[0].x,
		maxX = data.groundLine.points[data.groundLine.points.length - 1].x;
	data.freeWalkBounds.minX = minX;
	data.freeWalkBounds.maxX = maxX;
	data.freeWalkRanges = [{ minX, maxX }];
	const referenceDepths = depth.data
		.filter(
			(_, i) =>
				mask.data[i] &&
				Math.abs(
					Math.floor(i / mask.width) / mask.height - guidance.referenceFootY,
				) < 0.07,
		)
		.sort((a, b) => a - b);
	const referenceDepth =
		referenceDepths[Math.floor(referenceDepths.length / 2)] ?? 200;
	data.regions = depthRegions(
		mask,
		depth,
		stairMask,
		referenceDepth,
		referenceFactor,
	);
	excludeUnscaledStairs(data, stairMask);
	return data;
}
export { asymmetricFloorJudge as judgeFloorOverlay } from "./floor-judge.js";
export async function judgeGround(
	image: string,
	data: GroundData,
	key = basename(image, ".png"),
): Promise<GroundVerdict[]> {
	const source = imagePath(image);
	const id = basename(source, ".png");
	const out = proofDirectory(key);
	const attempt = Date.now().toString();
	await mkdir(out, { recursive: true });
	const sprite = resolve(
		PUBLIC,
		"assets/sprites/hermes/hermes-idle-v2-normalized.png",
	);
	const verdicts = [];
	const sampleCount = Math.min(5, data.groundLine.points.length);
	for (let i = 0; i < sampleCount; i++) {
		const point =
			data.groundLine.points[
				Math.round(
					(0.1 + (0.8 * i) / Math.max(1, sampleCount - 1)) *
						(data.groundLine.points.length - 1),
				)
			];
		const scale = data.baseScale * point.scaleFactor;
		const path = resolve(
			out,
			`${id}-judge-${attempt}-${i}-${point.y.toFixed(0)}.png`,
		);
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
		const question =
			"Judge only the composited bespectacled man with a satchel: are the feet on visible walkable floor (including rugs or steps), and is the size plausible next to the surroundings? pass=true only if both. Ignore lack of contact shadow and foreground occlusion: this diagnostic has no shadow or occluder layers. Do not reject just for these rendering omissions. Reject feet actually on furniture/water/walls, or clearly incorrect size. Explain specific evidence.";
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
							text: question,
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
		const verdict = {
			...object,
			question,
			answer: object.pass ? "yes" : "no",
			reason: object.why,
			overlay: path,
			attempt,
		};
		await writeFile(
			path.replace(/\.png$/, ".json"),
			JSON.stringify(verdict, null, 2),
		);
		verdicts.push(verdict);
	}
	return verdicts;
}
