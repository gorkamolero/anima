import { afterEach, describe, expect, it, vi } from "vitest";
import { speakCaption } from "./narratorVoice";

afterEach(() => {
	vi.unstubAllGlobals();
	vi.useRealTimers();
});
describe("Caption voice fallback", () => {
	it("uses reading time without making a muted request", async () => {
		vi.useFakeTimers();
		const fetch = vi.fn();
		vi.stubGlobal("fetch", fetch);
		const voice = speakCaption("A short line.", "/api", true);
		let finished = false;
		void voice.full.then(() => {
			finished = true;
		});
		await vi.advanceTimersByTimeAsync(2499);
		expect(finished).toBe(false);
		await vi.advanceTimersByTimeAsync(1);
		expect(finished).toBe(true);
		expect(fetch).not.toHaveBeenCalled();
		voice.stop();
	});
	it("falls back to reading time on an HTTP audio failure", async () => {
		vi.useFakeTimers();
		vi.stubGlobal(
			"fetch",
			vi.fn().mockResolvedValue({ ok: false, status: 503 }),
		);
		const text =
			"A sufficiently long line that needs more than two and a half seconds.";
		const voice = speakCaption(text, "/api", false);
		let finished = false;
		void voice.full.then(() => {
			finished = true;
		});
		await vi.advanceTimersByTimeAsync(2500);
		expect(finished).toBe(false);
		await vi.advanceTimersByTimeAsync(text.length * 60 - 2500);
		expect(finished).toBe(true);
		expect(voice.status.error).toContain("503");
		voice.stop();
	});
});
