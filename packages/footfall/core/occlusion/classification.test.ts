import { describe, expect, it } from "vitest";
import { objectFootprints } from "./footprints";
import {
	classifyOccluder,
	depthForOccluder,
	isBehind,
	type Occluder,
} from "./occlusion";

const perspective = { constant: 1, horizonY: 0, slope: 0, pixelsPerMetre: 300 };
const object: Occluder = {
	id: "net",
	label: "net pile",
	bbox: { x: 100, y: 800, w: 100, h: 50 },
	baseline: [
		{ x: 100, y: 850 },
		{ x: 200, y: 850 },
	],
	png: "net.png",
};
describe("low floor clutter", () => {
	it("draws a low net pile below the character while retaining its obstacle", () => {
		const o = classifyOccluder(object, perspective);
		expect(o.floorDecal).toBe(true);
		expect(o.obstacle).toBe(true);
		expect(isBehind({ x: 150, y: 825 }, o)).toBe(false);
		expect(depthForOccluder(o, 150)).toBe(0);
	});
	it("keeps tall furniture as an occluder", () => {
		expect(
			classifyOccluder(
				{ ...object, bbox: { ...object.bbox, y: 400, h: 450 } },
				perspective,
			).floorDecal,
		).toBe(false);
	});
	it("makes scattered flat debris decor without an obstacle footprint", () => {
		const o = classifyOccluder(
			{ ...object, label: "scattered debris" },
			perspective,
		);
		expect(o.obstacle).toBe(false);
		const grid = { width: 192, height: 108, data: Array(192 * 108).fill(1) };
		expect(
			objectFootprints(
				grid,
				[{ data: o, alpha: () => true }],
				perspective,
			).data.some(Boolean),
		).toBe(false);
	});
	it("uses height at baseline depth rather than pixel height alone", () => {
		const p = { horizonY: 400, slope: 0.002, pixelsPerMetre: 300 };
		expect(classifyOccluder(object, p).floorDecal).toBe(true);
		expect(
			classifyOccluder(
				{
					...object,
					bbox: { ...object.bbox, y: 450 },
					baseline: [{ x: 150, y: 500 }],
				},
				p,
			).floorDecal,
		).toBe(false);
	});
});
