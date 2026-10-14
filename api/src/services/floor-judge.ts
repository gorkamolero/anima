import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { generateObject } from "ai";
import { z } from "zod";
import { imagePath, ROOT } from "../lib/backgrounds.js";
import { getModel } from "../lib/model.js";
import { reserveCall } from "./costs.js";
import type { GroundData, GroundVerdict, Raster } from "./ground.js";

/** Outlines are sampled on the floor grid; a one-cell (8-neighbour) erosion
 * tolerates segmentation fringes. Rejections remove the full outline, never a box. */
export interface FloorOutline {
	name: string;
	mask: Raster;
	bounds: number[];
	environment: boolean;
}
export function outlineOverlap(floor: Raster, mask: Raster) {
	if (floor.width !== mask.width || floor.height !== mask.height)
		throw new Error("Outline grid mismatch");
	let pixels = 0,
		covered = 0;
	for (let y = 1; y < mask.height - 1; y++)
		for (let x = 1; x < mask.width - 1; x++) {
			let interior = true;
			for (let dy = -1; dy <= 1; dy++)
				for (let dx = -1; dx <= 1; dx++)
					if (!mask.data[(y + dy) * mask.width + x + dx]) interior = false;
			if (!interior) continue;
			pixels++;
			if (floor.data[y * floor.width + x]) covered++;
		}
	const fraction = pixels ? covered / pixels : 0;
	return { pixels, covered, fraction, pass: fraction <= 0.2 };
}
const canonical = (name: string) =>
	name.toLowerCase().replace(/-\d+$/, "").replaceAll("-", " ");
export function hasOutline(object: FloorObject, outlines: FloorOutline[]) {
	return outlines.some((outline) => {
		if (canonical(object.name) === canonical(outline.name)) return true;
		const [a, b, c, d] = object.bounds,
			[x, y, z, w] = outline.bounds;
		const intersection =
			Math.max(0, Math.min(c, z) - Math.max(a, x)) *
			Math.max(0, Math.min(d, w) - Math.max(b, y));
		const union = (c - a) * (d - b) + (z - x) * (w - y) - intersection;
		return union > 0 && intersection / union >= 0.5;
	});
}
/** Interaction labels and segmenter class names can differ (including plural
 * classes). Resolve vocabulary only; the model never judges outlined pixels. */
async function outlineLabels(
	objects: FloorObject[],
	outlines: FloorOutline[],
): Promise<FloorObject[]> {
	const pending = objects.filter((o) => !hasOutline(o, outlines));
	if (!pending.length || !outlines.length) return objects;
	const classes = [
		...new Set(
			outlines.map((o) =>
				canonical(o.name.replace(/\.clean$/, "").replace(/^sized-v1-/, "")),
			),
		),
	];
	const input = { labels: pending.map((o) => o.name), classes };
	const hash = createHash("sha256")
		.update("outline-labels-v1")
		.update(JSON.stringify(input))
		.digest("hex");
	const path = resolve(
		ROOT,
		"api/data/perception",
		`${hash}-outline-labels.json`,
	);
	const cached = await readFile(path, "utf8").catch(() => null);
	if (!cached) reserveCall("perception");
	const mapping: {
		matches: Array<{
			label: string;
			outlineClass: string | null;
			environment: boolean;
		}>;
	} = cached
		? JSON.parse(cached)
		: (
				await generateObject({
					model: getModel(),
					mode: "json",
					temperature: 0,
					schema: z.object({
						matches: z.array(
							z.object({
								label: z.string(),
								outlineClass: z.string().nullable(),
								environment: z.boolean(),
							}),
						),
					}),
					prompt: `Match interaction labels to synonymous segmentation classes. Use only an exact supplied class string, or null when uncertain. Ignore positional modifiers. Do not match merely related objects (a lamp is not a crate). environment=true only for sky, sunlight, clouds, walls or water; never for solid props. This is a vocabulary task, NOT a floor safety judgment. ${JSON.stringify(input)}`,
				})
			).object;
	if (!cached) {
		await mkdir(dirname(path), { recursive: true });
		await writeFile(path, JSON.stringify(mapping));
	}
	return objects.filter((o) => {
		const match = mapping.matches.find((m) => m.label === o.name);
		if (match?.environment && outlines.some((m) => m.environment)) return false;
		if (
			match?.outlineClass &&
			classes.includes(match.outlineClass) &&
			outlines.some((outline) => {
				if (
					outline.name.startsWith("sized-v1-") ||
					canonical(outline.name.replace(/\.clean$/, "")) !== match.outlineClass
				)
					return false;
				const [a, b, c, d] = o.bounds,
					[x, y, z, w] = outline.bounds;
				const intersection =
					Math.max(0, Math.min(c, z) - Math.max(a, x)) *
					Math.max(0, Math.min(d, w) - Math.max(b, y));
				return (
					intersection > 0.2 * Math.min((c - a) * (d - b), (z - x) * (w - y))
				);
			})
		)
			return false;
		return true;
	});
}
export async function floorOutlines(
	image: string,
	floor: Raster,
): Promise<FloorOutline[]> {
	const source = imagePath(image);
	const hash = createHash("sha256")
		.update(await readFile(source))
		.digest("hex");
	const root = resolve(ROOT, "api/data/perception");
	const names = (await readdir(root)).filter(
		(n) =>
			(n.startsWith(`${hash}-obstacle-`) && n.endsWith(".png")) ||
			(n.startsWith(`${hash}-floor-`) &&
				/-(water|sea|wall|walls)\.png$/.test(n)),
	);
	const outlines: FloorOutline[] = [];
	const add = (name: string, args: string[]) => {
		const bytes = execFileSync(
			"magick",
			[
				...args,
				"-resize",
				`${floor.width}x${floor.height}!`,
				"-depth",
				"8",
				"gray:-",
			],
			{ maxBuffer: 8 * 1024 * 1024 },
		);
		const data = Array.from(bytes, (v) => (v > 32 ? 1 : 0));
		let x0 = floor.width,
			y0 = floor.height,
			x1 = -1,
			y1 = -1;
		data.forEach((v, i) => {
			if (v) {
				const x = i % floor.width,
					y = Math.floor(i / floor.width);
				x0 = Math.min(x0, x);
				x1 = Math.max(x1, x);
				y0 = Math.min(y0, y);
				y1 = Math.max(y1, y);
			}
		});
		if (x1 < 0) return;
		outlines.push({
			name,
			mask: { ...floor, data },
			bounds: [
				x0 / floor.width,
				y0 / floor.height,
				(x1 + 1) / floor.width,
				(y1 + 1) / floor.height,
			],
			environment: /\b(water|sea|wall|walls)\b/.test(canonical(name)),
		});
	};
	for (const name of names)
		add(
			name
				.replace(`${hash}-obstacle-`, "")
				.replace(`${hash}-floor-`, "")
				.replace(/\.png$/, ""),
			[resolve(root, name), "-colorspace", "gray"],
		);
	const segmented = await readFile(
		source.replace(/\.png$/, ".occluders.json"),
		"utf8",
	).catch(() => null);
	if (segmented)
		for (const o of JSON.parse(segmented) as Array<{
			label: string;
			png: string;
			bbox: { x: number; y: number; w: number; h: number };
		}>)
			add(o.label, [
				"-size",
				"1920x1080",
				"xc:none",
				"(",
				resolve(dirname(source), o.png),
				"-resize",
				`${o.bbox.w}x${o.bbox.h}!`,
				")",
				"-geometry",
				`+${o.bbox.x}+${o.bbox.y}`,
				"-composite",
				"-alpha",
				"extract",
			]);
	return outlines;
}

export const FALSE_WALKABLE_THRESHOLD = 0.6;
export type {
	FloorObject,
	FloorQuestion,
	FloorQuestions,
} from "@anima/footfall/derive/types";

import type { FloorObject, FloorQuestions } from "@anima/footfall/derive/types";
export function floorQuestions(
	objects: FloorObject[],
	ground?: GroundData,
	outlines: FloorOutline[] = [],
): FloorQuestions {
	const questions: FloorQuestions = {};
	for (const [i, object] of objects.entries()) {
		if (hasOutline(object, outlines)) continue;
		const [x0, y0, x1, y1] = object.bounds;
		if (
			ground &&
			!ground.floor.data.some(
				(v, j) =>
					v &&
					((j % ground.floor.width) + 0.5) / ground.floor.width >= x0 &&
					((j % ground.floor.width) + 0.5) / ground.floor.width <= x1 &&
					(Math.floor(j / ground.floor.width) + 0.5) / ground.floor.height >=
						y0 &&
					(Math.floor(j / ground.floor.width) + 0.5) / ground.floor.height <=
						y1,
			)
		)
			continue;
		const standable =
			/^(?:(?:wooden|stone|cobblestone|cobbled|central|left|right|front|back) )*(?:dock|deck|floor|ground|street|road|rug|carpet|stairs|steps|aisle|plaza|pavement|porch)$/.test(
				object.name.toLowerCase(),
			);
		questions[`object_${i}`] = {
			advisory: standable,
			type: "noul",
			bounds: object.bounds,
			instructions: standable
				? `Is the standable surface "${object.name}" marked walkable in GREEN? This is a coverage note, not a hazard.`
				: `Is the physical area of the labelled object "${object.name}" at normalized bounds [${object.bounds.join(", ")}] marked walkable in GREEN where a person cannot stand? Judge the object silhouette, not surrounding floor inside its bounding box. Walkable floor, docks, decks, rugs and exposed stair treads are valid. Grey or black pixels are NOT green; floor next to or beneath the object is not object inclusion.`,
			criteria: standable
				? {
						true: "Standable surface is marked green",
						false: "Standable surface is omitted",
					}
				: {
						true: "Green covers the non-walkable object itself",
						false: "Object itself is excluded, or is a standable floor surface",
					},
		};
	}
	if (!outlines.some((o) => o.environment))
		questions.environment = {
			type: "noul",
			instructions:
				"Does GREEN cover water, sky or walls? Only green pixels count; missing floor is never an error.",
			criteria: {
				true: "Green includes water, sky or wall surfaces",
				false: "No green on water, sky or walls",
			},
		};
	return questions;
}
export function floorVerdict(
	questions: FloorQuestions,
	probabilities: Record<string, number>,
) {
	for (const name of Object.keys(questions)) {
		const p = probabilities[name];
		if (!Number.isFinite(p) || p < 0 || p > 1)
			throw new Error(`Invalid or missing probability: ${name}`);
	}
	const rejected = Object.keys(questions).filter(
		(k) =>
			questions[k].type === "noul" &&
			!questions[k].advisory &&
			probabilities[k] >= FALSE_WALKABLE_THRESHOLD,
	);
	return {
		pass: rejected.length === 0,
		why: rejected.length
			? `False walkable: ${rejected.map((k) => `${k}=${probabilities[k].toFixed(3)}`).join(", ")}`
			: "No false-walkable probability reaches 0.6; missing floor is allowed.",
		rejected,
	};
}
let imageUnsupported: string | undefined;
export async function asymmetricFloorJudge(
	overlay: string,
	objects: FloorObject[] = [],
	ground?: GroundData,
	referenceImage?: string,
): Promise<GroundVerdict> {
	const outlines =
		ground && referenceImage
			? await floorOutlines(referenceImage, ground.floor)
			: [];
	const deterministic = ground
		? outlines.map((o) => ({
				name: o.name,
				...outlineOverlap(ground.floor, o.mask),
			}))
		: [];
	const rejectedOutlines = outlines.filter((_, i) => !deterministic[i].pass);
	const exclusionMask =
		ground && rejectedOutlines.length
			? {
					...ground.floor,
					data: ground.floor.data.map((_, i) =>
						rejectedOutlines.some((o) => o.mask.data[i]) ? 1 : 0,
					),
				}
			: undefined;
	const questions = floorQuestions(
		await outlineLabels(objects, outlines),
		ground,
		outlines,
	);
	const bytes = await readFile(overlay);
	const reference = referenceImage
		? await readFile(imagePath(referenceImage))
		: undefined;
	const fingerprint = createHash("sha256")
		.update("asymmetric-v4-outline-arithmetic")
		.update(JSON.stringify(questions))
		.update(reference ?? "")
		.update(
			execFileSync("magick", [overlay, "-depth", "8", "rgb:-"], {
				maxBuffer: 12 * 1024 * 1024,
			}),
		)
		.digest("hex");
	const cache = resolve(
		ROOT,
		"api/data/perception",
		`${fingerprint}-asymmetric.json`,
	);
	const stored = await readFile(cache, "utf8").catch(() => null);
	let result: {
		probabilities: Record<string, number>;
		provider: string;
		fallbackReason?: string;
	};
	if (!Object.keys(questions).length)
		result = { probabilities: {}, provider: "deterministic-outlines" };
	else if (stored) result = JSON.parse(stored);
	else {
		try {
			if (imageUnsupported) throw new Error(imageUnsupported);
			reserveCall("decision");
			const response = await fetch(
				"https://openrouter.ai/api/alpha/decisions",
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						model: "openai/gpt-6-luna-decisions",
						questions: Object.fromEntries(
							Object.entries(questions).map(
								([k, { bounds: _bounds, advisory: _advisory, ...q }]) => [k, q],
							),
						),
						state: {
							instructions:
								"Inspect the attached image: grayscale background, bright GREEN walkable mask. Missing floor is safe. Return image-grounded probabilities.",
							image: {
								type: "image_url",
								image_url: {
									url: `data:image/png;base64,${bytes.toString("base64")}`,
								},
							},
						},
					}),
					signal: AbortSignal.timeout(60000),
				},
			);
			if (!response.ok) {
				// Never archive request data or credentials in errors.
				if ([400, 413, 415, 422].includes(response.status))
					imageUnsupported = `Decision image state rejected (HTTP ${response.status})`;
				throw new Error(
					`Decision image request failed (HTTP ${response.status})`,
				);
			}
			const payload = (await response.json()) as {
				answers: Record<string, { noul?: number; score?: number }>;
			};
			const probabilities = Object.fromEntries(
				Object.keys(questions).map((k) => [
					k,
					payload.answers?.[k]?.noul ??
						payload.answers?.[k]?.score ??
						Number.NaN,
				]),
			);
			floorVerdict(questions, probabilities);
			result = { probabilities, provider: "openai/gpt-6-luna-decisions" };
		} catch (error) {
			const fallbackReason =
				error instanceof Error
					? error.message
					: "Decision image state unavailable";
			// Separate calls prevent one object's answer from contaminating the others.
			const answers = await Promise.all(
				Object.entries(questions).map(async ([name, question]) => {
					reserveCall("perception");
					const { object } = await generateObject({
						model: getModel(),
						mode: "json",
						temperature: 0,
						schema:
							question.type === "score"
								? z.object({
										score: z.number().min(0).max(1),
										evidence: z.string(),
									})
								: z.object({
										yes: z.boolean(),
										confidence: z.number().min(0.5).max(1),
										evidence: z.string(),
									}),
						messages: [
							{
								role: "user",
								content: [
									{
										type: "text",
										text: `Inspect the image and answer ONLY this typed question. For noul give yes=true only when the forbidden inclusion actually exists (for advisory floor coverage, yes means covered); confidence is certainty in that yes/no answer. For score give the coverage fraction. First locate actual bright GREEN pixels on the named surface. Grayscale pixels are excluded. Adjacent green floor does not mean an object is green. Missing floor is safe. Docks, decks, streets, steps and rugs are standable. For a hazard report describe exactly which green pixels are on the forbidden surface. Question: ${JSON.stringify(question)}`,
									},
									...(reference
										? [
												{
													type: "text" as const,
													text: "First image: original artwork, to identify materials hidden by the opaque mask. Second image: mask overlay. Judge GREEN membership only in the second image. Compare the same coordinates in both. Identify the surface from the original artwork rather than guessing the material hidden by opaque green.",
												},
												{
													type: "image" as const,
													image: reference,
													mediaType: "image/png",
												},
											]
										: []),
									{ type: "image", image: bytes, mediaType: "image/png" },
								],
							},
						],
					});
					const answer = object as {
						score?: number;
						yes?: boolean;
						confidence?: number;
						evidence: string;
					};
					return {
						name,
						...answer,
						probability:
							question.type === "score"
								? (answer.score ?? Number.NaN)
								: answer.yes === true
									? (answer.confidence ?? Number.NaN)
									: answer.yes === false
										? 1 - (answer.confidence ?? Number.NaN)
										: Number.NaN,
					};
				}),
			);

			result = {
				probabilities: Object.fromEntries(
					answers.map((a) => [a.name, a.probability]),
				),
				provider: "google/gemini-2.5-flash",
				fallbackReason,
				...{ evidence: answers },
			};
		}
		floorVerdict(questions, result.probabilities);
		await mkdir(dirname(cache), { recursive: true });
		await writeFile(cache, JSON.stringify(result, null, 2));
	}
	const decision = floorVerdict(questions, result.probabilities);
	if (rejectedOutlines.length) {
		decision.pass = false;
		decision.rejected.push(
			...deterministic.filter((o) => !o.pass).map((o) => `outline:${o.name}`),
		);
		decision.why = `False walkable outline overlap (>20% after erosion): ${deterministic
			.filter((o) => !o.pass)
			.map((o) => `${o.name}=${o.fraction.toFixed(3)}`)
			.join(", ")}; ${decision.why}`;
	}
	const verdict = {
		...decision,
		deterministic,
		exclusionMask,
		...result,
		questions,
		question: JSON.stringify(questions),
		overlay,
		attempt: "asymmetric-floor",
		answer: decision.pass ? "yes" : "no",
		reason: decision.why,
	};
	await writeFile(
		overlay.replace(/\.png$/, "-probabilities.json"),
		JSON.stringify(verdict, null, 2),
	);
	return verdict;
}
export async function labelledFloorObjects(
	image: string,
): Promise<FloorObject[]> {
	const text = await readFile(
		imagePath(image).replace(/\.png$/, ".interactables.json"),
		"utf8",
	).catch(() => null);
	const objects: FloorObject[] = text ? JSON.parse(text).interactables : [];
	const segmented = await readFile(
		imagePath(image).replace(/\.png$/, ".occluders.json"),
		"utf8",
	).catch(() => null);
	if (segmented)
		for (const o of JSON.parse(segmented) as Array<{
			label: string;
			bbox: { x: number; y: number; w: number; h: number };
		}>) {
			const bounds = [
				o.bbox.x / 1920,
				o.bbox.y / 1080,
				(o.bbox.x + o.bbox.w) / 1920,
				(o.bbox.y + o.bbox.h) / 1080,
			];
			const canonical = (name: string) =>
				name.toLowerCase().replace(/-\d+$/, "").replaceAll("-", " ");
			const existing = objects.find(
				(v) => canonical(v.name) === canonical(o.label),
			);
			if (existing) existing.bounds = bounds;
			else objects.push({ name: o.label, bounds });
		}
	return objects;
}

/** Localize only an already rejected hazard, for conservative subtraction.
 * This does not reconsider or override its probability. */
export async function locateFloorHazards(
	verdict: GroundVerdict,
): Promise<void> {
	if (
		verdict.pass ||
		!verdict.overlay ||
		!(verdict.rejected ?? []).some((k) => !verdict.questions?.[k]?.bounds)
	)
		return;
	const question = `Locate the suspected non-standable surfaces cited by these failed floor checks. Return normalized [x0,y0,x1,y1] bounding boxes tightly containing the suspected objects or water/wall/sky patches. The boxes will ONLY REMOVE green floor. Include the entire suspected object, not surrounding safe floor. Do not change the verdict. Rejected checks: ${JSON.stringify((verdict.rejected ?? []).map((k) => ({ question: verdict.questions?.[k], name: k })))}. Evidence: ${JSON.stringify((verdict as GroundVerdict & { evidence?: unknown }).evidence)}`;
	const { object } = await generateObject({
		model: getModel(),
		mode: "json",
		temperature: 0,
		schema: z.object({
			bounds: z.array(z.array(z.number().min(0).max(1)).length(4)).max(12),
			reason: z.string(),
		}),
		messages: [
			{
				role: "user",
				content: [
					{ type: "text", text: question },
					{
						type: "image",
						image: await readFile(verdict.overlay),
						mediaType: "image/png",
					},
				],
			},
		],
	});
	verdict.hazardBounds = object.bounds.filter(
		([x0, y0, x1, y1]) => x1 > x0 && y1 > y0,
	);
	await writeFile(
		verdict.overlay.replace(/\.png$/, "-localization.json"),
		JSON.stringify({ question, ...object }, null, 2),
	);
}
