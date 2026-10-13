// @vitest-environment node

import { depthRegions } from "@anima/footfall/core/walkarea/regions";
import { describe, expect, it } from "vitest";
import { floorQuestions, floorVerdict } from "../../services/floor-judge.js";
import { maskToGround } from "../../services/ground.js";
import {
	excludeUnscaledStairs,
	repairGround,
} from "../../services/ground-repair.js";

const ground = () =>
	maskToGround(
		{
			width: 40,
			height: 40,
			data: Array.from({ length: 1600 }, (_, i) => (i >= 800 ? 1 : 0)),
		},
		300,
		0.002,
	);
describe("asymmetric floor judge", () => {
	it("never rejects missing floor and uses the inclusive 0.6 hazard threshold", () => {
		const q = floorQuestions([]);
		expect(
			floorVerdict(q, { environment: 0.599, obstacles: 0, coverage: 0 }).pass,
		).toBe(true);
		expect(
			floorVerdict(q, { environment: 0.6, obstacles: 0, coverage: 1 }).pass,
		).toBe(false);
	});
	it("records standable dock coverage without calling it a hazard", () => {
		const q = floorQuestions([{ name: "dock", bounds: [0, 0.5, 0.2, 1] }]);
		expect(
			floorVerdict(q, {
				object_0: 1,
				environment: 0,
				obstacles: 0,
				coverage: 0.5,
			}).pass,
		).toBe(true);
	});
	it("requires a valid probability for every question", () => {
		const q = floorQuestions([]);
		for (const p of [NaN, Infinity, -0.1, 1.1])
			expect(() =>
				floorVerdict(q, { environment: p, obstacles: 0, coverage: 1 }),
			).toThrow();
		expect(() => floorVerdict(q, { coverage: 1 })).toThrow();
	});
	it("asks individually about labelled boxes that overlap floor", () => {
		const q = floorQuestions(
			[
				{ name: "barrel", bounds: [0, 0.7, 0.2, 1] },
				{ name: "sign", bounds: [0, 0, 0.2, 0.2] },
			],
			ground(),
		);
		expect(q.obstacles).toBeUndefined();
		expect(q.environment).toBeDefined();
		expect(q.object_0.instructions).toContain("barrel");
		expect(q.object_1).toBeUndefined();
	});
	it("never subtracts a localization rectangle without a segmented object", () => {
		const g = ground(),
			before = structuredClone(g.floor);
		expect(
			repairGround(g, {
				pass: false,
				why: "water",
				rejected: ["environment"],
				hazardBounds: [[0, 0.7, 0.2, 1]],
			}),
		).toBe(false);
		expect(g.floor).toEqual(before);
	});
	it("subtracts only object pixels, preserving floor inside its bounding box", () => {
		const g = ground();
		const mask = {
			...g.floor,
			data: g.floor.data.map((_, i) => (i % 40 === 2 && i >= 1200 ? 1 : 0)),
		};
		expect(repairGround(g, { pass: false, why: "post" }, mask)).toBe(true);
		expect(g.floor.data[35 * 40 + 2]).toBe(0);
		expect(g.floor.data[35 * 40 + 3]).toBe(1);
		expect(g.walkArea?.mask).toEqual(g.floor);
	});
	it("excludes stairs even with local scale until tread-aware foot placement exists", () => {
		const g = ground(),
			stairs = {
				...g.floor,
				data: g.floor.data.map((v, i) => (v && i % 40 < 10 ? 1 : 0)),
			};
		const depth = { ...g.floor, data: g.floor.data.map(() => 0) };
		g.regions = depthRegions(g.floor, depth, stairs, 200, 1);
		excludeUnscaledStairs(g, stairs);
		expect(g.floor.data[35 * 40 + 2]).toBe(0);
		expect(g.notes?.join(" ")).toContain("tread-aware foot placement");
		const valid = ground();
		valid.regions = depthRegions(
			valid.floor,
			{ ...depth, data: depth.data.map(() => 100) },
			stairs,
			200,
			1,
		);
		excludeUnscaledStairs(valid, stairs);
		expect(valid.floor.data[35 * 40 + 2]).toBe(0);
	});
});
