import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, cp, mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fal } from "@fal-ai/client";
import { generateObject } from "ai";
import { z } from "zod";
import { imagePath, ROOT } from "../lib/backgrounds.js";
import { getModel } from "../lib/model.js";
import { recordCall, reserveCall } from "./costs.js";
import { derivationError } from "./derivation-errors.js";
import { fitPlane, type Raster } from "./ground.js";
import { scaleReferenceSchema } from "./ground-calibration.js";
import { reserveSegmentation } from "./occluders.js";
import { semanticCoastalScale } from "./semantic-scale.js";

export const DERIVATION_VERSION = 7;
const cacheRoot = resolve(ROOT, "api/data/perception");
export const proofRoot = resolve(ROOT, "tmp/walkqa/derivation");
export function proofDirectory(key: string): string {
	return resolve(proofRoot, key.replace(/[^a-zA-Z0-9_-]/g, "_"));
}
export function readRaster(path: string): Raster {
	const bytes = execFileSync(
		"magick",
		[
			path,
			"-resize",
			"192x108!",
			"-colorspace",
			"gray",
			"-depth",
			"8",
			"gray:-",
		],
		{ stdio: ["pipe", "pipe", "pipe"] },
	);
	return { width: 192, height: 108, data: [...bytes] };
}
export async function saveRaster(path: string, raster: Raster, binary = true) {
	execFileSync(
		"magick",
		[
			"-size",
			`${raster.width}x${raster.height}`,
			"-depth",
			"8",
			"gray:-",
			path,
		],
		{
			input: Buffer.from(raster.data.map((v) => (binary ? (v ? 255 : 0) : v))),
		},
	);
}
export function floorPrompts(description: string): string[] {
	const prompts = ["floor", "ground"];
	for (const [pattern, names] of [
		[/cobbl|plaza|square|stone|street/i, ["cobblestones", "pavement"]],
		[/pier|dock|board|wood|church|nave|lobby/i, ["wooden floor", "boards"]],
		[/carpet|rug|lobby/i, ["rug", "carpet"]],
		[/church|pew|aisle|grocery/i, ["aisle"]],
		[/step|stair|climb/i, ["steps", "stairs"]],
	] as const)
		if (pattern.test(description)) prompts.push(...names);
	return [...new Set(prompts)];
}
const point = z.object({
	x: z.number().min(0).max(1),
	y: z.number().min(0).max(1),
});
const guidanceSchema = z.object({
	reason: z.string(),
	horizonY: z.number().min(0).max(0.9),
	// Visible adult height at a reference foot position, used to normalize relative depth.
	referenceFootY: z.number().min(0.4).max(1),
	referenceHeight: z.number().min(0.08).max(0.65),
	scaleReference: scaleReferenceSchema.optional(),
	areas: z
		.array(
			z.object({
				label: z.string(),
				kind: z.enum(["floor", "stairs"]),
				polygon: z.array(point).min(3),
				seed: point,
			}),
		)
		.min(1)
		.max(12),
});
export type FloorGuidance = z.infer<typeof guidanceSchema>;
export function insidePolygon(
	x: number,
	y: number,
	polygon: Array<{ x: number; y: number }>,
): boolean {
	let inside = false;
	for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
		const a = polygon[i],
			b = polygon[j];
		if (
			a.y > y !== b.y > y &&
			x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x
		)
			inside = !inside;
	}
	return inside;
}
export function guidanceMask(
	guidance: FloorGuidance,
	kind?: "floor" | "stairs",
): Raster {
	return {
		width: 192,
		height: 108,
		data: Array.from({ length: 192 * 108 }, (_, i) =>
			guidance.areas.some(
				(a) =>
					(!kind || a.kind === kind) &&
					insidePolygon(
						((i % 192) + 0.5) / 192,
						(Math.floor(i / 192) + 0.5) / 108,
						a.polygon,
					),
			)
				? 1
				: 0,
		),
	};
}
/** Depth can extend a semantic seed only inside the visible-floor envelope.
 * It never expands blindly into equal-depth water, furniture or vertical walls. */
export function refineWithDepth(
	seed: Raster,
	depth: Raster,
	envelope: Raster,
	stairs: Raster,
): { mask: Raster; planeMask: Raster } {
	let support = {
		...seed,
		data: seed.data.map((v, i) => (v && !stairs.data[i] ? 1 : 0)),
	};
	let plane: ReturnType<typeof fitPlane>;
	let rejectionTolerance = 30;
	try {
		plane = fitPlane(support, depth);
		for (let iteration = 0; iteration < 3; iteration++) {
			const residuals = support.data
				.flatMap((v, i) =>
					v
						? [
								Math.abs(
									depth.data[i] -
										((plane.a * (i % seed.width)) / seed.width +
											(plane.b * Math.floor(i / seed.width)) / seed.height +
											plane.c),
								),
							]
						: [],
				)
				.sort((a, b) => a - b);
			const tolerance = Math.max(
				8,
				(residuals[Math.floor(residuals.length * 0.5)] ?? 8) * 3,
			);
			rejectionTolerance = Math.max(30, tolerance * 2);
			support = {
				...support,
				data: support.data.map((v, i) =>
					v &&
					Math.abs(
						depth.data[i] -
							((plane.a * (i % seed.width)) / seed.width +
								(plane.b * Math.floor(i / seed.width)) / seed.height +
								plane.c),
					) <= tolerance
						? 1
						: 0,
				),
			};
			plane = fitPlane(support, depth);
		}
	} catch {
		return {
			mask: {
				...seed,
				data: [...seed.data],
			},
			planeMask: { ...seed, data: seed.data.map(() => 0) },
		};
	}
	const planeMask = {
		...seed,
		data: seed.data.map((_, i) => {
			const predicted =
				(plane.a * (i % seed.width)) / seed.width +
				(plane.b * Math.floor(i / seed.width)) / seed.height +
				plane.c;
			return envelope.data[i] &&
				!stairs.data[i] &&
				Math.abs(depth.data[i] - predicted) < 12
				? 1
				: 0;
		}),
	};
	const mask = {
		...seed,
		data: seed.data.map((v, i) => {
			if (v) {
				const predicted =
					(plane.a * (i % seed.width)) / seed.width +
					(plane.b * Math.floor(i / seed.width)) / seed.height +
					plane.c;
				return stairs.data[i] ||
					Math.abs(depth.data[i] - predicted) <= rejectionTolerance
					? 1
					: 0;
			}
			if (!planeMask.data[i]) return 0;
			const x = i % seed.width,
				y = Math.floor(i / seed.width);
			// Fill only an enclosed gap up to six pixels across, never grow the floor
			// boundary toward water/walls with the same relative depth.
			const hit = (dx: number, dy: number) =>
				[1, 2, 3].some(
					(d) =>
						x + dx * d >= 0 &&
						x + dx * d < seed.width &&
						y + dy * d >= 0 &&
						y + dy * d < seed.height &&
						seed.data[(y + dy * d) * seed.width + x + dx * d],
				);
			return hit(-1, 0) && hit(1, 0) && hit(0, -1) && hit(0, 1) ? 1 : 0;
		}),
	};
	return { mask, planeMask };
}
export async function perceiveFloor(
	image: string,
	description = "",
	key = "scene",
) {
	const bytes = await readFile(imagePath(image));
	const hash = createHash("sha256").update(bytes).digest("hex");
	const semanticScale = await semanticCoastalScale(bytes, description);
	const out = proofDirectory(key);
	await mkdir(out, { recursive: true });
	await mkdir(cacheRoot, { recursive: true });
	const cache = resolve(cacheRoot, `${hash}-floor-v${DERIVATION_VERSION}.json`);
	const cached = await readFile(cache, "utf8").catch(() => null);
	const previous =
		cached &&
		JSON.parse(cached).description === description &&
		!JSON.parse(cached).warnings?.length
			? cached
			: null;
	if (previous) {
		const result = JSON.parse(previous) as {
			mask: Raster;
			depth: Raster;
			guidance: FloorGuidance;
			stairMask?: Raster;
			artifactsDirectory?: string;
		};
		if (semanticScale) {
			Object.assign(result.guidance, semanticScale);
			await writeFile(cache, JSON.stringify(result));
		}
		if (result.artifactsDirectory && result.artifactsDirectory !== out)
			await cp(result.artifactsDirectory, out, { recursive: true });
		await saveRaster(resolve(out, "final-mask.png"), result.mask);
		return result;
	}
	const guidancePath = resolve(cacheRoot, `${hash}-floor-guidance-v3.json`);
	const storedGuidance = await readFile(guidancePath, "utf8").catch(() => null);
	let guidance: FloorGuidance;
	if (storedGuidance)
		guidance = guidanceSchema.parse(JSON.parse(storedGuidance));
	else {
		const question = `Identify the VISIBLE walkable floor in this adventure background. Description: ${description}. Give separate conservative normalized polygons for exposed floor passages and stair treads. Outline around furniture: NO pew seats, counters, pillars, fountain, railings, walls, sky or water. Include rugs as floor. Do not include hidden floor under objects. Concave polygons allowed; split into polygons around holes. Stair polygons must cover only the exposed walking strip, not banisters. Give a seed point on each visible floor area for segmentation. Estimate the camera horizon and an adult's plausible image height at referenceFootY using door/desk/pew proportions. Also provide scaleReference: a labelled visible known-height object, its tight normalized rect {x,y,width,height}, and realHeightM. Prefer the actual door opening, excluding frame, roof and porch. Never substitute the whole building. The object bottom is its ground position; adult scale will be computed from this measurement. All coordinates and heights normalized 0..1. These are conservative segmentation constraints, not hidden-floor predictions.`;
		const { object } = await generateObject({
			model: getModel(),
			mode: "json",
			schema: guidanceSchema,
			messages: [
				{
					role: "user",
					content: [
						{ type: "text", text: question },
						{ type: "image", image: bytes, mediaType: "image/png" },
					],
				},
			],
		});
		guidance = object;
		await writeFile(guidancePath, JSON.stringify(guidance, null, 2));
		await writeFile(resolve(out, "guidance-question.txt"), question);
	}
	if (semanticScale) Object.assign(guidance, semanticScale);
	await writeFile(
		resolve(out, "guidance.json"),
		JSON.stringify(guidance, null, 2),
	);
	const envelope = guidanceMask(guidance),
		stairs = guidanceMask(guidance, "stairs");
	await saveRaster(resolve(out, "semantic-envelope.png"), envelope);
	let upload: Promise<string> | undefined;
	const imageUrl = () => {
		upload ??= fal.storage.upload(new Blob([bytes], { type: "image/png" }));
		return upload;
	};
	const legacy = await readFile(
		resolve(cacheRoot, `${hash}.json`),
		"utf8",
	).catch(() => null);
	const union: Raster = {
		width: 192,
		height: 108,
		data: Array(192 * 108).fill(0),
	};
	if (legacy) {
		const old = JSON.parse(legacy) as { mask: Raster };
		if (old.mask.width === union.width && old.mask.height === union.height)
			union.data = [...old.mask.data];
		await saveRaster(resolve(out, "legacy-seed-mask.png"), union);
	}
	const steps: Array<{
		prompt: string;
		model: string;
		error?: string;
		count: number;
	}> = [];
	const exclusions = ["wall"];
	if (/square|fountain|plaza/i.test(description))
		exclusions.push("fountain", "lamp post");
	if (/pier|dock/i.test(description))
		exclusions.push("crates", "barrels", "nets", "posts");
	if (/lobby|pillar/i.test(description)) exclusions.push("pillars", "desk");
	if (/grocery|shelv/i.test(description))
		exclusions.push("shelves", "barrels", "sacks");
	if (/street|house.*step/i.test(description))
		exclusions.push("nets", "lamp post", "water", "sea");
	if (/pier|dock|sea|water/i.test(description)) exclusions.push("water");
	if (/pew|church/i.test(description)) exclusions.push("pews", "pulpit");
	if (/lobby|desk|grocery|counter/i.test(description))
		exclusions.push("counter");
	const excluded = { ...union, data: union.data.map(() => 0) };
	const stairMask = { ...union, data: union.data.map(() => 0) };
	if (/step|stair/i.test(description)) exclusions.push("railing");
	const labels = await readFile(
		imagePath(image).replace(/\.png$/, ".interactables.json"),
		"utf8",
	)
		.then((text) =>
			(
				JSON.parse(text) as { interactables: Array<{ name: string }> }
			).interactables
				.map((o) => o.name)
				.join(" "),
		)
		.catch(() => "");
	const prompts = floorPrompts(
		`${description} ${labels} ${guidance.areas.map((a) => a.label).join(" ")}`,
	);
	for (const prompt of [...prompts, ...exclusions]) {
		const slug = prompt.replaceAll(" ", "-");
		const path = resolve(cacheRoot, `${hash}-floor-${slug}.png`);
		let mask: Raster;
		try {
			mask = readRaster(path);
		} catch {
			try {
				const uploaded = await imageUrl();
				reserveCall("perception");
				reserveSegmentation(hash, `floor SAM3: ${prompt}`);
				const result = await fal.subscribe("fal-ai/sam-3/image", {
					input: {
						image_url: uploaded,
						prompt,
						apply_mask: false,
						return_multiple_masks: true,
						max_masks: 12,
					},
				});
				mask = { ...union, data: union.data.map(() => 0) };
				for (let i = 0; i < result.data.masks.length; i++) {
					const target = resolve(out, `${slug}-${i}.png`);
					await writeFile(
						target,
						Buffer.from(
							await (await fetch(result.data.masks[i].url)).arrayBuffer(),
						),
					);
					if (exclusions.includes(prompt))
						await copyFile(
							target,
							resolve(cacheRoot, `${hash}-obstacle-${slug}-${i}.png`),
						);
					readRaster(target).data.forEach((v, j) => {
						if (v > 127) mask.data[j] = 255;
					});
				}
				await saveRaster(path, mask, false);
			} catch (error) {
				steps.push({
					prompt,
					model: "sam3",
					error: derivationError(error),
					count: 0,
				});
				continue;
			}
		}
		await saveRaster(resolve(out, `${slug}-mask.png`), mask, false);
		steps.push({
			prompt,
			model: "sam3",
			count: mask.data.filter((v) => v > 127).length,
		});
		mask.data.forEach((v, i) => {
			if (v > 127) {
				(exclusions.includes(prompt) ? excluded : union).data[i] = 1;
				if (prompt === "steps" || prompt === "stairs") stairMask.data[i] = 1;
			}
		});
	}
	// Spatially prompted SAM2 is independent of SAM3's concept vocabulary.
	const covered = union.data.filter((v, i) => v && envelope.data[i]).length;
	if (covered < envelope.data.filter(Boolean).length * 0.6) {
		const [width, height] = execFileSync(
			"magick",
			["identify", "-format", "%w %h", imagePath(image)],
			{ encoding: "utf8" },
		)
			.trim()
			.split(" ")
			.map(Number);
		try {
			const path = resolve(out, "sam2-fallback.png");
			if (
				!(await readFile(path)
					.then(() => true)
					.catch(() => false))
			) {
				const uploaded = await imageUrl();
				reserveCall("perception");
				reserveSegmentation(hash, "floor SAM2 spatial fallback");
				const result = await fal.subscribe("fal-ai/sam2/image", {
					input: {
						image_url: uploaded,
						prompts: guidance.areas.map((a) => ({
							x: Math.round(a.seed.x * width),
							y: Math.round(a.seed.y * height),
							// FAL documents numeric labels; the bundled generated SDK uses strings.
							label: 1 as unknown as "1",
						})),
						apply_mask: false,
						output_format: "png",
					},
				});
				await writeFile(
					path,
					Buffer.from(await (await fetch(result.data.image.url)).arrayBuffer()),
				);
			}
			readRaster(path).data.forEach((v, i) => {
				if (v > 127 && envelope.data[i]) union.data[i] = 1;
			});
			steps.push({
				prompt: "spatial seeds",
				model: "sam2",
				count: union.data.filter(Boolean).length,
			});
		} catch (error) {
			steps.push({
				prompt: "spatial seeds",
				model: "sam2",
				count: 0,
				error: derivationError(error),
			});
		}
	}
	await saveRaster(resolve(out, "union-mask.png"), union);
	await writeFile(resolve(out, "steps.json"), JSON.stringify(steps, null, 2));
	const depthPath = resolve(cacheRoot, `${hash}-depth.png`);
	let depth: Raster;
	try {
		depth = readRaster(depthPath);
	} catch {
		const uploaded = await imageUrl();
		reserveCall("perception");
		reserveSegmentation(hash, "depth-anything/v2");
		const result = await fal.subscribe(
			"fal-ai/image-preprocessors/depth-anything/v2",
			{ input: { image_url: uploaded } },
		);
		await writeFile(
			depthPath,
			Buffer.from(await (await fetch(result.data.image.url)).arrayBuffer()),
		);
		depth = readRaster(depthPath);
	}
	await saveRaster(resolve(out, "depth.png"), depth, false);
	// If semantic segmentation is empty, the conservative visible-floor envelope
	// seeds depth fitting. A valid plane is still necessary to recover any pixels.
	const seed = union.data.some(Boolean)
		? union
		: guidanceMask(guidance, "floor");
	const refined = refineWithDepth(seed, depth, envelope, stairs);
	if (!union.data.some(Boolean)) refined.mask = refined.planeMask;
	refined.mask.data = refined.mask.data.map((v, i) =>
		v && !excluded.data[i] ? 1 : 0,
	);
	await saveRaster(resolve(out, "excluded-mask.png"), excluded);
	await saveRaster(resolve(out, "depth-plane-mask.png"), refined.planeMask);
	await saveRaster(resolve(out, "pre-clearance-mask.png"), refined.mask);
	refined.mask = erodeFloor(refined.mask);
	await saveRaster(resolve(out, "final-mask.png"), refined.mask);
	const result = {
		mask: refined.mask,
		stairMask: {
			...stairMask,
			data: stairMask.data.map((v, i) => (v && refined.mask.data[i] ? 1 : 0)),
		},
		description,
		artifactsDirectory: out,
		depth,
		guidance,
		warnings: steps
			.filter((s) => s.error)
			.map((s) => `${s.model} ${s.prompt}: ${s.error}`),
	};
	await writeFile(cache, JSON.stringify(result));
	recordCall("perception-v3", 0);
	return result;
}

/** One-cell safety margin excludes mixed floor/obstacle pixels after reduction.
 * Preserve the image border so real floor-connected edge exits remain possible. */
export function erodeFloor(mask: Raster): Raster {
	return {
		...mask,
		data: mask.data.map((v, i) => {
			if (!v) return 0;
			const x = i % mask.width,
				y = Math.floor(i / mask.width);
			return [
				[-1, 0],
				[1, 0],
				[0, -1],
				[0, 1],
			].every(
				([dx, dy]) =>
					x + dx < 0 ||
					x + dx >= mask.width ||
					y + dy < 0 ||
					y + dy >= mask.height ||
					mask.data[(y + dy) * mask.width + x + dx],
			)
				? 1
				: 0;
		}),
	};
}
