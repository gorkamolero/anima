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

import { failedGround } from "../../services/ground.js";
import {
	erodeFloor,
	floorPrompts,
	insidePolygon,
	refineWithDepth,
} from "../../services/ground-perception.js";

describe("hard-scene floors", () => {
	it("selects individual scene/material prompts rather than a compound SAM concept", () => {
		expect(floorPrompts("cobbled plaza fountain")).toEqual(
			expect.arrayContaining(["floor", "ground", "cobblestones", "pavement"]),
		);
		expect(floorPrompts("lobby wooden staircase rug")).toEqual(
			expect.arrayContaining(["wooden floor", "rug", "stairs"]),
		);
	});
	it("fills a missing floor patch from depth but cannot expand into an equal-depth wall outside the envelope", () => {
		const width = 40,
			height = 40;
		const envelope = {
			width,
			height,
			data: Array.from({ length: width * height }, (_, i) =>
				Math.floor(i / width) > 15 && i % width < 30 ? 1 : 0,
			),
		};
		const seed = {
			...envelope,
			data: envelope.data.map((v, i) =>
				i % width > 12 &&
				i % width < 18 &&
				Math.floor(i / width) > 27 &&
				Math.floor(i / width) < 33
					? 0
					: v,
			),
		};
		const depth = {
			width,
			height,
			data: envelope.data.map((_, i) => 10 + Math.floor(i / width) * 5),
		};
		const stairs = { ...seed, data: seed.data.map(() => 0) };
		const result = refineWithDepth(seed, depth, envelope, stairs);
		expect(result.mask.data[30 * width + 15]).toBe(1);
		expect(result.mask.data[30 * width + 35]).toBe(0);
		expect(result.mask.data[5 * width + 15]).toBe(0);
	});
	it("does not reject a labelled stair region for failing the main floor plane", () => {
		const width = 40,
			height = 40;
		const mask = {
			width,
			height,
			data: Array.from({ length: width * height }, (_, i) =>
				Math.floor(i / width) > 12 ? 1 : 0,
			),
		};
		const stairs = {
			...mask,
			data: mask.data.map((v, i) => (v && i % width < 8 ? 1 : 0)),
		};
		const depth = {
			...mask,
			data: mask.data.map((_, i) =>
				stairs.data[i] ? 200 : 10 + Math.floor(i / width) * 5,
			),
		};
		expect(
			refineWithDepth(mask, depth, mask, stairs).mask.data[20 * width + 4],
		).toBe(1);
	});
	it("failed ground contains no walkable floor, line, regions or travel permission", () => {
		const failed = failedGround("No reliable floor");
		expect(failed.ground).toBe("failed");
		expect(failed.reason).toBe("No reliable floor");
		expect(failed.floor.data.some(Boolean)).toBe(false);
		expect(failed.walkArea?.mask.data.some(Boolean)).toBe(false);
		expect(failed.groundLine.points).toEqual([]);
		expect(failed.travelEnabled).toBe(false);
		expect(failed.regions).toEqual([]);
	});
	it("respects concave floor boundaries", () => {
		const polygon = [
			{ x: 0, y: 0 },
			{ x: 1, y: 0 },
			{ x: 1, y: 0.3 },
			{ x: 0.3, y: 0.3 },
			{ x: 0.3, y: 1 },
			{ x: 0, y: 1 },
		];
		expect(insidePolygon(0.2, 0.8, polygon)).toBe(true);
		expect(insidePolygon(0.8, 0.8, polygon)).toBe(false);
	});
});

it("clears mixed obstacle boundaries without disabling real image-edge exits", () => {
	const mask = {
		width: 7,
		height: 7,
		data: Array.from({ length: 49 }, (_, i) => (i === 24 ? 0 : 1)),
	};
	const result = erodeFloor(mask);
	expect(result.data[24]).toBe(0);
	expect(result.data[23]).toBe(0);
	expect(result.data[17]).toBe(0);
	expect(result.data[0]).toBe(1);
	expect(result.data[48]).toBe(1);
});
