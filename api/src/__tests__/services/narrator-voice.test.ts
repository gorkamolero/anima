import { afterEach, expect, it, vi } from "vitest";
import {
	isAudioMuted,
	speakCaption,
} from "../../../../adventures/shadow-over-innsmouth/src/game/narratorVoice";

afterEach(() => {
	vi.useRealTimers();
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});
it("mutes fetching and playback while keeping the reading gate", async () => {
	vi.useFakeTimers();
	const fetcher = vi.fn();
	const audio = vi.fn();
	vi.stubGlobal("fetch", fetcher);
	vi.stubGlobal("Audio", audio);
	expect(isAudioMuted("?mute=1")).toBe(true);
	expect(isAudioMuted("")).toBe(false);
	const speech = speakCaption("Hello.", "/api", true);
	await vi.advanceTimersByTimeAsync(2500);
	await speech.full;
	expect(fetcher).not.toHaveBeenCalled();
	expect(audio).not.toHaveBeenCalled();
});
it("speaks through TTS and gates the image on the first sentence ending", async () => {
	vi.useFakeTimers();
	const audios: Array<{
		onended?: () => void;
		play: ReturnType<typeof vi.fn>;
	}> = [];
	vi.stubGlobal(
		"Audio",
		class {
			onended?: () => void;
			play = vi.fn().mockResolvedValue(undefined);
			pause = vi.fn();
			constructor() {
				audios.push(this);
			}
		},
	);
	const fetcher = vi
		.fn()
		.mockResolvedValue({ ok: true, blob: async () => new Blob() });
	vi.stubGlobal("fetch", fetcher);
	vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
	vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
	const speech = speakCaption(
		"First sentence. Second sentence.",
		"/api",
		false,
	);
	await vi.advanceTimersByTimeAsync(0);
	expect(speech.status.firstSentencePlayed).toBe(false);
	expect(audios[0].play).toHaveBeenCalled();
	audios[0].onended?.();
	await speech.first;
	expect(speech.status.firstSentencePlayed).toBe(true);
	await vi.advanceTimersByTimeAsync(0);
	audios[1].onended?.();
	await speech.full;
	expect(JSON.parse(fetcher.mock.calls[0][1].body).text).toBe(
		"First sentence.",
	);
	expect(JSON.parse(fetcher.mock.calls[1][1].body).text).toBe(
		"Second sentence.",
	);
	speech.stop();
});
it("falls back to reading time when TTS fails", async () => {
	vi.useFakeTimers();
	vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
	const speech = speakCaption("Hello.", "/api", false);
	let ready = false;
	void speech.first.then(() => {
		ready = true;
	});
	await vi.advanceTimersByTimeAsync(100);
	expect(ready).toBe(false);
	await vi.advanceTimersByTimeAsync(2400);
	await speech.full;
	expect(ready).toBe(true);
	expect(speech.status.error).toContain("offline");
});

it("keeps the reading fallback when browser autoplay rejects speech", async () => {
	vi.useFakeTimers();
	vi.stubGlobal(
		"fetch",
		vi.fn().mockResolvedValue({ ok: true, blob: async () => new Blob() }),
	);
	vi.stubGlobal(
		"Audio",
		class {
			play = vi.fn().mockRejectedValue(new Error("autoplay blocked"));
		},
	);
	vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
	const revoke = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
	const speech = speakCaption("Hello.", "/api", false);
	let ready = false;
	void speech.first.then(() => {
		ready = true;
	});
	await vi.advanceTimersByTimeAsync(100);
	expect(ready).toBe(false);
	await vi.advanceTimersByTimeAsync(2400);
	await speech.full;
	expect(speech.status.firstSentencePlayed).toBe(false);
	expect(speech.status.error).toContain("autoplay blocked");
	expect(revoke).toHaveBeenCalledWith("blob:test");
});
