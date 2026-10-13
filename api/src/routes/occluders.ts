import { readFile } from "node:fs/promises";
import {
	classifyOccluder,
	type Occluder,
} from "@anima/footfall/core/occlusion/occlusion";
import type { Perspective } from "@anima/footfall/core/walkarea/perspective";
import { Hono } from "hono";
import { ANCHORS, imagePath } from "../lib/backgrounds.js";
import { cachedFloor, deriveOccluders } from "../services/occluders.js";
import { unchangedAnchorFloor } from "../services/variant-floor.js";
import { getPlace } from "./places.js";
export const occludersRoutes = new Hono();
/** Same anchor and ?image resolution as interactables, plus persisted place IDs.
 * PNG names are relative to the resolved background's directory. */
occludersRoutes.get("/occluders/:imageKey", async (c) => {
	const key = c.req.param("imageKey");
	const place = key.startsWith("place-") ? await getPlace(key) : undefined;
	const image = c.req.query("image") ?? ANCHORS[key] ?? place?.background;
	if (!image) return c.json({ error: "Unknown scene or place" }, 404);
	try {
		imagePath(image);
	} catch {
		return c.json({ error: "Invalid background path" }, 400);
	}
	try {
		const anchorGround =
			ANCHORS[key] === image
				? await readFile(
						imagePath(image).replace(/\.png$/, ".ground.json"),
						"utf8",
					)
						.then(
							(text) =>
								JSON.parse(text) as {
									floor: NonNullable<Awaited<ReturnType<typeof cachedFloor>>>;
									horizonY: number;
									scaleSlope: number;
									walkArea?: { perspective: Perspective };
								},
						)
						.catch(() => undefined)
				: undefined;
		const floor =
			anchorGround?.floor ??
			place?.ground?.floor ??
			(await cachedFloor(image)) ??
			(ANCHORS[key]
				? await unchangedAnchorFloor(image, ANCHORS[key])
				: undefined);
		if (!floor)
			return c.json(
				{
					error:
						"Segmented floor missing; explicitly derive this scene before walking",
				},
				409,
			);
		// Shipped anchor derivations are immutable runtime assets. Re-derivation
		// is explicit; a clean checkout must not spend calls rebuilding them.
		const geometry = anchorGround
			? {
					occluders: JSON.parse(
						await readFile(
							imagePath(image).replace(/\.png$/, ".occluders.json"),
							"utf8",
						),
					),
					exits: JSON.parse(
						await readFile(
							imagePath(image).replace(/\.png$/, ".exits.json"),
							"utf8",
						),
					),
				}
			: await deriveOccluders(
					image,
					(place
						? { ...place.ground, template: place.template }
						: undefined) ?? {
						floor,
						template: key === "inside" ? "interior" : "exterior",
					},
				);
		const ground = anchorGround ?? place?.ground;
		const perspective =
			ground?.walkArea?.perspective ??
			(ground
				? { horizonY: ground.horizonY, slope: ground.scaleSlope }
				: undefined);
		return c.json({
			...geometry,
			occluders: perspective
				? geometry.occluders.map((o: Occluder) =>
						classifyOccluder(o, perspective),
					)
				: geometry.occluders,
			floor,
		});
	} catch (error) {
		if (error instanceof Error && "code" in error && error.code === "ENOENT")
			return c.json(
				{
					error:
						"Background or cached interactables missing; request interactables first",
				},
				409,
			);
		return c.json(
			{
				error:
					"Occluder derivation failed; inspect the local segmentation cache and budget",
			},
			502,
		);
	}
});
