/**
 * Anima API Server
 * Hono-based backend for game services
 */

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { connectionsRoutes } from "./routes/connections.js";
import { gameRoutes } from "./routes/game.js";
import { groundRoutes } from "./routes/ground.js";
import { interactablesRoutes } from "./routes/interactables.js";
import { narrateRoutes } from "./routes/narrate.js";
import { occludersRoutes } from "./routes/occluders.js";
import { placesRoutes } from "./routes/places.js";
import { recordingsRoutes } from "./routes/recordings.js";
import { sceneImageRoutes } from "./routes/scene-image.js";
import { worldRoutes } from "./routes/world.js";

// Keys for paid services live in api/keys.local (gitignored, KEY=value per
// line). The app launches this server with the environment it was opened
// with, so a key added to the shell profile later never reaches it.
try {
	process.loadEnvFile(new URL("../keys.local", import.meta.url).pathname);
} catch {}

export const app = new Hono();

// Middleware
app.use("*", logger());
app.use(
	"*",
	cors({
		// Any local dev port (several game instances can run side by side).
		origin: (origin) =>
			/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin) ? origin : null,
		credentials: true,
	}),
);

// Health check
app.get("/api/health", (c) => {
	return c.json({
		status: "ok",
		timestamp: new Date().toISOString(),
	});
});

// Mount game routes under /api
app.route("/api", gameRoutes);
app.route("/api", connectionsRoutes);
app.route("/api", worldRoutes);
app.route("/api", groundRoutes);
app.route("/api", placesRoutes);
app.route("/api", occludersRoutes);
app.route("/api", interactablesRoutes);
app.route("/api", narrateRoutes);
app.route("/api", sceneImageRoutes);
app.route("/api", recordingsRoutes);

// Generated scene images are served by the api, not Vite (see scene-image.ts)
const generatedRoot = existsSync(resolve(process.cwd(), "adventures"))
	? process.cwd()
	: resolve(process.cwd(), "..");
app.use(
	"/generated/*",
	serveStatic({
		root: resolve(generatedRoot, "adventures/shadow-over-innsmouth/public"),
	}),
);

// Start server (only when running directly, not in tests)
const port = Number(process.env.PORT) || 3001;

if (process.env.NODE_ENV !== "test") {
	serve(
		{
			fetch: app.fetch,
			port,
		},
		(info) => {
			console.log(`Server running at http://localhost:${info.port}`);
		},
	);
}
