import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type Client, createClient } from "@libsql/client";
import { z } from "zod";

export const visualSchema = z.object({
	timeOfDay: z.string(),
	weather: z.string(),
	damage: z.string(),
	npcsPresent: z.array(z.string()),
});
export type VisualState = z.infer<typeof visualSchema>;
export const defaultVisual = (): VisualState => ({
	timeOfDay: "day",
	weather: "salt fog",
	damage: "intact",
	npcsPresent: [],
});
const flags = z.record(z.union([z.string(), z.boolean()]));
export const statePatchSchema = z
	.object({
		flags: flags.optional(),
		inventory: z
			.object({
				add: z.array(z.string()).optional(),
				remove: z.array(z.string()).optional(),
			})
			.optional(),
		npcMemory: z.record(z.string()).optional(),
	})
	.catchall(z.union([z.string(), z.boolean()]));
export const worldPatchSchema = z
	.object({
		location: z.string().min(1).optional(),
		statePatch: statePatchSchema.optional(),
		visualStatePatch: visualSchema.partial().optional(),
		action: z
			.object({ object: z.string(), choice: z.string(), caption: z.string() })
			.optional(),
	})
	.strict();
export interface WorldState {
	location: string;
	flags: Record<string, string | boolean>;
	inventory: string[];
	npcMemory: Record<string, string>;
	visual: Record<string, VisualState>;
	history: Array<{
		location: string;
		object: string;
		choice: string;
		caption: string;
	}>;
}
export const initialWorld = (): WorldState => ({
	location: "outside",
	flags: {},
	inventory: [],
	npcMemory: {},
	visual: { outside: defaultVisual(), inside: defaultVisual() },
	history: [],
});
let database: Promise<Client> | undefined;
export async function getWorldDb(): Promise<Client> {
	if (!database) database = openWorldDb(process.env.ANIMA_WORLD_DB_URL);
	return database;
}
export async function openWorldDb(url?: string): Promise<Client> {
	const path = resolve(
		dirname(fileURLToPath(import.meta.url)),
		"../../data/world.db",
	);
	if (!url) mkdirSync(dirname(path), { recursive: true });
	// ponytail: local libsql file, remote Turso URL when deployed
	const db = createClient({ url: url ?? `file:${path}` });
	await db.batch(
		[
			"CREATE TABLE IF NOT EXISTS worlds (session_id TEXT PRIMARY KEY, state TEXT NOT NULL)",
			"CREATE TABLE IF NOT EXISTS narrations (cache_key TEXT PRIMARY KEY, data TEXT NOT NULL)",
			"CREATE TABLE IF NOT EXISTS images (cache_key TEXT PRIMARY KEY, path TEXT NOT NULL)",
			"CREATE TABLE IF NOT EXISTS places (id TEXT PRIMARY KEY, data TEXT NOT NULL)",
		],
		"write",
	);
	return db;
}
export async function loadWorld(db: Client, id: string): Promise<WorldState> {
	await db.execute({
		sql: "INSERT OR IGNORE INTO worlds VALUES (?, ?)",
		args: [id, JSON.stringify(initialWorld())],
	});
	const result = await db.execute({
		sql: "SELECT state FROM worlds WHERE session_id = ?",
		args: [id],
	});
	return JSON.parse(String(result.rows[0].state));
}
export async function patchWorld(
	db: Client,
	id: string,
	patch: z.infer<typeof worldPatchSchema>,
): Promise<WorldState> {
	const tx = await db.transaction("write");
	try {
		await tx.execute({
			sql: "INSERT OR IGNORE INTO worlds VALUES (?, ?)",
			args: [id, JSON.stringify(initialWorld())],
		});
		const result = await tx.execute({
			sql: "SELECT state FROM worlds WHERE session_id = ?",
			args: [id],
		});
		const world: WorldState = JSON.parse(String(result.rows[0].state));
		const state = patch.statePatch;
		if (state) {
			for (const [key, value] of Object.entries(state))
				if (typeof value === "string" || typeof value === "boolean")
					world.flags[key] = value;
			Object.assign(world.flags, state.flags);
			Object.assign(world.npcMemory, state.npcMemory);
			world.inventory = [
				...new Set([...world.inventory, ...(state.inventory?.add ?? [])]),
			].filter((item) => !state.inventory?.remove?.includes(item));
		}
		if (patch.visualStatePatch)
			world.visual[world.location] = {
				...(world.visual[world.location] ?? defaultVisual()),
				...patch.visualStatePatch,
			};
		if (patch.action)
			world.history = [
				...world.history,
				{ location: world.location, ...patch.action },
			].slice(-12);
		if (patch.location) world.location = patch.location;
		world.visual[world.location] ??= defaultVisual();
		await tx.execute({
			sql: "UPDATE worlds SET state = ? WHERE session_id = ?",
			args: [JSON.stringify(world), id],
		});
		await tx.commit();
		return world;
	} finally {
		tx.close();
	}
}
