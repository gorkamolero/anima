// @vitest-environment node
import { describe, expect, it } from "vitest";
import { canOcclude, maskGeometry } from "../../services/occluders.js";

describe("hard-scene occluders", () => {
	it("includes interior furniture and fountain while excluding floor", () => {
		for (const name of [
			"front pew",
			"stone pillar",
			"reception desk",
			"counter",
			"fountain",
			"shelves",
		])
			expect(canOcclude({ name, bounds: [0, 0, 1, 1] })).toBe(true);
		expect(canOcclude({ name: "wooden floor", bounds: [0, 0, 1, 1] })).toBe(
			false,
		);
	});
	it("rejects a floating contact baseline when a floor mask is available", () => {
		const mask = {
			width: 100,
			height: 100,
			data: Array.from({ length: 10000 }, (_, i) =>
				i % 100 > 30 &&
				i % 100 < 50 &&
				Math.floor(i / 100) > 30 &&
				Math.floor(i / 100) < 50
					? 1
					: 0,
			),
		};
		const floor = {
			...mask,
			data: mask.data.map((_, i) => (Math.floor(i / 100) > 80 ? 1 : 0)),
		};
		expect(maskGeometry(mask, floor)).toBeUndefined();
	});
});
