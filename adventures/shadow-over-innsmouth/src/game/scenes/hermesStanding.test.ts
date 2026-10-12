import { describe, expect, it } from "vitest";
import { hermesStanding } from "./hermesStanding";

describe("Hermes standing headings", () => {
	it.each([
		["left", "hermes-matched-stand-side", false],
		["right", "hermes-matched-stand-side", true],
		["away", "hermes-matched-stand-away", false],
		["toward", "hermes-matched-stand-toward", false],
		["away-right", "hermes-matched-stand-away-right", false],
		["away-left", "hermes-matched-stand-away-right", true],
		["toward-right", "hermes-matched-stand-toward-right", false],
		["toward-left", "hermes-matched-stand-toward-right", true],
	] as const)("%s uses %s (mirror %s)", (heading, texture, flipX) => {
		expect(hermesStanding(heading)).toEqual({ texture, flipX });
	});
});
