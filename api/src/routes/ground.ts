import { Hono } from "hono";
import { z } from "zod";
import { derivationError } from "../services/derivation-errors.js";
import { deriveGround, failedGround } from "../services/ground.js";
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
		return c.json(
			await deriveGround(
				parsed.data.image,
				parsed.data.template,
				parsed.data.fraction,
				parsed.data.description,
				parsed.data.key,
			),
		);
	} catch (error) {
		return c.json(failedGround(derivationError(error)));
	}
});
