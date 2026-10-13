// @vitest-environment node

import { depthRegions } from "@anima/footfall/core/walkarea/regions";
import { describe, expect, it } from "vitest";

describe("local depth scale regions", () => {
	it("allows different scale at the same screen height and never invents floor membership", () => {
		const width = 30,
			height = 30;
		const floor = {
			width,
			height,
			data: Array.from({ length: 900 }, (_, i) => (i % 30 === 15 ? 0 : 1)),
		};
		const depth = {
			width,
			height,
			data: floor.data.map((_, i) => (i % 30 < 15 ? 100 : 200)),
		};
		const regions = depthRegions(floor, depth, undefined, 200, 1);
		const left = regions.find((r) => r.id === "floor-0-1");
		const right = regions.find((r) => r.id === "floor-2-1");
		expect(left?.scaleAtY[0].scaleFactor).toBe(0.5);
		expect(right?.scaleAtY[0].scaleFactor).toBe(1);
		for (let i = 0; i < 900; i++)
			expect(regions.filter((r) => r.mask.data[i]).length).toBe(floor.data[i]);
		expect(regions.some((r) => r.kind === "stairs")).toBe(false);
	});
	it("stair membership requires segmented pixels, and overrides no other area", () => {
		const floor = { width: 30, height: 30, data: Array(900).fill(1) };
		const stairs = {
			...floor,
			data: floor.data.map((_, i) => (i % 30 < 8 ? 1 : 0)),
		};
		const depth = {
			...floor,
			data: floor.data.map((_, i) => 100 + Math.floor(i / 30) * 3),
		};
		const regions = depthRegions(floor, depth, stairs, 200, 1);
		expect(regions.some((r) => r.kind === "stairs")).toBe(true);
		for (let i = 0; i < 900; i++)
			expect(regions.filter((r) => r.mask.data[i]).map((r) => r.kind)).toEqual([
				stairs.data[i] ? "stairs" : "floor",
			]);
	});
});
