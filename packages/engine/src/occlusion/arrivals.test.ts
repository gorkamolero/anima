import { describe, expect, it } from "vitest";
import { passageArrival } from "./arrivals";

const area = {
	mask: {
		width: 8,
		height: 8,
		data: Array.from({ length: 64 }, (_, i) => (i >= 18 && i < 48 ? 1 : 0)),
	},
	perspective: { horizonY: 0, slope: 0.001 },
	baseScale: 1,
	scaleClamp: { min: 0, max: 2 },
};
describe("perspective passage arrivals", () => {
	it("starts far at the smallest reachable floor depth", () => {
		expect(passageArrival(area, { x: 840, y: 600 }, "far", 1064)).toEqual({
			x: 840,
			y: 337.5,
		});
	});
	it("starts near at the lowest floor row above the caption limit", () => {
		expect(passageArrival(area, { x: 840, y: 400 }, "near", 700)).toEqual({
			x: 840,
			y: 607.5,
		});
	});
	it("rejects missing floor", () => {
		expect(() =>
			passageArrival(
				{ ...area, mask: { ...area.mask, data: area.mask.data.map(() => 0) } },
				{ x: 840, y: 400 },
				"far",
				1064,
			),
		).toThrow();
	});
});
