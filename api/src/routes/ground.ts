import { basename } from "node:path";
import { Hono } from "hono";
import { z } from "zod";
import { derivationError } from "../services/derivation-errors.js";
import {
	labelledFloorObjects,
	locateFloorHazards,
} from "../services/floor-judge.js";
import {
	deriveGround,
	failedGround,
	judgeFloorOverlay,
} from "../services/ground.js";
import { groundMaskReview } from "../services/ground-overlay.js";
import { repairGround } from "../services/ground-repair.js";
export const groundRoutes = new Hono();
groundRoutes.post("/ground", async (c) => {
	const parsed = z
		.object({
			image: z.string(),
			template: z.enum(["exterior", "interior"]),
			description: z.string().optional(),
			key: z
				.string()
				.regex(/^[a-zA-Z0-9_-]+$/)
				.optional(),
			fraction: z.number().min(0.1).max(0.9).optional(),
		})
		.safeParse(await c.req.json().catch(() => null));
	if (!parsed.success) return c.json({ error: "Invalid ground request" }, 400);
	try {
		const input = parsed.data;
		const ground = await deriveGround(
			input.image,
			input.template,
			input.fraction,
			input.description,
			input.key,
		);
		const objects = await labelledFloorObjects(input.image);
		for (let attempt = 0; attempt < 3; attempt++) {
			const overlay = await groundMaskReview(
				input.image,
				ground,
				input.key ?? basename(input.image, ".png"),
			);
			const verdict = await judgeFloorOverlay(overlay, objects, ground);
			ground.verdicts.push(verdict);
			ground.notes = [
				...(ground.notes ?? []),
				`Visible-floor coverage score: ${verdict.probabilities?.coverage ?? "unknown"}; missing floor does not reject.`,
			];
			if (verdict.pass) return c.json(ground);
			await locateFloorHazards(verdict);
			if (attempt === 2 || !repairGround(ground, verdict))
				return c.json(failedGround(verdict.why, ground));
		}
		return c.json(failedGround("Floor review incomplete", ground));
	} catch (error) {
		return c.json(failedGround(derivationError(error)));
	}
});
