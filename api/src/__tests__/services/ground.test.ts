// @vitest-environment node
import { describe, expect, it } from "vitest";
import { fitPlane, maskToGround, scaleAt } from "../../services/ground.js";

describe("ground geometry", () => {
	it("fits a floor plane and its horizon independently of slope and camera roll", () => {
		const width = 40,
			height = 30;
		const mask = {
			width,
			height,
			data: Array.from({ length: width * height }, (_, i) =>
				Math.floor(i / width) > 10 ? 1 : 0,
			),
		};
		const depth = {
			width,
			height,
			data: mask.data.map(
				(_, i) =>
					(0.1 * (i % width)) / width +
					(2 * Math.floor(i / width)) / height -
					0.65,
			),
		};
		expect(fitPlane(mask, depth).horizonY).toBeCloseTo(324, 6);
	});
	it("derives mid-depth line, respects missing columns, and scales toward camera", () => {
		const width = 60,
			height = 40;
		const mask = {
			width,
			height,
			data: Array.from({ length: width * height }, (_, i) =>
				Math.floor(i / width) >= 20 && (i % width < 25 || i % width > 30)
					? 1
					: 0,
			),
		};
		const ground = maskToGround(mask, 300, 0.002, 0.5);
		expect(ground.groundLine.points).toHaveLength(6);
		expect(ground.groundLine.points[0].y).toBeCloseTo(796.5);
		expect(ground.freeWalkRanges).toHaveLength(2);
		expect(scaleAt(900, 300, 0.002)).toBeCloseTo(1.2);
		expect(scaleAt(600, 300, 0.002)).toBeCloseTo(0.6);
		expect(() =>
			maskToGround({ ...mask, data: mask.data.map(() => 0) }, 300, 0.002),
		).toThrow();
	});
});
