// @vitest-environment node
import { expect, it } from "vitest";
import { deriveExits } from "../../services/exits.js";

it("does not infer onward travel into the closed end of an interior aisle", () => {
	const floor = {
		width: 40,
		height: 40,
		data: Array.from({ length: 1600 }, (_, i) =>
			Math.floor(i / 40) >= 10 &&
			Math.abs((i % 40) - 20) <= (Math.floor(i / 40) - 8) / 2
				? 1
				: 0,
		),
	};
	expect(deriveExits(floor, [], 100).some((e) => e.kind === "far")).toBe(true);
	expect(
		deriveExits(floor, [], 100, { allowFar: false }).some(
			(e) => e.kind === "far",
		),
	).toBe(false);
});
