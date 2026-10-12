import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fal } from "@fal-ai/client";
import { ROOT } from "../lib/backgrounds.js";
import { reserveCall } from "./costs.js";
import type { ScaleReference } from "./ground-calibration.js";
import { reserveSegmentation } from "./occluders.js";

interface Mask {
	width: number;
	height: number;
	data: ArrayLike<number>;
}
interface Detection {
	mask: Mask;
	score: number;
}
/** Coordinates come only from semantic masks, never an LLM box or a scene ID. */
export function measureSemanticScale(doors: Detection[], seas: Detection[]) {
	const candidates = doors
		.filter(
			({ score, mask }) =>
				score >= 0.85 && mask.data.length === mask.width * mask.height,
		)
		.map(({ mask, score }) => {
			let x0 = mask.width,
				y0 = mask.height,
				x1 = -1,
				y1 = -1,
				count = 0;
			for (let y = 0; y < mask.height; y++)
				for (let x = 0; x < mask.width; x++)
					if (mask.data[y * mask.width + x] > 127) {
						x0 = Math.min(x0, x);
						y0 = Math.min(y0, y);
						x1 = Math.max(x1, x);
						y1 = Math.max(y1, y);
						count++;
					}
			const w = x1 - x0 + 1,
				h = y1 - y0 + 1;
			return {
				score,
				fill: count / (w * h),
				aspect: w / h,
				rect: {
					x: x0 / mask.width,
					y: y0 / mask.height,
					width: w / mask.width,
					height: h / mask.height,
				},
			};
		})
		.filter(
			(d) =>
				d.aspect >= 0.25 &&
				d.aspect <= 0.75 &&
				d.fill >= 0.7 &&
				d.rect.height >= 0.04,
		);
	candidates.sort((a, b) => b.score - a.score);
	const door = candidates[0];
	const horizons = seas
		.filter((d) => d.score >= 0.6)
		.flatMap(({ mask }) => {
			const counts = new Array<number>(mask.height).fill(0);
			for (let x = 0; x < mask.width; x++)
				for (let y = 0; y < mask.height; y++)
					if (mask.data[y * mask.width + x] > 127) {
						counts[y]++;
						break;
					}
			let best = 0,
				support = 0;
			for (let y = 1; y < mask.height - 1; y++) {
				const n = counts[y - 1] + counts[y] + counts[y + 1];
				if (n > support) {
					best = y;
					support = n;
				}
			}
			return support / mask.width >= 0.2
				? [{ y: best / mask.height, support: support / mask.width }]
				: [];
		});
	if (!door || !horizons.length)
		throw new Error(
			"Unattended scale limitation: no confident door and horizontal sea boundary",
		);
	const horizonY = horizons[0].y;
	if (horizons.some((h) => Math.abs(h.y - horizonY) > 0.01))
		throw new Error(
			"Unattended scale limitation: sea masks disagree on horizon",
		);
	if (door.rect.y + door.rect.height - horizonY < 0.025)
		throw new Error("Unattended scale limitation: door too close to horizon");
	const scaleReference: ScaleReference = {
		label: "semantic-door-opening",
		rect: door.rect,
		realHeightM: 2.03,
	};
	return {
		horizonY,
		scaleReference,
		provenance: {
			method: "SAM3 text-only door and sea masks",
			doorScore: door.score,
			horizonSupport: horizons.map((h) => h.support),
			assumedDoorHeightM: 2.03,
		},
	};
}

/** Coastal scenes have an independently observable horizon. Other scene types retain their derivation. */
export async function semanticCoastalScale(bytes: Buffer, description: string) {
	if (!/\b(pier|dock|harbou?r|seaside|sea horizon)\b/i.test(description))
		return undefined;
	const hash = createHash("sha256").update(bytes).digest("hex");
	const root = resolve(
		ROOT,
		"api/data/perception",
		`${hash}-semantic-scale-v1`,
	);
	await mkdir(root, { recursive: true });
	async function detect(prompt: string): Promise<Detection[]> {
		const path = resolve(root, `${prompt}.json`);
		let result: { masks: Array<{ url: string }>; scores?: number[] };
		const cached = await readFile(path, "utf8").catch(() => null);
		if (cached) result = JSON.parse(cached);
		else {
			reserveCall("perception");
			reserveSegmentation(hash, `scale SAM3: ${prompt}`);
			const image_url = await fal.storage.upload(
				new Blob([bytes], { type: "image/png" }),
			);
			result = (
				await fal.subscribe("fal-ai/sam-3/image", {
					input: {
						image_url,
						prompt,
						apply_mask: false,
						return_multiple_masks: true,
						max_masks: 12,
						include_scores: true,
						include_boxes: true,
						output_format: "png",
					},
				})
			).data;
			await writeFile(path, JSON.stringify(result));
		}
		const detections: Detection[] = [];
		for (let i = 0; i < result.masks.length; i++) {
			const maskPath = resolve(root, `${prompt}-${i}.png`);
			if (!(await readFile(maskPath).catch(() => null))) {
				const response = await fetch(result.masks[i].url);
				if (!response.ok) throw new Error("Scale mask download failed");
				await writeFile(maskPath, Buffer.from(await response.arrayBuffer()));
			}
			const [width, height] = execFileSync(
				"magick",
				["identify", "-format", "%w %h", maskPath],
				{ encoding: "utf8" },
			)
				.trim()
				.split(" ")
				.map(Number);
			const data = execFileSync(
				"magick",
				[maskPath, "-colorspace", "gray", "-depth", "8", "gray:-"],
				{ maxBuffer: 16 * 1024 * 1024 },
			);
			detections.push({
				mask: { width, height, data },
				score: result.scores?.[i] ?? 0,
			});
		}
		return detections;
	}
	const measured = measureSemanticScale(
		await detect("door"),
		await detect("sea"),
	);
	await writeFile(
		resolve(root, "measurement.json"),
		JSON.stringify(measured, null, 2),
	);
	return measured;
}
