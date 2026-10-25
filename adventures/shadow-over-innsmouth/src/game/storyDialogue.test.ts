import { parseStoryScript, StoryRuntime } from "@anima/storyscript";
import { afterEach, describe, expect, it, vi } from "vitest";
import { StoryDialogue } from "./storyDialogue";

vi.mock("./narratorVoice", () => ({
	isAudioMuted: () => true,
	speakCaption: (text: string) => {
		let finish: () => void = () => {};
		const full = new Promise<void>((resolve) => {
			finish = resolve;
		});
		const timer = setTimeout(finish, Math.max(2500, text.length * 60));
		return {
			full,
			stop: () => {
				clearTimeout(timer);
				finish();
			},
		};
	},
}));
const source = `SCENE depot
  ON_ENTER
    hermes: "First."
    kat: "Second."
    CHOICE
      > "Continue"
        GIVE ticket
        -> END
    END
  END
END`;
let dialogue: StoryDialogue | undefined;
afterEach(() => {
	dialogue?.destroy();
	vi.useRealTimers();
});
describe("Story dialogue presentation", () => {
	it("advances after reading time and waits indefinitely for a choice", async () => {
		vi.useFakeTimers();
		const runtime = new StoryRuntime(parseStoryScript(source));
		const locked = vi.fn();
		dialogue = new StoryDialogue(
			runtime,
			"/api",
			locked,
			async () => undefined,
		);
		await dialogue.present(runtime.start());
		expect(dialogue.state?.text).toBe("First.");
		await vi.advanceTimersByTimeAsync(2499);
		expect(dialogue.state?.text).toBe("First.");
		await vi.advanceTimersByTimeAsync(1);
		expect(dialogue.state?.speaker).toBe("kat");
		await vi.advanceTimersByTimeAsync(2500);
		expect(dialogue.state?.choices).toHaveLength(1);
		const id = dialogue.state?.id;
		await vi.advanceTimersByTimeAsync(60000);
		expect(dialogue.state?.id).toBe(id);
		window.dispatchEvent(
			new CustomEvent("anima:dialogue-choice", { detail: { id, index: 0 } }),
		);
		await vi.advanceTimersByTimeAsync(2500);
		expect(dialogue.snapshot.state.inventory).toEqual(["ticket"]);
		expect(dialogue.state).toBeNull();
		expect(locked).toHaveBeenLastCalledWith(false);
	});
	it("ignores stale advances and cancellation cannot skip the next line", async () => {
		vi.useFakeTimers();
		const runtime = new StoryRuntime(parseStoryScript(source));
		dialogue = new StoryDialogue(
			runtime,
			"/api",
			vi.fn(),
			async () => undefined,
		);
		await dialogue.present(runtime.start());
		const id = dialogue.state?.id;
		window.dispatchEvent(
			new CustomEvent("anima:dialogue-advance", { detail: { id } }),
		);
		window.dispatchEvent(
			new CustomEvent("anima:dialogue-advance", { detail: { id } }),
		);
		await vi.advanceTimersByTimeAsync(0);
		expect(dialogue.state?.text).toBe("Second.");
		dialogue.destroy();
		await vi.advanceTimersByTimeAsync(60000);
		expect(dialogue.state).toBeNull();
	});
});
