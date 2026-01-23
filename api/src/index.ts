/**
 * Anima API Server
 * Hono-based backend for game services
 */

import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { gameRoutes } from "./routes/game.js";

export const app = new Hono();

// Middleware
app.use("*", logger());
app.use(
  "*",
  cors({
    origin: ["http://localhost:5173", "http://localhost:3000"],
    credentials: true,
  })
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
    }
  );
}
