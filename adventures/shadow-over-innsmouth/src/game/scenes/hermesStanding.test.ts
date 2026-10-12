import { describe, expect, it } from "vitest";
import { hermesStanding } from "./hermesStanding";

describe("Hermes standing headings", () => {
	it.each([
		["left", "hermes-passing-stand-side", false],
		["right", "hermes-passing-stand-side", true],
		["away", "hermes-passing-stand-away", false],
		["toward", "hermes-passing-stand-toward", false],
		["away-right", "hermes-passing-stand-away-right", false],
		["away-left", "hermes-passing-stand-away-right", true],
		["toward-right", "hermes-passing-stand-toward-right", false],
		["toward-left", "hermes-passing-stand-toward-right", true],
	] as const)("%s uses %s (mirror %s)", (heading, texture, flipX) => {
		expect(hermesStanding(heading)).toEqual({ texture, flipX });
	});
});
