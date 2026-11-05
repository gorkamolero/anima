import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { Evaluation, ExperimentItemResult } from "@langfuse/client";
import { imagePath, PUBLIC, ROOT } from "./backgrounds.js";
import { floorOutlines, labelledFloorObjects, outlineLabels, type FloorOutline, type FloorObject } from "../services/floor-judge.js";
import { maskToGround, type GroundData, type GroundVerdict, type Raster } from "../services/ground.js";

export const DATASET_NAME = "anima-floor-places";
export const DATASET_DIRECTORY = resolve(ROOT, "api/data/langfuse-floor-places");
export interface JudgeInput {
	place: string;
	background: string;
	image: string;
	overlay: string;
	ground: GroundData;
	objects: FloorObject[];
	outlines: FloorOutline[];
}
export interface ExpectedFloor { pass: boolean; source: string; approvedBy: string; date: string }
export interface JudgeItem { id: string; input: JudgeInput; expectedOutput?: ExpectedFloor }
const hash = (input: string | Buffer) => createHash("sha256").update(input).digest("hex");

/** A review approves only this exact mask; a model's previous verdict is not a label. */
export function reviewedExpectation(record: { mask?: Raster; review?: { approvedBy?: string; date?: string }; audit?: string }, floor: Raster, source: string): ExpectedFloor | undefined {
	if (record.review?.approvedBy !== "reviewer" || !record.review.date || !Number.isFinite(Date.parse(record.review.date)) || JSON.stringify(record.mask) !== JSON.stringify(floor)) return undefined;
	return { pass: true, source, approvedBy: record.review.approvedBy, date: record.review.date };
}
export function agreement(output: GroundVerdict, expected?: ExpectedFloor): Evaluation[] {
	return expected ? [{ name: "floor_agreement", value: Number(output.pass === expected.pass), dataType: "BOOLEAN", comment: `${output.why}; reviewed expectation from ${expected.source}` }] : [];
}
export function aggregateFloorScores(items: ExperimentItemResult[]): Evaluation[] {
	const verdicts = items.filter((item) => typeof item.output?.pass === "boolean");
	const agreements = items.flatMap((item) => item.evaluations.filter((score) => score.name === "floor_agreement"));
	return [
		{ name: "floor_completion_rate", value: items.length ? verdicts.length / items.length : 0, dataType: "NUMERIC", comment: "Fraction of items with a completed verdict." },
		...(verdicts.length ? [{ name: "floor_pass_rate", value: verdicts.filter((item) => item.output.pass).length / verdicts.length, dataType: "NUMERIC" as const, comment: "Judge pass rate, not accuracy." }] : []),
		...(agreements.length ? [{ name: "floor_agreement_rate", value: agreements.reduce((sum, score) => sum + Number(score.value), 0) / agreements.length, dataType: "NUMERIC" as const, comment: `Agreement on ${agreements.length} reviewed inputs only.` }] : []),
	];
}

/** Local-only snapshot: SELECT cached places, read perception, composite existing pixels. */
export async function buildJudgeDataset(directory = DATASET_DIRECTORY): Promise<JudgeItem[]> {
	const manifest = resolve(directory, "items.json");
	const existing = await readFile(manifest, "utf8").catch(() => null);
	if (existing) {
		const items = JSON.parse(existing) as JudgeItem[];
		for (const item of items) {
			if (item.id !== hash(JSON.stringify({ input: item.input, expectedOutput: item.expectedOutput }))) throw new Error(`Frozen input changed: ${item.id}`);
		}
		return items;
	}
	const db = new DatabaseSync(resolve(ROOT, "api/data/world.db"), { readOnly: true });
	let places: Array<{ id: string; background: string; ground: GroundData }>;
	try { places = db.prepare("SELECT data FROM places ORDER BY id").all().map((row) => JSON.parse(String(row.data))); }
	finally { db.close(); }
	const perception = resolve(ROOT, "api/data/perception");
	const reviews: Array<{ source: string; mask: Raster; review: { approvedBy: string; date: string }; imageHash: string }> = [];
	for (const name of (await readdir(perception)).filter((n) => /-floor-v\d+\.json$/.test(n)).sort()) {
		const record = JSON.parse(await readFile(resolve(perception, name), "utf8"));
		if (reviewedExpectation(record, record.mask, `api/data/perception/${name}`)) reviews.push({ ...record, source: `api/data/perception/${name}`, imageHash: name.split("-floor-")[0] });
	}
	// Include reviewed anchors even when they are not a row in the places table.
	for (const folder of ["backgrounds", "generated"]) {
		for (const name of (await readdir(resolve(PUBLIC, folder))).filter((n) => /^[a-zA-Z0-9_-]+\.png$/.test(n)).sort()) {
			if (!reviews.length) break;
			const background = `/${folder}/${name}`;
			const imageHash = hash(await readFile(imagePath(background)));
			for (const review of reviews.filter((r) => r.imageHash === imageHash)) {
				places.unshift({ id: `reviewed-${imageHash}`, background, ground: maskToGround(review.mask, 300, 0.002) });
			}
		}
	}
	await mkdir(directory, { recursive: true });
	const items: JudgeItem[] = [];
	for (const place of places) {
		const floor = place.ground?.floor;
		if (!floor || !floor.data.some(Boolean)) continue;
		const image = await readFile(imagePath(place.background));
		const imageHash = hash(image);
		const outlines = await floorOutlines(place.background, floor);
		const objects = await outlineLabels(await labelledFloorObjects(place.background), outlines, true);
		const tint = execFileSync("magick", ["-size", `${floor.width}x${floor.height}`, "-depth", "8", "rgba:-", "-filter", "point", "-resize", "1920x1080!", "png:-"], { input: Buffer.from(floor.data.flatMap((v) => [0, 255, 0, v ? 255 : 0])), maxBuffer: 16 * 1024 * 1024 });
		const overlay = execFileSync("magick", [imagePath(place.background), "-resize", "1920x1080!", "-colorspace", "gray", "-colorspace", "sRGB", "png:-", "-composite", "png:-"], { input: tint, maxBuffer: 16 * 1024 * 1024 });
		// Input is self-contained; no live files or mutable perception are read during a run.
		const input: JudgeInput = { place: place.id, background: place.background, image: image.toString("base64"), overlay: overlay.toString("base64"), ground: { ...place.ground, verdicts: [], overlays: [] }, objects, outlines };
		const review = reviews.find((r) => r.imageHash === imageHash && reviewedExpectation(r, floor, r.source));
		const expectedOutput = review ? reviewedExpectation(review, floor, review.source) : undefined;
		const id = hash(JSON.stringify({ input, expectedOutput }));
		if (!items.some((item) => item.id === id)) items.push({ id, input, ...(expectedOutput ? { expectedOutput } : {}) });
	}
	await writeFile(manifest, JSON.stringify(items));
	return items;
}
