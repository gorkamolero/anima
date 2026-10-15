import { expect, it } from "vitest";
import { clearanceDistance } from "./clearanceDistance";

it("does not turn the goal's whole raster cell into a zero-distance region", () => {
	const remaining = clearanceDistance(
		{ width: 3, height: 1, data: [1, 1, 1] },
		{ x: 1600, y: 540 },
		(p) => p,
	);
	expect(remaining({ x: 1600, y: 540 })).toBe(0);
	expect(remaining({ x: 1500, y: 540 })).toBeCloseTo(100);
	expect(remaining({ x: 1700, y: 540 })).toBeCloseTo(100);
});

it("retains the necessary detour around an obstacle", () => {
	const remaining = clearanceDistance(
		{ width: 3, height: 3, data: [1, 1, 1, 1, 0, 1, 1, 1, 1] },
		{ x: 1600, y: 540 },
		(p) => p,
	);
	expect(remaining({ x: 320, y: 540 })).toBeGreaterThan(1280);
	expect(remaining({ x: 1600, y: 540 })).toBe(0);
});
