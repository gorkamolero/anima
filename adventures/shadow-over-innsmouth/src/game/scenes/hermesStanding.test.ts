import { describe, expect, it } from "vitest";
import { hermesStanding } from "./hermesStanding";

describe("Hermes standing headings", () => {
	it.each([
		["left", "hermes-idle-v2-normalized", false],
		["right", "hermes-idle-v2-normalized", true],
		["away", "hermes-stand-away", false],
		["toward", "hermes-stand-toward", false],
		["away-right", "hermes-stand-away-right", false],
		["away-left", "hermes-stand-away-right", true],
		["toward-right", "hermes-stand-toward-right", false],
		["toward-left", "hermes-stand-toward-right", true],
	] as const)("%s uses %s (mirror %s)", (heading, texture, flipX) => {
		expect(hermesStanding(heading)).toEqual({ texture, flipX });
	});
});
