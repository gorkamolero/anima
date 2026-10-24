/**
 * Development-only sink for in-game recordings.
 *
 * The game records its own canvas (`window.__anima.record`) and posts the
 * WebM plus per-frame telemetry here; `scripts/walk-lens.mjs` turns them into
 * frame strips and slow-motion clips for inspection. Files land in
 * `<repo>/tmp/recordings/`, which is untracked.
 */

import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { Hono } from "hono";

export const recordingsRoutes = new Hono();

function recordingsDir(): string {
	const root = existsSync(resolve(process.cwd(), "adventures"))
		? process.cwd()
		: resolve(process.cwd(), "..");
	const dir = resolve(root, "tmp/recordings");
	mkdirSync(dir, { recursive: true });
	return dir;
}

function safeName(name: string): string | undefined {
	return /^[a-z0-9][a-z0-9_-]{0,80}$/i.test(name) ? name : undefined;
}

recordingsRoutes.post("/dev/recordings/:name", async (c) => {
	if (process.env.NODE_ENV === "production")
		return c.json({ error: "Recordings are a development feature" }, 404);
	const name = safeName(c.req.param("name"));
	if (!name) return c.json({ error: "Invalid recording name" }, 400);
	const type = c.req.header("content-type") ?? "";
	const dir = recordingsDir();
	if (type.includes("application/json")) {
		const telemetry = await c.req.text();
		const path = resolve(dir, `${name}.json`);
		writeFileSync(path, telemetry);
		return c.json({ path, bytes: telemetry.length });
	}
	const bytes = Buffer.from(await c.req.arrayBuffer());
	const extension = type.includes("mp4") ? "mp4" : "webm";
	const path = resolve(dir, `${name}.${extension}`);
	writeFileSync(path, bytes);
	return c.json({ path, bytes: bytes.length });
});
