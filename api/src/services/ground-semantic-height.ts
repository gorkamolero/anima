import { execFileSync } from "node:child_process";
import { dirname, resolve } from "node:path";
import type { Occluder } from "@anima/footfall/core/occlusion/occlusion";
import { imagePath } from "../lib/backgrounds.js";
import type { Raster } from "./ground.js";
import type { ScaleReference } from "./ground-calibration.js";
import type { NormalField } from "./ground-normals.js";
import {
	measureFloorPlane,
	measureObjectHeight,
	projectObjectScale,
} from "./ground-object-height.js";

// Explicit priors, not measurements. Variable-size props (barrels, crates,
// shelves, rocks) cannot establish adult scale just from their category.
const priors = [
	{ category: "doors", height: 2.03, uncertainty: 0.2, minimum: 2 },
	{ category: "vending-machines", height: 1.8, uncertainty: 0.2, minimum: 1 },
	{ category: "desk", height: 1.1, uncertainty: 0.25, minimum: 1 },
	{ category: "pews", height: 1, uncertainty: 0.2, minimum: 2 },
	{ category: "benches", height: 0.9, uncertainty: 0.2, minimum: 2 },
	{ category: "lamp-post", height: 3, uncertainty: 1, minimum: 1 },
	{ category: "lampposts", height: 3, uncertainty: 1, minimum: 1 },
];
type Calibration = Extract<
	ReturnType<typeof projectObjectScale>,
	{ status: "estimated" }
>;
export interface HeightCandidate {
	id: string;
	category: string;
	reference: ScaleReference;
	calibration: Calibration;
}
/** Duplicate segments are one observation; contradictory instances are never
 * discarded merely to make a consensus pass. */
export function selectHeightCandidates(candidates: HeightCandidate[]) {
	const groups = [];
	const evidence: Array<{
		category: string;
		reason: string;
		instances: number;
	}> = [];
	for (const prior of priors) {
		const unique = [
			...new Map(
				candidates
					.filter((c) => c.category === prior.category)
					.map((c) => [c.id, c]),
			).values(),
		];
		if (unique.length < prior.minimum) continue;
		unique.sort((a, b) => a.calibration.slope - b.calibration.slope);
		const selected = unique[Math.floor(unique.length / 2)];
		if (
			unique.some(
				(c) =>
					Math.abs(c.calibration.slope / selected.calibration.slope - 1) > 0.25,
			)
		) {
			evidence.push({
				category: prior.category,
				reason: "instances disagree",
				instances: unique.length,
			});
			continue;
		}
		groups.push({ selected, prior, instances: unique.map((c) => c.id) });
	}
	if (!groups.length) return { status: "unknown" as const, evidence };
	const chosen = groups[0];
	if (
		groups.some(
			(g) =>
				Math.abs(
					g.selected.calibration.slope / chosen.selected.calibration.slope - 1,
				) > 0.25,
		)
	)
		return {
			status: "unknown" as const,
			evidence: [
				...evidence,
				{
					category: "cross-category",
					reason: "independent categories disagree",
					instances: groups.length,
				},
			],
		};
	return {
		status: "estimated" as const,
		...chosen.selected,
		assumedHeightM: chosen.prior.height,
		heightUncertaintyM: chosen.prior.uncertainty,
		instances: chosen.instances,
		evidence,
	};
}
export async function semanticHeightScale(
	image: string,
	objects: readonly Occluder[],
	field: NormalField,
	floor: Raster,
) {
	const plane = measureFloorPlane(field, floor);
	if (!plane)
		return {
			status: "unknown" as const,
			evidence: [{ reason: "no reliable floor plane" }],
		};
	const candidates: HeightCandidate[] = [];
	const rejected: Array<{ id: string; reason: string }> = [];
	for (const object of objects) {
		const category = object.label.toLowerCase().replace(/-\d+$/, "");
		const prior = priors.find((p) => p.category === category);
		if (!prior || object.id.endsWith("-flat")) continue;
		const b = object.bbox;
		const bytes = execFileSync(
			"magick",
			[
				"-size",
				"1920x1080",
				"xc:none",
				resolve(dirname(imagePath(image)), object.png),
				"-geometry",
				`+${b.x}+${b.y}`,
				"-composite",
				"-alpha",
				"extract",
				"-resize",
				`${field.width}x${field.height}!`,
				"-depth",
				"8",
				"gray:-",
			],
			{ maxBuffer: 32 * 1024 * 1024 },
		);
		if (bytes.length !== field.width * field.height)
			throw new Error("Invalid object alpha raster");
		const mask = {
			width: field.width,
			height: field.height,
			data: Array.from(bytes, (v) => (v > 200 ? 1 : 0)),
		};
		const measurement = measureObjectHeight(field, mask, plane);
		if (measurement.status === "rejected") {
			rejected.push({ id: object.id, reason: measurement.reason });
			continue;
		}
		const calibration = projectObjectScale(
			field,
			floor,
			plane,
			measurement.extent,
			prior.height,
		);
		if (calibration.status === "rejected") {
			rejected.push({ id: object.id, reason: calibration.reason });
			continue;
		}
		candidates.push({
			id: object.id.replace(/-upright$/, ""),
			category,
			calibration,
			reference: {
				label: object.label,
				rect: {
					x: b.x / 1920,
					y: b.y / 1080,
					width: b.w / 1920,
					height: b.h / 1080,
				},
				realHeightM: prior.height,
			},
		});
	}
	return { ...selectHeightCandidates(candidates), rejected };
}
