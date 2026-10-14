import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { Hono } from "hono";
import { z } from "zod";
import { ANCHORS, imagePath } from "../lib/backgrounds.js";
import { recordCall } from "../services/costs.js";
import { derivationError } from "../services/derivation-errors.js";
import { labelledFloorObjects } from "../services/floor-judge.js";
import {
	deriveGround,
	failedGround,
	type GroundData,
	judgeFloorOverlay,
} from "../services/ground.js";
import { referenceLandmark } from "../services/ground-calibration.js";
import { groundMaskReview, groundOverlay } from "../services/ground-overlay.js";
import { proofDirectory } from "../services/ground-perception.js";
import { repairGround } from "../services/ground-repair.js";
import { deriveOccluders } from "../services/occluders.js";
import { defaultVisual, getWorldDb } from "../services/world.js";
import { interactablesRoutes } from "./interactables.js";
import { sceneImageRoutes } from "./scene-image.js";

export interface Place {
	id: string;
	parent: string;
	template: "exterior" | "interior";
	description: string;
	background: string;
	ground: GroundData;
}
export function placeId(parent: string, to: string): string {
	const slug = to
		.toLowerCase()
		.trim()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-|-$/g, "");
	return `place-${createHash("sha256").update(`${parent}/${slug}`).digest("hex").slice(0, 20)}`;
}
export async function getPlace(id: string): Promise<Place | undefined> {
	const rows = await (await getWorldDb()).execute({
		sql: "SELECT data FROM places WHERE id = ?",
		args: [id],
	});
	return rows.rows.length ? JSON.parse(String(rows.rows[0].data)) : undefined;
}
const pending = new Map<string, Promise<Place>>();
/** Explicit local reviewer replacement; never invoked by GET or automatic derivation.
 * Keep the exact candidate and disagreement, rather than changing judge answers. */
export async function replaceReviewedPlace(
	id: string,
	candidate: Place,
	review: {
		approvedBy: "reviewer";
		date: string;
		overlay: string;
		judgeDisagreement: unknown;
	},
): Promise<Place> {
	if (pending.has(id)) throw new Error("Place derivation already running");
	const replacement = (async () => {
		const previous = await getPlace(id);
		if (!previous) throw new Error("Unknown place");
		if (
			candidate.id !== id ||
			candidate.background !== previous.background ||
			candidate.template !== previous.template ||
			review.approvedBy !== "reviewer" ||
			!Number.isFinite(Date.parse(review.date))
		)
			throw new Error("Reviewed replacement identity or approval mismatch");
		const floor = candidate.ground.floor;
		if (
			floor.data.length !== floor.width * floor.height ||
			!floor.data.some(Boolean) ||
			candidate.ground.ground === "failed"
		)
			throw new Error("Invalid reviewed floor");
		const overlaySha256 = createHash("sha256")
			.update(await readFile(review.overlay))
			.digest("hex");
		const place = { ...previous, ground: candidate.ground };
		const audit = `${proofDirectory(id)}/replace-reviewed-${Date.now()}.json`;
		await mkdir(proofDirectory(id), { recursive: true });
		const record = {
			id,
			...review,
			overlaySha256,
			previous,
			candidate: place,
		};
		await writeFile(audit, JSON.stringify({ ...record, status: "started" }));
		await (await getWorldDb()).execute({
			sql: "INSERT OR REPLACE INTO places VALUES (?, ?)",
			args: [id, JSON.stringify(place)],
		});
		await writeFile(audit, JSON.stringify({ ...record, status: "complete" }));
		return place;
	})();
	pending.set(id, replacement);
	try {
		return await replacement;
	} finally {
		pending.delete(id);
	}
}
async function createPlace(
	input: {
		parent: string;
		to: string;
		template: "exterior" | "interior";
		description: string;
		refresh?: boolean;
		id?: string;
	},
	origin: string,
): Promise<Place> {
	const id = input.id ?? placeId(input.parent, input.to);
	const existing = await getPlace(id);
	const audit =
		existing && input.refresh
			? `${proofDirectory(id)}/rederive-${Date.now()}.json`
			: undefined;
	if (audit) {
		await mkdir(proofDirectory(id), { recursive: true });
		await writeFile(
			audit,
			JSON.stringify({
				id,
				status: "started",
				at: new Date().toISOString(),
				previousVersion: existing?.ground.derivationVersion,
			}),
		);
	}
	if (existing && !input.refresh) {
		if (existing.ground.ground === "failed") return existing;
		const labels = await interactablesRoutes.request(
			`${origin}/interactables/${input.template === "interior" ? "inside" : "outside"}?image=${encodeURIComponent(existing.background)}`,
		);
		if (!labels.ok) throw new Error("Place object perception failed");
		const { occluders, exits } = await deriveOccluders(existing.background, {
			...existing.ground,
			template: existing.template,
		});
		existing.ground.overlays = [
			await groundOverlay(
				existing.background,
				existing.ground,
				id,
				occluders,
				exits,
			),
		];
		recordCall("place", 0, true);
		return existing;
	}
	const anchor = input.template === "interior" ? "inside" : "outside";
	const response = existing
		? new Response(JSON.stringify({ url: `${origin}${existing.background}` }))
		: await sceneImageRoutes.request(`${origin}/scene-image`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					scene: anchor,
					baseBackground: `${ANCHORS[anchor]}#${id}`,
					visualState: defaultVisual(),
					imagePrompt: `Create this new place: ${input.description}. Remove the anchor's people and vehicles unless specified by the place. No Hermes or Kat. Keep the camera, horizon line and walkable ground exactly where they are in the input image.`,
				}),
			});
	if (!response.ok) throw new Error("Place image failed");
	const image = (await response.json()) as { url: string };
	let ground: GroundData = failedGround("Derivation not completed");
	let diagnosticGround: GroundData | undefined;
	try {
		const labels = await interactablesRoutes.request(
			`${origin}/interactables/${anchor}?image=${encodeURIComponent(image.url)}`,
		);
		if (!labels.ok) throw new Error("Place object perception failed");
		ground = await deriveGround(
			image.url,
			input.template,
			undefined,
			input.description,
			id,
		);
		diagnosticGround = ground;
		await writeFile(
			`${proofDirectory(id)}/candidate-ground.json`,
			JSON.stringify(ground),
		);
		ground.overlays = [await groundOverlay(image.url, ground, id)];
		const objects = await labelledFloorObjects(image.url);
		for (let attempt = 0; attempt < 3; attempt++) {
			const maskReview = await groundMaskReview(image.url, ground, id);
			const verdict = await judgeFloorOverlay(
				maskReview,
				objects,
				ground,
				image.url,
			);
			ground.verdicts.push(verdict);
			ground.notes = [
				...(ground.notes ?? []),
				`Floor review: ${verdict.deterministic?.length ?? 0} outlines checked arithmetically; missing floor does not reject.`,
			];
			if (verdict.pass) break;
			if (attempt === 2 || !repairGround(ground, verdict)) {
				ground = failedGround(`Floor mask rejected: ${verdict.why}`, ground);
				break;
			}
		}
		diagnosticGround = ground.ground === "failed" ? diagnosticGround : ground;
	} catch (error) {
		ground = failedGround(derivationError(error), ground);
	}
	ground.overlays = [
		...(ground.overlays ?? []),
		await groundOverlay(
			image.url,
			ground,
			ground.ground === "failed" ? `${id}-failed` : id,
		),
	];
	const background = new URL(image.url).pathname;
	const place = {
		id,
		parent: input.parent,
		template: input.template,
		description: input.description,
		background,
		ground,
	};
	// This scene-specific reference records the existing scale estimate; floor
	// eligibility is judged separately and is not a sprite-scale signoff.
	if (ground.ground !== "failed") {
		const y =
			ground.groundLine.points[Math.min(2, ground.groundLine.points.length - 1)]
				.y;
		const height =
			(1059 * ground.baseScale * (y - ground.horizonY) * ground.scaleSlope) /
			0.8;
		await writeFile(
			imagePath(background).replace(/\.png$/, ".landmarks.json"),
			JSON.stringify(
				{
					image: background.split("/").at(-1),
					space: "game",
					template: input.template,
					horizonY: ground.horizonY,
					figureCalibration: ground.scaleReference ? 1 : 0.8,
					landmarks: ground.scaleReference
						? [referenceLandmark(ground.scaleReference)]
						: [
								{
									id: "camera-calibration",
									kind: "figure",
									rect: { x: 960, y: y - height, width: 100, height },
									realHeightM: 1.75,
									note: "Scene-specific visual calibration; SAM/depth geometry and asymmetric floor review.",
								},
							],
				},
				null,
				2,
			),
		);
	}
	try {
		const labels = await interactablesRoutes.request(
			`${origin}/interactables/${anchor}?image=${encodeURIComponent(background)}`,
		);
		if (!labels.ok) throw new Error("Place object perception failed");
		const diagnostic = ground.ground === "failed" ? diagnosticGround : ground;
		if (diagnostic) {
			const { occluders, exits } = await deriveOccluders(background, {
				...diagnostic,
				template: input.template,
			});
			ground.overlays = [
				...(ground.overlays ?? []),
				await groundOverlay(background, diagnostic, id, occluders, exits),
			];
		}
	} catch (error) {
		ground = failedGround(
			`Occluder/exit derivation incomplete: ${derivationError(error)}`,
			ground,
		);
	}
	// Keep the complete previous record (including perspective/regions) when
	// a refresh loses more than 15% of its floor. Preserve both exact overlays.
	if (existing && existing.ground.ground !== "failed") {
		const area = (g: GroundData) =>
			g.floor.data.filter(Boolean).length / (g.floor.width * g.floor.height);
		const comparison = diagnosticGround ?? ground;
		const previousArea = area(existing.ground);
		const loss = previousArea ? 1 - area(comparison) / previousArea : 0;
		if (area(comparison) < previousArea * 0.85) {
			const stamp = `${id}-shrink-${Date.now()}`;
			const overlays = await Promise.all([
				groundOverlay(background, existing.ground, `${stamp}-previous`),
				groundOverlay(background, comparison, `${stamp}-candidate`),
			]);
			const reason = `Floor refresh lost ${(loss * 100).toFixed(2)}% (>15%); previous floor retained pending visual review.`;
			console.warn(`[floor-regression] ${id}: ${reason}`);
			await writeFile(
				audit ?? `${proofDirectory(id)}/${stamp}.json`,
				JSON.stringify({
					id,
					status: "review-required",
					reason,
					loss,
					preservedPrevious: true,
					overlays,
					previous: existing.ground,
					candidate: comparison,
					derivationFailure: ground.reason,
				}),
			);
			return existing;
		}
	}
	place.ground = ground;
	if (audit) {
		await writeFile(
			audit,
			JSON.stringify({
				id,
				status: ground.ground === "failed" ? "failed" : "complete",
				at: new Date().toISOString(),
				previousVersion: existing?.ground.derivationVersion,
				nextVersion: ground.derivationVersion,
				reason: ground.reason,
				preservedPrevious:
					ground.ground === "failed" && existing?.ground.ground !== "failed",
			}),
		);
		if (
			ground.ground === "failed" &&
			existing &&
			existing.ground.ground !== "failed"
		)
			return existing;
	}
	await writeFile(
		`${proofDirectory(id)}/result.json`,
		JSON.stringify(place, null, 2),
	);
	await (await getWorldDb()).execute({
		sql: "INSERT OR REPLACE INTO places VALUES (?, ?)",
		args: [id, JSON.stringify(place)],
	});

	return place;
}
export const placesRoutes = new Hono();
placesRoutes.get("/places", async (c) => {
	const result = await (await getWorldDb()).execute("SELECT data FROM places");
	const places = result.rows.map(
		(row) => JSON.parse(String(row.data)) as Place,
	);
	return c.json(
		c.req.query("includeFailed") === "true"
			? places
			: places.filter((p) => p.ground.ground !== "failed"),
	);
});
placesRoutes.get("/places/:id", async (c) => {
	const place = await getPlace(c.req.param("id"));
	if (place?.ground.ground === "failed")
		return c.json({ error: place.ground.reason, place }, 409);
	return place ? c.json(place) : c.json({ error: "Unknown place" }, 404);
});
placesRoutes.post("/places", async (c) => {
	const parsed = z
		.object({
			parent: z.string().min(1),
			to: z.string().min(1),
			template: z.enum(["exterior", "interior"]),
			description: z.string().min(1),
			refresh: z.boolean().optional(),
		})
		.safeParse(await c.req.json().catch(() => null));
	if (!parsed.success) return c.json({ error: "Invalid place" }, 400);
	const id = placeId(parsed.data.parent, parsed.data.to);
	try {
		if (!pending.has(id))
			pending.set(id, createPlace(parsed.data, new URL(c.req.url).origin));
		return c.json(await pending.get(id));
	} catch (error) {
		return c.json(
			{
				error: error instanceof Error ? error.message : "Place creation failed",
			},
			502,
		);
	} finally {
		pending.delete(id);
	}
});

/** Explicit per-place refresh; reuse the stored background and retain a working
 * previous floor if the attempted replacement fails. Audit lives beside proofs. */
placesRoutes.post("/places/:id/rederive", async (c) => {
	const id = c.req.param("id");
	const place = await getPlace(id);
	if (!place) return c.json({ error: "Unknown place" }, 404);
	if (pending.has(id))
		return c.json({ error: "Place derivation already running" }, 409);
	try {
		pending.set(
			id,
			createPlace(
				{ ...place, to: id, refresh: true },
				new URL(c.req.url).origin,
			),
		);
		return c.json(await pending.get(id));
	} catch (error) {
		return c.json({ error: derivationError(error) }, 502);
	} finally {
		pending.delete(id);
	}
});
