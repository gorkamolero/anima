import { readFile, writeFile } from "node:fs/promises";
import { generateObject, type LanguageModel } from "ai";
import { Hono } from "hono";
import { z } from "zod";
import { ANCHORS, imagePath } from "../lib/backgrounds.js";
import { getModel } from "../lib/model.js";
import { recordCall } from "../services/costs.js";

export const interactablesSchema = z.object({
	interactables: z
		.array(
			z.object({
				name: z.string().min(1),
				// ponytail: fixed-length array, not z.tuple — Gemini's response_schema rejects tuple "items" lists
				bounds: z.array(z.number().min(0).max(1)).length(4),
			}),
		)
		.max(12),
});

export function createInteractablesRoutes(model?: LanguageModel): Hono {
	const routes = new Hono();

	routes.get("/interactables/:sceneId", async (c) => {
		const started = Date.now();
		const sceneId = c.req.param("sceneId");
		const backgroundName = c.req.query("image") ?? ANCHORS[sceneId];
		if (!backgroundName) return c.json({ error: "Unknown scene" }, 404);

		const backgroundPath = imagePath(backgroundName);
		const cachePath = backgroundPath.replace(/\.png$/, ".interactables.json");

		try {
			// ponytail: one-machine disk cache; move to Turso when scenes run on more than one machine.
			const cached = await readFile(cachePath, "utf8").catch(() => null);
			if (cached) {
				recordCall("interactables", Date.now() - started, true);
				return c.json(interactablesSchema.parse(JSON.parse(cached)));
			}

			const image = await readFile(backgroundPath);
			const { object } = await generateObject({
				model: model ?? getModel(),
				mode: "json",
				schema: interactablesSchema,
				messages: [
					{
						role: "user",
						content: [
							{
								type: "text",
								text: [
									"Identify up to 12 distinct, visibly present objects a player could click in this point-and-click scene.",
									"Use short grounded names and normalized image bounding boxes [x0,y0,x1,y1] from 0 to 1.",
									"Boxes must tightly contain the named object. Do not invent hidden or absent objects.",
								].join(" "),
							},
							{ type: "image", image, mediaType: "image/png" },
						],
					},
				],
			});

			await writeFile(cachePath, `${JSON.stringify(object, null, "\t")}\n`);
			recordCall("interactables", Date.now() - started);
			return c.json(object);
		} catch (error) {
			const message =
				error instanceof Error
					? error.message
					: "Interactable detection failed";
			return c.json({ error: message }, 502);
		}
	});

	return routes;
}

export const interactablesRoutes = createInteractablesRoutes();
