import { describe, expect, it } from "vitest";
import { GroundLine } from "../../groundline";

describe("GroundLine", () => {
	it("keeps existing linear interpolation behavior", () => {
		const line = new GroundLine({
			points: [
				{ x: 0, y: 100 },
				{ x: 100, y: 200 },
			],
			perspectiveScale: {
				backgroundY: 100,
				foregroundY: 200,
				minScale: 0.5,
			},
		});

		expect(line.getYAtX(50)).toBe(150);
		expect(line.getPositionData(50, 1)).toEqual({ y: 150, scale: 0.75 });
	});

	it("interpolates calibrated scale factors by X before falling back to perspective", () => {
		const line = new GroundLine({
			points: [
				{ x: 0, y: 100, scaleFactor: 1 },
				{ x: 100, y: 200, scaleFactor: 0.8 },
			],
			perspectiveScale: {
				backgroundY: 100,
				foregroundY: 200,
				minScale: 0.5,
			},
		});

		expect(line.getPositionData(50, 0.5)).toEqual({ y: 150, scale: 0.45 });
	});

	it("uses Catmull-Rom interpolation for smoother calibrated paths", () => {
		const line = new GroundLine({
			interpolation: "catmull-rom",
			points: [
				{ x: 0, y: 100, scaleFactor: 1 },
				{ x: 100, y: 150, scaleFactor: 0.9 },
				{ x: 200, y: 140, scaleFactor: 0.85 },
				{ x: 300, y: 180, scaleFactor: 0.95 },
			],
		});

		const midpoint = line.getPositionData(150, 1);

		expect(midpoint.y).toBeCloseTo(145.625, 3);
		expect(midpoint.scale).toBeCloseTo(0.8625, 4);
	});
});
