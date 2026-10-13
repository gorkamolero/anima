import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { appendFileSync, mkdirSync, readFileSync, rmdirSync } from "node:fs";
import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, resolve } from "node:path";
import {
	baselineYAt,
	classifyOccluder,
} from "@anima/engine/occlusion/occlusion";
import type { Perspective } from "@anima/engine/walkarea/perspective";
import { fal } from "@fal-ai/client";
import { imagePath, ROOT } from "../lib/backgrounds.js";
import { interactablesSchema } from "../routes/interactables.js";
import {
	deriveExits,
	type FloorRaster,
	floorAt,
	type LabelledBox,
	type Point,
} from "./exits.js";
import { DERIVATION_VERSION } from "./ground-perception.js";

export interface Occluder {
	id: string;
	label: string;
	bbox: { x: number; y: number; w: number; h: number };
	baseline: Point[];
	png: string;
	floorDecal?: boolean;
	obstacle?: boolean;
	heightMetres?: number;
	maskCoverage?: {
		referencePixels: number;
		retainedPixels: number;
		fraction: number;
	};
}
const MODEL = "fal-ai/sam2/image";
const VERSION = 22;
const cacheRoot = resolve(ROOT, "api/data/perception");
const proofRoot = resolve(ROOT, "tmp/walkqa");
const hashOf = (value: Buffer | string) =>
	createHash("sha256").update(value).digest("hex");
export async function cachedFloor(
	image: string,
): Promise<FloorRaster | undefined> {
	const hash = hashOf(await readFile(imagePath(image)));
	const cached = await readFile(
		resolve(cacheRoot, `${hash}-floor-v${DERIVATION_VERSION}.json`),
		"utf8",
	).catch(() =>
		readFile(resolve(cacheRoot, `${hash}.json`), "utf8").catch(() => null),
	);
	return cached
		? (JSON.parse(cached) as { mask: FloorRaster }).mask
		: undefined;
}
/** Explicit reviewed replacement for an anchor's cached floor, with immutable evidence. */
export async function replaceReviewedAnchorFloor(
	image: string,
	floor: FloorRaster,
	review: {
		approvedBy: "reviewer";
		date: string;
		overlays: string[];
		judgeDisagreement: unknown;
	},
): Promise<string> {
	if (
		review.approvedBy !== "reviewer" ||
		!Number.isFinite(Date.parse(review.date)) ||
		!review.overlays.length ||
		floor.data.length !== floor.width * floor.height ||
		!floor.data.some(Boolean)
	)
		throw new Error("Invalid reviewed anchor floor");
	const previous = await cachedFloor(image);
	if (!previous) throw new Error("Missing previous anchor floor");
	const hash = hashOf(await readFile(imagePath(image)));
	const overlays = await Promise.all(
		review.overlays.map(async (path) => ({
			path,
			sha256: hashOf(await readFile(path)),
		})),
	);
	const audit = resolve(
		proofRoot,
		`derivation/anchor-${hash}/replace-reviewed-${Date.now()}.json`,
	);
	await mkdir(resolve(proofRoot, `derivation/anchor-${hash}`), {
		recursive: true,
	});
	const record = { image, ...review, overlays, previous, candidate: floor };
	await writeFile(audit, JSON.stringify({ ...record, status: "started" }));
	await writeFile(
		resolve(cacheRoot, `${hash}-floor-v${DERIVATION_VERSION}.json`),
		JSON.stringify({ mask: floor, previous, review, audit }),
	);
	await writeFile(audit, JSON.stringify({ ...record, status: "complete" }));
	return audit;
}

/** Semantic shortlist only; SAM, never an LLM, supplies the pixels. */
export function canOcclude(object: LabelledBox): boolean {
	return (
		/\b(tree|post|pole|suitcase|crate|lamp|bench|car|van|bus|truck|corner|fence|gazebo|pergola|trap|net|fishnet|basket|barrel|statue|gargoyle|house|building|rock|boulder|pile|pew|pillar|column|fountain|desk|counter|shelf|shelves|pulpit)(?:s|es)?\b/i.test(
			object.name,
		) &&
		!/\b(sky|floor|ground|road|distant|horizon|window|sign)\b/i.test(
			object.name,
		)
	);
}
/** Record attempted requests BEFORE submitting, including failures. Cross-process lock
 * prevents concurrent routes from overspending the task's hard 120-call allowance. */
export function reserveSegmentation(key: string, label: string): void {
	mkdirSync(proofRoot, { recursive: true });
	const lock = resolve(proofRoot, "budget.lock");
	try {
		mkdirSync(lock);
	} catch {
		throw new Error("Segmentation budget busy; retry shortly");
	}
	try {
		const ledger = resolve(proofRoot, "calls.md");
		let previous = "";
		try {
			previous = readFileSync(ledger, "utf8");
		} catch {}
		const scope = ["04a", "04c", "07", "08", "09", "10", "10c", "21"].includes(
			process.env.DERIVATION_BRIEF ?? "",
		)
			? `${process.env.DERIVATION_BRIEF === "10c" ? "10" : process.env.DERIVATION_BRIEF} `
			: "";
		const limit =
			scope === "21 " || scope === "10 " || scope === "09 "
				? 30
				: scope === "08 "
					? 40
					: scope === "04c "
						? 20
						: scope === "07 "
							? 60
							: 120;
		const count = previous
			.split("\n")
			.filter(
				(line) =>
					new RegExp(`^\\| CALL ${scope}\\d+ \\|`).test(line) &&
					(scope || !line.startsWith("| CALL 04a ")),
			).length;
		if (count >= limit)
			throw new Error(
				`Occluder segmentation budget exhausted (${limit} calls)`,
			);
		if (!previous)
			appendFileSync(
				ledger,
				"# Occluder segmentation calls\n\nSAM 3.1, box prompts. Attempts reserved before submission; cache hits cost zero. Limit: 120.\n\n| Attempt | UTC | Cache key | Object |\n|---|---|---|---|\n",
			);
		appendFileSync(
			ledger,
			`| CALL ${scope}${count + 1} | ${new Date().toISOString()} | ${key} | ${label.replace(/[\n|]/g, " ")} |\n`,
		);
	} finally {
		rmdirSync(lock);
	}
}
/** Remove disconnected detections; one labelled box represents one prop. */
export function largestComponent(mask: FloorRaster): FloorRaster {
	const { width: w, height: h } = mask;
	const seen = new Uint8Array(w * h),
		queue = new Int32Array(w * h);
	let best: number[] = [];
	for (let seed = 0; seed < w * h; seed++) {
		if (seen[seed] || !mask.data[seed]) continue;
		let head = 0,
			tail = 1;
		queue[0] = seed;
		seen[seed] = 1;
		while (head < tail) {
			const n = queue[head++],
				x = n % w,
				y = Math.floor(n / w);
			for (const next of [
				x > 0 ? n - 1 : -1,
				x < w - 1 ? n + 1 : -1,
				y > 0 ? n - w : -1,
				y < h - 1 ? n + w : -1,
			]) {
				if (next >= 0 && !seen[next] && mask.data[next]) {
					seen[next] = 1;
					queue[tail++] = next;
				}
			}
		}
		if (tail > best.length) best = Array.from(queue.subarray(0, tail));
	}
	const data = new Array<number>(w * h).fill(0);
	for (const n of best) data[n] = 1;
	return { width: w, height: h, data };
}
export function maskGeometry(
	mask: FloorRaster,
	floor?: FloorRaster,
	supportFraction = 0.8,
	minimumFraction = 0.002,
	solidFront = false,
): { bbox: Occluder["bbox"]; baseline: Point[] } | undefined {
	const { width: w, height: h, data } = mask;
	let count = 0,
		minX = w,
		minY = h,
		maxX = -1,
		maxY = -1;
	const bottoms = new Map<number, number>();
	for (let y = 0; y < h; y++)
		for (let x = 0; x < w; x++)
			if (data[y * w + x]) {
				count++;
				minX = Math.min(minX, x);
				maxX = Math.max(maxX, x);
				minY = Math.min(minY, y);
				maxY = Math.max(maxY, y);
				bottoms.set(x, y);
			}
	if (count / (w * h) < minimumFraction || count / (w * h) > 0.35) return;
	const sx = 1920 / w,
		sy = 1080 / h;
	// Contact samples come from the lower supporting silhouette, not the canopy.
	const lower = [...bottoms.values()].sort((a, b) => a - b);
	const cutoff = lower[Math.floor(lower.length * 0.8)];
	const columns = [...bottoms].sort((a, b) => a[0] - b[0]);
	let support = columns.filter(
		([, y]) => y >= Math.max(cutoff, minY + (maxY - minY) * supportFraction),
	);
	if (floor) {
		const contact = columns.filter(
			([x, y]) =>
				y >= Math.max(cutoff, minY + (maxY - minY) * supportFraction) &&
				[1, 5, 10, 20, 40, 60].some((d) =>
					floorAt(floor, (x + 0.5) * sx, Math.min(1079, (y + 1) * sy + d)),
				),
		);
		// A clearance gap or missing floor must not erase an object mask.
		// Without floor contacts, retain its segmented supporting silhouette.
		if (contact.length) {
			// Coarse floor masks can miss an entire supporting leg. Preserve its
			// visible bottom rather than extending another leg's depth across it.
			const missing = columns.filter(
				([x, y]) =>
					y >= Math.max(cutoff, minY + (maxY - minY) * supportFraction) &&
					!contact.some(([cx]) => Math.abs(cx - x) * sx <= 40),
			);
			support = [...contact, ...missing].sort((a, b) => a[0] - b[0]);
		}
	}
	if (solidFront) support = columns;
	const baseline: Point[] = [];
	// Quantile buckets avoid inventing a contact point in the gap between bench legs.
	const stride = Math.max(1, Math.ceil(support.length / 6));
	for (let i = 0; i < support.length; i += stride) {
		const group = support.slice(i, i + stride);
		const xs = group.map((p) => p[0]).sort((a, b) => a - b);
		const contactX = xs[Math.floor(xs.length / 2)];
		const contactY = bottoms.get(contactX) ?? maxY;
		baseline.push({
			x: (xs[Math.floor(xs.length / 2)] + 0.5) * sx,
			y: (contactY + 1) * sy,
		});
	}
	return {
		bbox: {
			x: minX * sx,
			y: minY * sy,
			w: (maxX - minX + 1) * sx,
			h: (maxY - minY + 1) * sy,
		},
		baseline,
	};
}
/** SAM 2 spatial prompts avoid SAM 3's concept-union behavior for this art.
 * A reviewed crop-sheet response can populate the same image+box cache; its
 * response record retains both original and reviewed boxes for provenance. */
export async function segment(
	bytes: Buffer,
	object: LabelledBox,
	width: number,
	height: number,
): Promise<string | undefined> {
	const key = hashOf(
		`${hashOf(bytes)}:${MODEL}:${JSON.stringify(object.bounds)}`,
	);
	await mkdir(cacheRoot, { recursive: true });
	const responsePath = resolve(cacheRoot, `${key}.occlusion-response.json`);
	const maskPath = resolve(cacheRoot, `${key}.occlusion-mask.png`);
	const review = await readFile(responsePath, "utf8").catch(() => null);
	if (review && (JSON.parse(review) as { rejected?: string }).rejected)
		return undefined;
	if (
		await readFile(maskPath)
			.then(() => true)
			.catch(() => false)
	)
		return maskPath;
	const cached = await readFile(responsePath, "utf8").catch(() => null);
	let result: { image: { url: string } };
	if (cached) result = JSON.parse(cached);
	else {
		const [x0, y0, x1, y1] = object.bounds;
		const box = {
			x_min: Math.round(x0 * width),
			y_min: Math.round(y0 * height),
			x_max: Math.round(x1 * width),
			y_max: Math.round(y1 * height),
		};
		const imageUrl = await fal.storage.upload(
			new Blob([bytes], { type: "image/png" }),
		);
		reserveSegmentation(key, `${MODEL}: ${object.name}`);
		const response = await fal.subscribe(MODEL, {
			input: {
				image_url: imageUrl,
				box_prompts: [box],
				apply_mask: false,
				output_format: "png",
			},
		});
		result = response.data;
		await writeFile(responsePath, JSON.stringify(result));
	}
	if (!result.image?.url)
		throw new Error(
			"Cached reviewed mask is missing; restore it before deriving",
		);
	const response = await fetch(result.image.url);
	if (!response.ok) throw new Error("Could not download segmentation mask");
	await writeFile(maskPath, Buffer.from(await response.arrayBuffer()));
	return maskPath;
}
const pending = new Map<
	string,
	Promise<{ occluders: Occluder[]; exits: ReturnType<typeof deriveExits> }>
>();
export function deriveOccluders(
	image: string,
	ground?: {
		floor: FloorRaster;
		horizonY?: number;
		scaleSlope?: number;
		walkArea?: { perspective: Perspective };
		template?: "interior" | "exterior";
	},
): Promise<{ occluders: Occluder[]; exits: ReturnType<typeof deriveExits> }> {
	const source = imagePath(image);
	const existing = pending.get(source);
	if (existing) return existing;
	const task = derive(source, image, ground).finally(() =>
		pending.delete(source),
	);
	pending.set(source, task);
	return task;
}
async function derive(
	source: string,
	image: string,
	ground?: {
		floor: FloorRaster;
		horizonY?: number;
		scaleSlope?: number;
		walkArea?: { perspective: Perspective };
		template?: "interior" | "exterior";
	},
) {
	const bytes = await readFile(source);
	const objects = interactablesSchema.parse(
		JSON.parse(
			await readFile(source.replace(/\.png$/, ".interactables.json"), "utf8"),
		),
	).interactables;
	const floor = ground?.floor ?? (await cachedFloor(image));
	const stem = source.replace(/\.png$/, "");
	const landmarks = await readFile(`${stem}.landmarks.json`, "utf8").catch(
		() => null,
	);
	const horizonY =
		ground?.horizonY ??
		(landmarks
			? (JSON.parse(landmarks) as { horizonY?: number }).horizonY
			: undefined);
	const template =
		ground?.template ??
		(landmarks
			? (JSON.parse(landmarks) as { template?: string }).template
			: undefined);
	if (
		ground?.template &&
		landmarks &&
		JSON.parse(landmarks).template !== ground.template
	)
		await writeFile(
			`${stem}.landmarks.json`,
			JSON.stringify(
				{ ...JSON.parse(landmarks), template: ground.template },
				null,
				2,
			),
		);
	const semanticMasks = ground
		? (await readdir(cacheRoot)).filter(
				(name) =>
					name.startsWith(`${hashOf(bytes)}-obstacle-`) &&
					/-\d+\.png$/.test(name) &&
					!/-obstacle-(wall|water)-/.test(name),
			)
		: [];
	const fingerprint = hashOf(
		JSON.stringify({
			image: hashOf(bytes),
			objects,
			floor,
			horizonY,
			version: VERSION,
			semanticMasks,
			template,
			generated: !!ground,
		}),
	);
	const perspective =
		ground?.walkArea?.perspective ??
		(ground?.scaleSlope && horizonY !== undefined
			? { slope: ground.scaleSlope, horizonY }
			: undefined);
	const classify = (objects: Occluder[]) =>
		perspective
			? objects.map((o) => classifyOccluder(o, perspective))
			: objects;
	const exits = floor
		? deriveExits(floor, objects, horizonY, {
				allowFar: template !== "interior",
				allowEdges: template !== "interior",
			})
		: [];
	const meta = await readFile(`${stem}.occluders.cache.json`, "utf8").catch(
		() => null,
	);
	if (meta === fingerprint) {
		const occluders = JSON.parse(
			await readFile(`${stem}.occluders.json`, "utf8"),
		) as Occluder[];
		if (
			(
				await Promise.all(
					occluders.map((o) =>
						readFile(resolve(source, "..", o.png))
							.then(() => true)
							.catch(() => false),
					),
				)
			).every(Boolean)
		)
			return {
				occluders: perspective
					? classify(await refineCachedOccluders(image, perspective))
					: occluders,
				exits,
			};
	}
	const [width, height] = execFileSync(
		"magick",
		["identify", "-format", "%w %h", source],
		{ encoding: "utf8" },
	)
		.trim()
		.split(" ")
		.map(Number);
	const occluders: Occluder[] = [];
	const semantic = semanticMasks.map((name) => ({
		name: name.slice(`${hashOf(bytes)}-obstacle-`.length).replace(/\.png$/, ""),
		bounds: [0, 0, 1, 1],
		maskPath: resolve(cacheRoot, name),
	}));
	const canonical = (name: string) =>
		name.toLowerCase().replace(/-\d+$/, "").replaceAll("-", " ");
	const represented = semantic.map((s) => canonical(s.name));
	const candidates: Array<LabelledBox & { maskPath?: string }> = [
		...semantic,
		...objects.filter(
			(object) =>
				canOcclude(object) &&
				!represented.some((label) =>
					canonical(object.name).includes(label.replace(/s$/, "")),
				) &&
				(horizonY === undefined || object.bounds[3] * 1080 >= horizonY + 25),
		),
	];

	for (const object of candidates) {
		const maskPath =
			object.maskPath ?? (await segment(bytes, object, width, height));
		if (!maskPath) continue;
		const raster = execFileSync(
			"magick",
			[
				maskPath,
				"-resize",
				"1920x1080!",
				"-colorspace",
				"gray",
				"-threshold",
				"50%",
				"-depth",
				"8",
				"gray:-",
			],
			{ maxBuffer: 8 * 1024 * 1024 },
		);
		const cleaned: FloorRaster = {
			width: 1920,
			height: 1080,
			data: Array.from(raster, (v) => (v > 127 ? 1 : 0)),
		};
		const supportFraction = /\b(car|van|bus|truck)(?:s|es)?\b/i.test(
			object.name,
		)
			? 0.95
			: /\b(pergola|gazebo|gargoyle|statue)\b/i.test(object.name)
				? 0.9
				: /net|pile/i.test(object.name)
					? 0.55
					: 0.8;
		const geometry = maskGeometry(
			cleaned,
			floor,
			supportFraction,
			/post|pole/i.test(object.name) ? 0.00015 : 0.002,
			/\b(desk|counter)\b/i.test(object.name),
		);
		if (!geometry) continue;
		const cleanPath = maskPath.replace(/\.png$/, ".clean.png");
		execFileSync(
			"magick",
			["-size", "1920x1080", "-depth", "8", "gray:-", cleanPath],
			{ input: Buffer.from(cleaned.data.map((v) => (v ? 255 : 0))) },
		);

		const id = `${object.name
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, "-")
			.replace(
				/^-|-$/g,
				"",
			)}-${hashOf(JSON.stringify(object.bounds)).slice(0, 6)}`;
		const png = `${basename(stem)}.occluder-${id}.png`;
		const { x, y, w, h } = geometry.bbox;
		execFileSync("magick", [
			source,
			"-resize",
			"1920x1080!",
			"(",
			cleanPath,
			"-resize",
			"1920x1080!",
			"-colorspace",
			"gray",
			"-threshold",
			"50%",
			")",
			"-alpha",
			"off",
			"-compose",
			"CopyOpacity",
			"-composite",
			"-crop",
			`${w}x${h}+${x}+${y}`,
			"+repage",
			`PNG32:${resolve(source, "..", png)}`,
		]);
		const referencePixels = cleaned.data.reduce((n, v) => n + v, 0);
		occluders.push({
			id,
			label: object.name,
			...geometry,
			png,
			maskCoverage: {
				referencePixels,
				retainedPixels: referencePixels,
				fraction: 1,
			},
		});
	}
	await writeFile(
		`${stem}.occluders.json`,
		`${JSON.stringify(classify(occluders), null, "\t")}\n`,
	);
	await writeFile(
		`${stem}.exits.json`,
		`${JSON.stringify(exits, null, "\t")}\n`,
	);
	await writeFile(`${stem}.occluders.cache.json`, fingerprint);
	return {
		occluders: perspective
			? classify(await refineCachedOccluders(image, perspective))
			: occluders,
		exits,
	};
}

/** Separate low connected fragments and the flat apron of nets from upright
 * occlusion, retaining every segmentation pixel in one of the two layers. */
export function splitFloorClutter(
	mask: FloorRaster,
	label: string,
	perspective: Perspective,
	support?: Point[],
): { upright: FloorRaster; flat: FloorRaster } {
	const { width: w, height: h } = mask;
	const upright = { ...mask, data: [...mask.data] };
	const flat = { ...mask, data: mask.data.map(() => 0) };
	const seen = new Uint8Array(w * h),
		queue = new Int32Array(w * h);
	const ppm = (y: number) =>
		(perspective.pixelsPerMetre ?? 300) *
		(perspective.constant ?? perspective.slope * (y - perspective.horizonY));
	const mark = (pixels: number[]) => {
		for (const i of pixels) {
			upright.data[i] = 0;
			flat.data[i] = mask.data[i];
		}
	};
	for (let seed = 0; seed < mask.data.length; seed++) {
		if (!mask.data[seed] || seen[seed]) continue;
		let head = 0,
			tail = 1,
			minY = h,
			maxY = 0;
		queue[0] = seed;
		seen[seed] = 1;
		while (head < tail) {
			const n = queue[head++],
				x = n % w,
				y = Math.floor(n / w);
			minY = Math.min(minY, y);
			maxY = Math.max(maxY, y);
			for (const next of [
				x ? n - 1 : -1,
				x < w - 1 ? n + 1 : -1,
				y ? n - w : -1,
				y < h - 1 ? n + w : -1,
			]) {
				if (next >= 0 && mask.data[next] && !seen[next]) {
					seen[next] = 1;
					queue[tail++] = next;
				}
			}
		}
		const pixels = Array.from(queue.subarray(0, tail));
		const centreX =
			pixels.reduce((sum, i) => sum + (((i % w) + 0.5) * 1920) / w, 0) /
			pixels.length;
		const bottom = support?.length
			? Math.max(
					((maxY + 1) * 1080) / h,
					baselineYAt(
						{
							id: "",
							label,
							png: "",
							bbox: { x: 0, y: 0, w: 1920, h: 1080 },
							baseline: support,
						},
						centreX,
					),
				)
			: ((maxY + 1) * 1080) / h;
		const height = (bottom - (minY * 1080) / h) / ppm(bottom);
		if (
			(height >= 0 && height < 0.25) ||
			/\b(debris|fragments?|litter|leaves|scattered)\b/i.test(label)
		) {
			mark(pixels);
			continue;
		}
		if (/net|fishnet|crate|basket/i.test(label)) {
			const columns = new Map<number, number[]>();
			for (const i of pixels) {
				const x = i % w;
				const column = columns.get(x) ?? [];
				column.push(i);
				columns.set(x, column);
			}
			for (const column of columns.values()) {
				const ys = column.map((i) => Math.floor(i / w));
				const top = Math.min(...ys),
					bottom = Math.max(...ys) + 1;
				const height = ((bottom - top) * 1080) / h / ppm((bottom * 1080) / h);
				if (height >= 0 && height < 0.25) mark(column);
			}
		}
	}
	return { upright, flat };
}

/** Explicit, cache-only geometry migration. No segmentation or image generation. */
export async function refineCachedOccluders(
	image: string,
	perspective: Perspective,
): Promise<Occluder[]> {
	const source = imagePath(image),
		stem = source.replace(/\.png$/, "");
	const original = JSON.parse(
		await readFile(`${stem}.occluders.json`, "utf8"),
	) as (Occluder & { layerDerivation?: number })[];
	if (original.every((o) => o.layerDerivation === 22)) return original;
	const result: (Occluder & { layerDerivation: number })[] = [];
	for (const o of original) {
		const bytes = execFileSync(
			"magick",
			[
				"-size",
				"1920x1080",
				"xc:none",
				resolve(source, "..", o.png),
				"-geometry",
				`+${o.bbox.x}+${o.bbox.y}`,
				"-composite",
				"-alpha",
				"extract",
				"-depth",
				"8",
				"gray:-",
			],
			{ maxBuffer: 8e6 },
		);
		const mask = {
			width: 1920,
			height: 1080,
			data: Array.from(bytes, (v) => (v > 127 ? 1 : 0)),
		};
		const split = splitFloorClutter(mask, o.label, perspective, o.baseline);
		for (const kind of ["upright", "flat"] as const) {
			const part = split[kind];
			const geometry = maskGeometry(
				part,
				undefined,
				0.8,
				0.000005,
				/\b(desk|counter)\b/i.test(o.label),
			);
			if (!geometry) continue;
			const { x, y, w, h } = geometry.bbox;
			const png = `${basename(stem)}.occluder-${o.id}-${kind}-22.png`;
			execFileSync(
				"magick",
				[
					source,
					"-resize",
					"1920x1080!",
					"(",
					"-size",
					"1920x1080",
					"-depth",
					"8",
					"gray:-",
					")",
					"-alpha",
					"off",
					"-compose",
					"CopyOpacity",
					"-composite",
					"-crop",
					`${w}x${h}+${x}+${y}`,
					"+repage",
					`PNG32:${resolve(source, "..", png)}`,
				],
				{ input: Buffer.from(part.data.map((v) => v * 255)), maxBuffer: 8e6 },
			);
			const classified = classifyOccluder(
				{ ...o, ...geometry, png },
				perspective,
			);
			const count = part.data.reduce((a, b) => a + b, 0);
			result.push({
				...classified,
				id: `${o.id}-${kind}`,
				floorDecal: kind === "flat" || classified.floorDecal,
				obstacle:
					kind !== "flat" ||
					!/\b(debris|fragments?|litter|leaves|scattered)\b/i.test(o.label),
				layerDerivation: 22,
				maskCoverage: {
					referencePixels: count,
					retainedPixels: count,
					fraction: 1,
				},
			});
		}
	}
	await writeFile(
		`${stem}.occluders.json`,
		`${JSON.stringify(result, null, "\t")}\n`,
	);
	return result;
}
