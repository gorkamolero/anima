import { expect, it } from "vitest";
import { continuationFor } from "./storyContinuation";

it("carries inventory and reef path flags through the explicit act boundary", () => {
	const state = {
		scene: "ACT4_TRANSITION",
		inventory: ["notebook"],
		flags: { surface_path: true, kat_left_note: true },
	};
	expect(
		continuationFor("3b", {
			state,
			output: [],
			choices: [],
			ended: true,
			ending: "ACT_END",
		}),
	).toEqual({ next: "4", state });
});
it("keeps the abyssal ending final", () => {
	expect(
		continuationFor("3b", {
			state: { scene: "GAME_END_ABYSSAL", inventory: [], flags: {} },
			output: [],
			choices: [],
			ended: true,
			ending: "GAME_END_ABYSSAL",
		}),
	).toBeUndefined();
});
