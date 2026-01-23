/**
 * Game API routes
 * Handles session management and TTS generation
 */

import { Hono } from "hono";
import { sessionStore } from "../services/sessions.js";
import { getTTSService } from "../services/tts.js";

// Input validation patterns - session ID uses full UUID for maximum entropy
const SESSION_ID_PATTERN = /^sess_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const VOICE_ID_PATTERN = /^[a-zA-Z0-9]+$/;
const MAX_TTS_TEXT_LENGTH = 5000;

/**
 * Validate session ID format
 */
function isValidSessionId(id: string): boolean {
  return SESSION_ID_PATTERN.test(id);
}

/**
 * Validate voice ID format (alphanumeric only)
 */
function isValidVoiceId(voiceId: string): boolean {
  return VOICE_ID_PATTERN.test(voiceId);
}

export const gameRoutes = new Hono();

/**
 * POST /api/session - Create a new game session
 */
gameRoutes.post("/session", (c) => {
  const session = sessionStore.create();
  return c.json({
    id: session.id,
    createdAt: session.createdAt.toISOString(),
  });
});

/**
 * GET /api/session/:id - Validate and get session info
 */
gameRoutes.get("/session/:id", (c) => {
  const id = c.req.param("id");

  if (!isValidSessionId(id)) {
    return c.json({ error: "Invalid session ID format" }, 400);
  }

  const session = sessionStore.get(id);

  if (!session) {
    return c.json({ error: "Session not found" }, 404);
  }

  return c.json({
    id: session.id,
    createdAt: session.createdAt.toISOString(),
    lastAccess: session.lastAccess.toISOString(),
    data: session.data,
  });
});

/**
 * PATCH /api/session/:id - Update session data
 */
gameRoutes.patch("/session/:id", async (c) => {
  const id = c.req.param("id");

  if (!isValidSessionId(id)) {
    return c.json({ error: "Invalid session ID format" }, 400);
  }

  const data = await c.req.json<Record<string, unknown>>();

  const session = sessionStore.update(id, data);

  if (!session) {
    return c.json({ error: "Session not found" }, 404);
  }

  return c.json({
    id: session.id,
    data: session.data,
  });
});

/**
 * DELETE /api/session/:id - End a session
 */
gameRoutes.delete("/session/:id", (c) => {
  const id = c.req.param("id");

  if (!isValidSessionId(id)) {
    return c.json({ error: "Invalid session ID format" }, 400);
  }

  const deleted = sessionStore.delete(id);

  if (!deleted) {
    return c.json({ error: "Session not found" }, 404);
  }

  return c.json({ success: true });
});

/**
 * POST /api/tts - Generate speech from text
 * Body: { text: string, voiceId?: string }
 */
gameRoutes.post("/tts", async (c) => {
  try {
    const { text, voiceId } = await c.req.json<{
      text: string;
      voiceId?: string;
    }>();

    if (!text || typeof text !== "string") {
      return c.json({ error: "Text is required" }, 400);
    }

    if (text.length > MAX_TTS_TEXT_LENGTH) {
      return c.json(
        { error: `Text exceeds maximum length of ${MAX_TTS_TEXT_LENGTH} characters` },
        400
      );
    }

    if (voiceId !== undefined && !isValidVoiceId(voiceId)) {
      return c.json({ error: "Invalid voice ID format" }, 400);
    }

    const ttsService = getTTSService();
    const audioBuffer = await ttsService.generateSpeech(text, voiceId);

    return new Response(audioBuffer, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Length": audioBuffer.byteLength.toString(),
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "TTS generation failed";
    return c.json({ error: message }, 500);
  }
});

/**
 * GET /api/voices - Get available TTS voices
 */
gameRoutes.get("/voices", async (c) => {
  try {
    const ttsService = getTTSService();
    const voices = await ttsService.getVoices();
    return c.json({ voices });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to fetch voices";
    return c.json({ error: message }, 500);
  }
});
