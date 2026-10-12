import { describe, expect, it } from "vitest";
import { erode } from "../walkarea/navigation";
import { bridgeOccluders, floorPixel } from "./bridge";
import { objectFootprints, subtractFootprints } from "./footprints";

const perspective = { horizonY: 0, slope: 1 / 800, pixelsPerMetre: 300 };
const layer = {
	data: {
		id: "net",
		label: "net",
		bbox: { x: 800, y: 400, w: 200, h: 410 },
		baseline: [{ x: 900, y: 800 }],
		png: "net.png",
	},
	alpha: (x: number, y: number) =>
		x >= 800 && x <= 1000 && y >= 400 && y <= 810,
};
describe("object supports", () => {
	it("preserves a bridge behind the support, excludes the base and gives the body clearance", () => {
		const mask = { width: 384, height: 216, data: Array(384 * 216).fill(1) };
		for (let i = 0; i < mask.data.length; i++) {
			const x = ((i % 384) + 0.5) * 5,
				y = (Math.floor(i / 384) + 0.5) * 5;
			if (layer.alpha(x, y)) mask.data[i] = 0;
		}
		bridgeOccluders(mask, [layer]);
		const footprints = objectFootprints(mask, [layer], perspective);
		subtractFootprints(mask, footprints);
		expect(floorPixel(mask, 900, 700)).toBe(true);
		expect(floorPixel(mask, 900, 780)).toBe(false);
		expect(floorPixel(mask, 900, 805)).toBe(false);
		expect(floorPixel(mask, 1020, 790)).toBe(true);
		expect(floorPixel(erode(mask, perspective), 1020, 790)).toBe(false);
		for (let i = 0; i < mask.data.length; i++)
			expect(mask.data[i] && footprints.data[i]).toBe(0);
	});
	it("rejects mismatched raster coordinates", () => {
		expect(() =>
			subtractFootprints(
				{ width: 1, height: 1, data: [1] },
				{ width: 2, height: 1, data: [1, 0] },
			),
		).toThrow();
	});
});
