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
	it.each([
		"rug",
		"rugs-0",
		"carpet",
		"carpets-2",
	])("keeps a depth-spanning %s below feet and out of collision", (label) => {
		const rug = classifyOccluder(
			{
				...object,
				id: "rugs-0-upright",
				label,
				bbox: { x: 100, y: 300, w: 1500, h: 700 },
				floorDecal: false,
				floorDecalSource: "height" as const,
				obstacle: true,
			},
			perspective,
		);
		expect(rug.floorDecal).toBe(true);
		expect(rug.obstacle).toBe(false);
		expect(depthForOccluder(rug, 150)).toBe(0);
		expect(isBehind({ x: 150, y: 825 }, rug)).toBe(false);
	});
	it("does not flatten a rolled carpet or a rug display", () => {
		for (const label of ["rolled carpet", "rug display"])
			expect(
				classifyOccluder(
					{ ...object, label, bbox: { ...object.bbox, y: 300, h: 550 } },
					perspective,
				).obstacle,
			).toBe(true);
	});
	it("recalculates height-derived layers when perspective is corrected", () => {
		const low = classifyOccluder(object, perspective);
		const corrected = classifyOccluder(low, { ...perspective, constant: 0.5 });
		expect(corrected.floorDecal).toBe(false);
		expect(corrected.obstacle).toBe(true);
		expect(isBehind({ x: 150, y: 825 }, corrected)).toBe(true);
	});
	it("recovers an upright cached post without lifting its explicitly flat split", () => {
		const post = {
			...object,
			id: "posts-1-upright",
			label: "post",
			layerDerivation: 22,
			floorDecal: true,
		};
		const p = { ...perspective, constant: 0.5 };
		expect(classifyOccluder(post, p).floorDecal).toBe(false);
		expect(
			classifyOccluder({ ...post, id: "posts-1-flat" }, p).floorDecal,
		).toBe(true);
	});
	it("preserves explicit flat artwork across repeated recalibration", () => {
		const explicit = classifyOccluder(
			{ ...object, floorDecal: true },
			perspective,
		);
		expect(
			classifyOccluder(explicit, { ...perspective, constant: 0.1 }).floorDecal,
		).toBe(true);
	});
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
