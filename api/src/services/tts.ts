/**
 * Text-to-Speech service using ElevenLabs API
 * Provides voice synthesis for game dialogue
 */

export interface TTSConfig {
  apiKey: string;
  defaultVoiceId?: string;
  baseUrl?: string;
  /** TTS model ID (default: eleven_monolingual_v1) */
  modelId?: string;
  /** Voice stability 0-1 (default: 0.5) */
  stability?: number;
  /** Voice similarity boost 0-1 (default: 0.75) */
  similarityBoost?: number;
}

export interface Voice {
  voice_id: string;
  name: string;
  category?: string;
  description?: string;
}

export interface TTSService {
  generateSpeech(text: string, voiceId?: string): Promise<ArrayBuffer>;
  getVoices(): Promise<Voice[]>;
}

const ELEVENLABS_BASE_URL = "https://api.elevenlabs.io/v1";
const FETCH_TIMEOUT_MS = 30000; // 30 second timeout
const DEFAULT_MODEL_ID = "eleven_monolingual_v1";
const DEFAULT_STABILITY = 0.5;
const DEFAULT_SIMILARITY_BOOST = 0.75;

/**
 * Create a TTS service instance
 */
export function createTTSService(config: TTSConfig): TTSService {
  const {
    apiKey,
    defaultVoiceId,
    baseUrl = ELEVENLABS_BASE_URL,
    modelId = DEFAULT_MODEL_ID,
    stability = DEFAULT_STABILITY,
    similarityBoost = DEFAULT_SIMILARITY_BOOST,
  } = config;

  if (!apiKey) {
    throw new Error("TTS service requires an API key");
  }

  /**
   * Generate speech audio from text
   */
  async function generateSpeech(
    text: string,
    voiceId?: string
  ): Promise<ArrayBuffer> {
    const voice = voiceId ?? defaultVoiceId;
    if (!voice) {
      throw new Error("No voice ID provided and no default voice configured");
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/text-to-speech/${voice}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "xi-api-key": apiKey,
        },
        body: JSON.stringify({
          text,
          model_id: modelId,
          voice_settings: {
            stability,
            similarity_boost: similarityBoost,
          },
        }),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`TTS generation failed: ${response.status} - ${error}`);
    }

    return response.arrayBuffer();
  }

  /**
   * Get available voices from ElevenLabs
   */
  async function getVoices(): Promise<Voice[]> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let response: Response;
    try {
      response = await fetch(`${baseUrl}/voices`, {
        headers: {
          "xi-api-key": apiKey,
        },
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to fetch voices: ${response.status} - ${error}`);
    }

    const data = (await response.json()) as { voices: Voice[] };
    return data.voices;
  }

  return {
    generateSpeech,
    getVoices,
  };
}

// Singleton instance - initialized when API key is available
let ttsServiceInstance: TTSService | null = null;

/**
 * Get or create the TTS service instance.
 * Reads configuration from environment variables:
 * - ELEVENLABS_API_KEY (required)
 * - ELEVENLABS_DEFAULT_VOICE_ID (optional)
 * - TTS_MODEL_ID (optional, default: eleven_monolingual_v1)
 * - TTS_STABILITY (optional, default: 0.5)
 * - TTS_SIMILARITY_BOOST (optional, default: 0.75)
 */
export function getTTSService(): TTSService {
  if (!ttsServiceInstance) {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      throw new Error("ELEVENLABS_API_KEY environment variable is not set");
    }
    ttsServiceInstance = createTTSService({
      apiKey,
      defaultVoiceId: process.env.ELEVENLABS_DEFAULT_VOICE_ID,
      modelId: process.env.TTS_MODEL_ID,
      stability: process.env.TTS_STABILITY
        ? parseFloat(process.env.TTS_STABILITY)
        : undefined,
      similarityBoost: process.env.TTS_SIMILARITY_BOOST
        ? parseFloat(process.env.TTS_SIMILARITY_BOOST)
        : undefined,
    });
  }
  return ttsServiceInstance;
}
