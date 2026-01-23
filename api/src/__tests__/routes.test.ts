import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { app } from "../index.js";

describe("API Routes", () => {
  describe("GET /api/health", () => {
    it("should return health status", async () => {
      const res = await app.request("/api/health");
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.status).toBe("ok");
      expect(json.timestamp).toBeDefined();
    });
  });

  describe("Session Routes", () => {
    let sessionId: string;

    describe("POST /api/session", () => {
      it("should create a new session", async () => {
        const res = await app.request("/api/session", {
          method: "POST",
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.id).toBeDefined();
        expect(json.id).toMatch(/^sess_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
        expect(json.createdAt).toBeDefined();

        sessionId = json.id;
      });
    });

    describe("GET /api/session/:id", () => {
      it("should return session info for valid session", async () => {
        // Create session first
        const createRes = await app.request("/api/session", { method: "POST" });
        const createJson = await createRes.json();
        sessionId = createJson.id;

        const res = await app.request(`/api/session/${sessionId}`);
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.id).toBe(sessionId);
        expect(json.createdAt).toBeDefined();
        expect(json.lastAccess).toBeDefined();
      });

      it("should return 404 for non-existent session", async () => {
        const res = await app.request("/api/session/sess_00000000-0000-0000-0000-000000000000");
        const json = await res.json();

        expect(res.status).toBe(404);
        expect(json.error).toBe("Session not found");
      });
    });

    describe("PATCH /api/session/:id", () => {
      it("should update session data", async () => {
        // Create session first
        const createRes = await app.request("/api/session", { method: "POST" });
        const createJson = await createRes.json();
        sessionId = createJson.id;

        const res = await app.request(`/api/session/${sessionId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ score: 100, level: 5 }),
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.id).toBe(sessionId);
        expect(json.data).toEqual({ score: 100, level: 5 });
      });

      it("should return 404 for non-existent session", async () => {
        const res = await app.request("/api/session/sess_00000000-0000-0000-0000-000000000000", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ foo: "bar" }),
        });
        const json = await res.json();

        expect(res.status).toBe(404);
        expect(json.error).toBe("Session not found");
      });
    });

    describe("DELETE /api/session/:id", () => {
      it("should delete existing session", async () => {
        // Create session first
        const createRes = await app.request("/api/session", { method: "POST" });
        const createJson = await createRes.json();
        sessionId = createJson.id;

        const res = await app.request(`/api/session/${sessionId}`, {
          method: "DELETE",
        });
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.success).toBe(true);

        // Verify session is deleted
        const getRes = await app.request(`/api/session/${sessionId}`);
        expect(getRes.status).toBe(404);
      });

      it("should return 404 for non-existent session", async () => {
        const res = await app.request("/api/session/sess_00000000-0000-0000-0000-000000000000", {
          method: "DELETE",
        });
        const json = await res.json();

        expect(res.status).toBe(404);
        expect(json.error).toBe("Session not found");
      });
    });
  });

  describe("TTS Routes", () => {
    beforeEach(() => {
      vi.stubEnv("ELEVENLABS_API_KEY", "test-api-key");
      vi.stubEnv("ELEVENLABS_DEFAULT_VOICE_ID", "test-voice-id");
      vi.stubGlobal("fetch", vi.fn());
    });

    afterEach(() => {
      vi.unstubAllEnvs();
      vi.unstubAllGlobals();
    });

    describe("POST /api/tts", () => {
      it("should return 400 if text is missing", async () => {
        const res = await app.request("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        const json = await res.json();

        expect(res.status).toBe(400);
        expect(json.error).toBe("Text is required");
      });

      it("should return audio buffer on success", async () => {
        const mockAudioBuffer = new ArrayBuffer(100);
        vi.mocked(fetch).mockResolvedValueOnce({
          ok: true,
          arrayBuffer: () => Promise.resolve(mockAudioBuffer),
        } as Response);

        const res = await app.request("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: "Hello, world!" }),
        });

        expect(res.status).toBe(200);
        expect(res.headers.get("Content-Type")).toBe("audio/mpeg");
      });

      it("should handle TTS service errors", async () => {
        vi.mocked(fetch).mockResolvedValueOnce({
          ok: false,
          status: 401,
          text: () => Promise.resolve("Unauthorized"),
        } as Response);

        const res = await app.request("/api/tts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: "Hello" }),
        });
        const json = await res.json();

        expect(res.status).toBe(500);
        expect(json.error).toContain("TTS generation failed");
      });
    });

    describe("GET /api/voices", () => {
      it("should return list of voices", async () => {
        const mockVoices = [
          { voice_id: "voice1", name: "Voice One" },
          { voice_id: "voice2", name: "Voice Two" },
        ];

        vi.mocked(fetch).mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ voices: mockVoices }),
        } as Response);

        const res = await app.request("/api/voices");
        const json = await res.json();

        expect(res.status).toBe(200);
        expect(json.voices).toEqual(mockVoices);
      });

      it("should handle errors", async () => {
        vi.mocked(fetch).mockResolvedValueOnce({
          ok: false,
          status: 500,
          text: () => Promise.resolve("Server error"),
        } as Response);

        const res = await app.request("/api/voices");
        const json = await res.json();

        expect(res.status).toBe(500);
        expect(json.error).toContain("Failed to fetch voices");
      });
    });
  });
});
