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
import { sceneImageRoutes } from "./routes/scene-image.js";
import { worldRoutes } from "./routes/world.js";

export const app = new Hono();

// Middleware
app.use("*", logger());
app.use(
	"*",
	cors({
		origin: [
			"http://localhost:5173",
			"http://localhost:3000",
			"http://localhost:8080",
		],
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
