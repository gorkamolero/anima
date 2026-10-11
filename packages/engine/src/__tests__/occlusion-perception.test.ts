// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
	deriveExits,
	type FloorRaster,
} from "../../../../api/src/services/exits.js";
import {
	canOcclude,
	largestComponent,
	maskGeometry,
} from "../../../../api/src/services/occluders.js";
import { exitAt } from "../occlusion/exits.js";

function raster(
	w: number,
	h: number,
	contains: (x: number, y: number) => boolean,
): FloorRaster {
	return {
		width: w,
		height: h,
		data: Array.from({ length: w * h }, (_, i) =>
			contains(i % w, Math.floor(i / w)) ? 1 : 0,
		),
	};
}
describe("perception-derived geometry", () => {
	it("recognizes plural prop labels without including floor or distant scenery", () => {
		for (const name of [
			"trees",
			"wooden benches",
			"lamp posts",
			"crates",
			"cars",
		])
			expect(canOcclude({ name, bounds: [0, 0, 0.2, 0.8] })).toBe(true);
		for (const name of [
			"floor",
			"sky",
			"distant buildings",
			"Arkham Bus Depot sign",
		])
			expect(canOcclude({ name, bounds: [0, 0, 1, 1] })).toBe(false);
	});

	it("removes disconnected mask islands without filling transparent holes", () => {
		const mask = raster(
			30,
			30,
			(x, y) =>
				(x >= 3 && x < 15 && y >= 3 && y < 15 && !(x === 8 && y === 8)) ||
				(x > 25 && y > 25),
		);
		const cleaned = largestComponent(mask);
		expect(cleaned.data[8 * 30 + 8]).toBe(0);
		expect(cleaned.data[28 * 30 + 28]).toBe(0);
		expect(cleaned.data[5 * 30 + 5]).toBe(1);
	});

	it("rejects tiny and huge masks", () => {
		expect(
			maskGeometry(raster(100, 100, (x, y) => x === 0 && y === 0)),
		).toBeUndefined();
		expect(maskGeometry(raster(100, 100, () => true))).toBeUndefined();
	});
	it("sorts the baseline by x even when the upper silhouette discovers columns out of order", () => {
		const mask = raster(
			100,
			100,
			(x, y) => x >= 20 && x < 40 && y >= 40 - x / 2 && y < 60 + x / 3,
		);
		const result = maskGeometry(
			mask,
			raster(100, 100, (_, y) => y >= 60),
		);
		expect(result).toBeDefined();
		const points = result?.baseline ?? [];
		expect(points.length).toBeGreaterThan(1);
		for (let i = 1; i < points.length; i++)
			expect(points[i].x).toBeGreaterThan(points[i - 1].x);
	});
	it("uses the trunk contact, not the bottom of the canopy", () => {
		const mask = raster(
			100,
			100,
			(x, y) =>
				(x >= 20 && x < 60 && y >= 10 && y < 40) ||
				(x >= 38 && x < 42 && y >= 40 && y < 70),
		);
		const result = maskGeometry(
			mask,
			raster(100, 100, (_, y) => y >= 70),
		);
		expect(result?.baseline.every((p) => p.y === 756)).toBe(true);
	});
	it("never puts a contact below its own silhouette column", () => {
		const mask = raster(
			192,
			108,
			(x, y) => x >= 30 && x < 75 && y > 20 && y < 60 + (x % 7),
		);
		const result = maskGeometry(mask);
		expect(result).toBeDefined();
		for (const point of result?.baseline ?? []) {
			const x = Math.floor(point.x / 10);
			const last = Array.from({ length: 108 }, (_, y) => y)
				.filter((y) => mask.data[y * 192 + x])
				.at(-1);
			expect(point.y).toBe((Number(last) + 1) * 10);
			expect(point.y).toBeLessThanOrEqual(
				(result?.bbox.y ?? 0) + (result?.bbox.h ?? 0),
			);
		}
	});

	it("preserves disconnected side strips and their intervening gap", () => {
		const floor = raster(
			30,
			30,
			(x, y) => x < 5 && ((y >= 10 && y < 15) || y >= 20),
		);
		const exits = deriveExits(floor, []);
		expect(exits.filter((e) => e.kind === "edge-left")).toHaveLength(2);
		expect(exitAt({ x: 10, y: 600 }, exits)).toBeUndefined();
		expect(exitAt({ x: 0, y: 800 }, exits)?.kind).toBe("edge-left");
	});
	it("does not invent a far exit along a flat wall seam", () => {
		expect(
			deriveExits(
				raster(30, 30, (_, y) => y >= 15),
				[],
				400,
			).some((e) => e.kind === "far"),
		).toBe(false);
	});
	it("finds a receding corridor and rejects a blocked extremity", () => {
		const floor = raster(
			30,
			30,
			(x, y) =>
				y >= 10 &&
				x >= 12 - Math.floor((y - 10) / 3) &&
				x < 17 + Math.floor((y - 10) / 3),
		);
		expect(deriveExits(floor, [], 300).some((e) => e.kind === "far")).toBe(
			true,
		);
		expect(
			deriveExits(
				floor,
				[{ name: "wall", bounds: [0.3, 0, 0.7, 1 / 3] }],
				300,
			).some((e) => e.kind === "far"),
		).toBe(false);
	});
	it("requires floor at a door threshold and leaves destinations unset", () => {
		const floor = raster(40, 40, (_, y) => y >= 20);
		const exits = deriveExits(floor, [
			{ name: "door", bounds: [0.3, 0.2, 0.5, 0.5] },
			{ name: "high doorway", bounds: [0.6, 0.1, 0.7, 0.2] },
		]);
		expect(exits.filter((e) => e.kind === "door")).toHaveLength(1);
		expect(exits.every((e) => e.to === undefined)).toBe(true);
	});
});
