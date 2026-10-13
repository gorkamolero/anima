import { type Exit, exitAt } from "@anima/footfall/core/occlusion/exits";
import {
	baselineYAt,
	depthFor,
	depthForOccluder,
	isBehind,
	type Occluder,
} from "@anima/footfall/core/occlusion/occlusion";
import { describe, expect, it } from "vitest";

const prop: Occluder = {
	id: "bench",
	label: "Bench",
	bbox: { x: 100, y: 200, w: 400, h: 500 },
	baseline: [
		{ x: 150, y: 600 },
		{ x: 450, y: 700 },
	],
	png: "bench.png",
};
describe("walk-behind depth contract", () => {
	it("interpolates sloping baselines and extends support endpoints under overhangs", () => {
		expect(baselineYAt(prop, 300)).toBe(650);
		expect(baselineYAt(prop, 100)).toBe(600);
		expect(baselineYAt(prop, 500)).toBe(700);
	});
	it("crossing a baseline switches ordering, with equality in front", () => {
		for (const x of [100, 200, 300, 450, 500]) {
			const y = baselineYAt(prop, x);
			expect(isBehind({ x, y: y - 1 }, prop)).toBe(true);
			expect(depthFor({ x, y: y - 1 })).toBeLessThan(depthForOccluder(prop, x));
			expect(isBehind({ x, y }, prop)).toBe(false);
			expect(isBehind({ x, y: y + 1 }, prop)).toBe(false);
			expect(depthFor({ x, y: y + 1 })).toBeGreaterThan(
				depthForOccluder(prop, x),
			);
		}
	});
	it("requires horizontal overlap and updates ordering during sideways movement", () => {
		expect(isBehind({ x: 99, y: 100 }, prop)).toBe(false);
		expect(isBehind({ x: 501, y: 100 }, prop)).toBe(false);
		expect(isBehind({ x: 150, y: 650 }, prop)).toBe(false);
		expect(isBehind({ x: 450, y: 650 }, prop)).toBe(true);
	});
	it("handles a single support and legacy empty baselines without NaN", () => {
		expect(baselineYAt({ ...prop, baseline: [{ x: 250, y: 650 }] }, 400)).toBe(
			650,
		);
		expect(baselineYAt({ ...prop, baseline: [] }, 300)).toBe(700);
	});
});
const exit: Exit = {
	id: "alley",
	kind: "far",
	region: [
		{ x: 0, y: 0 },
		{ x: 100, y: 0 },
		{ x: 100, y: 40 },
		{ x: 40, y: 40 },
		{ x: 40, y: 100 },
		{ x: 0, y: 100 },
	],
};
describe("exitAt", () => {
	it("respects concavity instead of treating exits as bounding boxes", () => {
		expect(exitAt({ x: 20, y: 80 }, [exit])).toBe(exit);
		expect(exitAt({ x: 80, y: 20 }, [exit])).toBe(exit);
		expect(exitAt({ x: 80, y: 80 }, [exit])).toBeUndefined();
	});
	it("includes edges and vertices in either winding direction", () => {
		for (const p of [
			{ x: 0, y: 0 },
			{ x: 40, y: 60 },
			{ x: 50, y: 0 },
		]) {
			expect(exitAt(p, [exit])).toBe(exit);
			expect(
				exitAt(p, [{ ...exit, region: [...exit.region].reverse() }]),
			).toBeDefined();
		}
	});
	it("returns first matching exit, ignoring invalid polygons", () => {
		expect(
			exitAt({ x: 20, y: 20 }, [
				{ ...exit, region: [] },
				exit,
				{ ...exit, id: "second" },
			]),
		).toBe(exit);
		expect(exitAt({ x: -1, y: 10 }, [exit])).toBeUndefined();
		expect(exitAt({ x: 0, y: 0 }, [])).toBeUndefined();
	});
});
