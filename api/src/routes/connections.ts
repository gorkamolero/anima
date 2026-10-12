import type { Client } from "@libsql/client";
import { Hono } from "hono";
import { z } from "zod";
import { getWorldDb } from "../services/world.js";
import { getPlace } from "./places.js";

const endpoint = z.object({
	scene: z.string().min(1),
	exit: z.string().min(1),
	kind: z.enum(["edge-left", "edge-right", "far", "near", "door"]),
});
export function createConnectionsRoutes(testDb?: Client) {
	const connectionsRoutes = new Hono();
	async function database() {
		const db = testDb ?? (await getWorldDb());
		await db.execute(
			"CREATE TABLE IF NOT EXISTS connections (scene TEXT NOT NULL, exit TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY(scene,exit))",
		);
		return db;
	}
	connectionsRoutes.get("/connections/:scene", async (c) => {
		const db = await database();
		const rows = await db.execute({
			sql: "SELECT data FROM connections WHERE scene=?",
			args: [c.req.param("scene")],
		});
		return c.json(rows.rows.map((r) => JSON.parse(String(r.data))));
	});
	connectionsRoutes.post("/connections", async (c) => {
		const parsed = z
			.object({ from: endpoint, to: endpoint })
			.safeParse(await c.req.json().catch(() => null));
		if (!parsed.success) return c.json({ error: "Invalid connection" }, 400);
		const { from, to } = parsed.data;
		if (from.scene === to.scene)
			return c.json({ error: "Travel must change place" }, 400);
		for (const p of [from, to])
			if (
				!["inside", "outside"].includes(p.scene) &&
				!(await getPlace(p.scene))
			)
				return c.json({ error: "Unknown destination" }, 404);
		const db = await database();
		const tx = await db.transaction("write");
		try {
			for (const [a, b] of [
				[from, to],
				[to, from],
			]) {
				const rows = await tx.execute({
					sql: "SELECT data FROM connections WHERE scene=? AND exit=?",
					args: [a.scene, a.exit],
				});
				const data = { ...a, to: b.scene, entry: b.exit };
				if (
					rows.rows.length &&
					JSON.stringify(JSON.parse(String(rows.rows[0].data))) !==
						JSON.stringify(data)
				) {
					await tx.rollback();
					return c.json({ error: "Exit already connected" }, 409);
				}
				await tx.execute({
					sql: "INSERT OR REPLACE INTO connections VALUES (?,?,?)",
					args: [a.scene, a.exit, JSON.stringify(data)],
				});
			}
			await tx.commit();
			return c.json({ from, to });
		} finally {
			tx.close();
		}
	});

	return connectionsRoutes;
}
export const connectionsRoutes = createConnectionsRoutes();
