import type { Client } from "@libsql/client";
import { Hono } from "hono";
import {
	getWorldDb,
	loadWorld,
	patchWorld,
	worldPatchSchema,
} from "../services/world.js";
export function createWorldRoutes(database?: Client): Hono {
	const routes = new Hono();
	routes.use("/world/:sessionId", async (c, next) => {
		if (!/^[a-zA-Z0-9_-]{1,128}$/.test(c.req.param("sessionId") ?? ""))
			return c.json({ error: "Invalid session id" }, 400);
		await next();
		return;
	});
	routes.get("/world/:sessionId", async (c) =>
		c.json(
			await loadWorld(
				database ?? (await getWorldDb()),
				c.req.param("sessionId"),
			),
		),
	);
	routes.patch("/world/:sessionId", async (c) => {
		const parsed = worldPatchSchema.safeParse(
			await c.req.json().catch(() => null),
		);
		if (!parsed.success) return c.json({ error: "Invalid world patch" }, 400);
		return c.json(
			await patchWorld(
				database ?? (await getWorldDb()),
				c.req.param("sessionId"),
				parsed.data,
			),
		);
	});
	return routes;
}
export const worldRoutes = createWorldRoutes();
