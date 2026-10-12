import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { generateObject } from "ai";
import { z } from "zod";
import { imagePath, ROOT } from "../lib/backgrounds.js";
import { getModel } from "../lib/model.js";
import type { GroundData, GroundVerdict } from "./ground.js";

export const FALSE_WALKABLE_THRESHOLD = 0.6;
export interface FloorObject {
	name: string;
	bounds: number[];
}
export interface FloorQuestion {
	type: "noul" | "score";
	instructions: string;
	criteria: Record<string, string> | string[];
	bounds?: number[];
	advisory?: boolean;
}
export type FloorQuestions = Record<string, FloorQuestion>;
export function floorQuestions(
	objects: FloorObject[],
	ground?: GroundData,
): FloorQuestions {
	const questions: FloorQuestions = {};
	for (const [i, object] of objects.entries()) {
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
	questions.environment = {
		type: "noul",
		instructions:
			"Does GREEN cover water, sky or walls? Only green pixels count; missing floor is never an error.",
		criteria: {
			true: "Green includes water, sky or wall surfaces",
			false: "No green on water, sky or walls",
		},
	};
	questions.obstacles = {
		type: "noul",
		instructions:
			"Does GREEN cover any non-standable furniture, counters, pews, crates, barrels, nets, fences, posts, railings or other obstacles, including unlabelled ones? Ignore missing floor and intentional clearance margins.",
		criteria: {
			true: "Green covers an obstacle itself",
			false: "Green excludes obstacles",
		},
	};
	questions.coverage = {
		type: "score",
		instructions:
			"Estimate the fraction of visible standable floor covered by GREEN, from 0 to 1. Missing floor is a coverage note only and never a rejection.",
		criteria: ["All visible standable floor is covered by green"],
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
let decisionCalls = 0;
let imageUnsupported: string | undefined;
export async function asymmetricFloorJudge(
	overlay: string,
	objects: FloorObject[] = [],
	ground?: GroundData,
): Promise<GroundVerdict> {
	const questions = floorQuestions(objects, ground);
	const bytes = await readFile(overlay);
	const fingerprint = createHash("sha256")
		.update("asymmetric-v3-signed-confidence")
		.update(JSON.stringify(questions))
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
	if (stored) result = JSON.parse(stored);
	else {
		try {
			if (imageUnsupported) throw new Error(imageUnsupported);
			if (decisionCalls >= 200)
				throw new Error("Decision call budget exhausted");
			decisionCalls++;
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
	const verdict = {
		...decision,
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
