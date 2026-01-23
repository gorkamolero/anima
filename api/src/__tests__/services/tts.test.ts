import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { createTTSService, type TTSService, type Voice } from "../../services/tts.js";

describe("TTS Service", () => {
  const mockApiKey = "test-api-key";
  const mockVoiceId = "test-voice-id";
  let ttsService: TTSService;

  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("createTTSService", () => {
    it("should throw error if API key is not provided", () => {
      expect(() => createTTSService({ apiKey: "" })).toThrow(
        "TTS service requires an API key"
      );
    });

    it("should create service with valid config", () => {
      const service = createTTSService({ apiKey: mockApiKey });
      expect(service).toBeDefined();
      expect(service.generateSpeech).toBeDefined();
      expect(service.getVoices).toBeDefined();
    });
  });

  describe("generateSpeech", () => {
    beforeEach(() => {
      ttsService = createTTSService({
        apiKey: mockApiKey,
        defaultVoiceId: mockVoiceId,
      });
    });

    it("should throw error if no voice ID provided and no default", async () => {
      const service = createTTSService({ apiKey: mockApiKey });

      await expect(service.generateSpeech("Hello")).rejects.toThrow(
        "No voice ID provided and no default voice configured"
      );
    });

    it("should call ElevenLabs API with correct parameters", async () => {
      const mockAudioBuffer = new ArrayBuffer(100);
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockAudioBuffer),
      } as Response);

      const result = await ttsService.generateSpeech("Hello, world!");

      expect(fetch).toHaveBeenCalledWith(
        `https://api.elevenlabs.io/v1/text-to-speech/${mockVoiceId}`,
        expect.objectContaining({
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "xi-api-key": mockApiKey,
          },
          body: expect.stringContaining("Hello, world!"),
        })
      );
      expect(result).toBe(mockAudioBuffer);
    });

    it("should use provided voice ID over default", async () => {
      const customVoiceId = "custom-voice-id";
      const mockAudioBuffer = new ArrayBuffer(100);
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(mockAudioBuffer),
      } as Response);

      await ttsService.generateSpeech("Hello", customVoiceId);

      expect(fetch).toHaveBeenCalledWith(
        `https://api.elevenlabs.io/v1/text-to-speech/${customVoiceId}`,
        expect.any(Object)
      );
    });

    it("should throw error on API failure", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 401,
        text: () => Promise.resolve("Unauthorized"),
      } as Response);

      await expect(ttsService.generateSpeech("Hello")).rejects.toThrow(
        "TTS generation failed: 401 - Unauthorized"
      );
    });

    it("should use custom base URL if provided", async () => {
      const customBaseUrl = "https://custom.api.com";
      const service = createTTSService({
        apiKey: mockApiKey,
        defaultVoiceId: mockVoiceId,
        baseUrl: customBaseUrl,
      });

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(100)),
      } as Response);

      await service.generateSpeech("Hello");

      expect(fetch).toHaveBeenCalledWith(
        `${customBaseUrl}/text-to-speech/${mockVoiceId}`,
        expect.any(Object)
      );
    });
  });

  describe("getVoices", () => {
    beforeEach(() => {
      ttsService = createTTSService({
        apiKey: mockApiKey,
      });
    });

    it("should fetch and return voices", async () => {
      const mockVoices: Voice[] = [
        { voice_id: "voice1", name: "Voice One", category: "premade" },
        { voice_id: "voice2", name: "Voice Two", category: "cloned" },
      ];

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ voices: mockVoices }),
      } as Response);

      const voices = await ttsService.getVoices();

      expect(fetch).toHaveBeenCalledWith(
        "https://api.elevenlabs.io/v1/voices",
        expect.objectContaining({
          headers: {
            "xi-api-key": mockApiKey,
          },
        })
      );
      expect(voices).toEqual(mockVoices);
    });

    it("should throw error on API failure", async () => {
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: false,
        status: 500,
        text: () => Promise.resolve("Internal Server Error"),
      } as Response);

      await expect(ttsService.getVoices()).rejects.toThrow(
        "Failed to fetch voices: 500 - Internal Server Error"
      );
    });
  });
});
