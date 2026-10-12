import { Hono } from "hono";
import { ANCHORS, imagePath } from "../lib/backgrounds.js";
import { cachedFloor, deriveOccluders } from "../services/occluders.js";
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
		const geometry = await deriveOccluders(image, place?.ground);
		const floor = place?.ground?.floor ?? (await cachedFloor(image));
		if (!floor)
			return c.json(
				{
					error:
						"Segmented floor missing; explicitly derive this scene before walking",
				},
				409,
			);
		return c.json({ ...geometry, floor });
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
