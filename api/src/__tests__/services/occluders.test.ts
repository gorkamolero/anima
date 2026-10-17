// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
	canOcclude,
	hasSolidFront,
	maskGeometry,
	splitFloorClutter,
} from "../../services/occluders.js";

describe("hard-scene occluders", () => {
	it("includes interior furniture and fountain while excluding floor", () => {
		for (const name of [
			"front pew",
			"stone pillar",
			"reception desk",
			"counter",
			"fountain",
			"shelves",
		])
			expect(canOcclude({ name, bounds: [0, 0, 1, 1] })).toBe(true);
		expect(canOcclude({ name: "wooden floor", bounds: [0, 0, 1, 1] })).toBe(
			false,
		);
	});
	it("retains segmented object geometry when floor clearance removes contact samples", () => {
		const mask = {
			width: 100,
			height: 100,
			data: Array.from({ length: 10000 }, (_, i) =>
				i % 100 > 30 &&
				i % 100 < 50 &&
				Math.floor(i / 100) > 30 &&
				Math.floor(i / 100) < 50
					? 1
					: 0,
			),
		};
		const floor = {
			...mask,
			data: mask.data.map((_, i) => (Math.floor(i / 100) > 80 ? 1 : 0)),
		};
		const geometry = maskGeometry(mask, floor);
		expect(geometry?.bbox).toEqual(maskGeometry(mask)?.bbox);
		expect(geometry?.baseline.length).toBeGreaterThan(0);
	});
});

describe("floor-fragment derivation", () => {
	it("keeps a shallow net apron in front of the walker beyond a deeper crate", () => {
		const mask = { width: 192, height: 108, data: Array(192 * 108).fill(0) };
		for (let x = 30; x < 52; x++)
			for (let y = x < 40 ? 69 : 76; y < (x < 40 ? 83 : 79); y++)
				mask.data[y * 192 + x] = 1;
		for (const label of ["crate-0", "crates", "fishing nets", "basket"]) {
			const geometry = maskGeometry(
				mask,
				undefined,
				0.8,
				0.000005,
				hasSolidFront(label),
			);
			const last = geometry!.baseline.at(-1)!;
			expect(last.x).toBeGreaterThan(480);
			expect(last.y).toBe(790);
			// A foot at y808 must be in front of this apron, not hidden by the
			// crate's y830 support extrapolated across its full width.
			expect(last.y).toBeLessThan(808);
		}
		for (const label of ["bench", "tree", "lamp post", "chair"])
			expect(hasSolidFront(label)).toBe(false);
	});
	it("preserves every segmented pixel while separating a detached low fragment", () => {
		const mask = { width: 192, height: 108, data: Array(192 * 108).fill(0) };
		for (let y = 40; y < 90; y++)
			for (let x = 30; x < 40; x++) mask.data[y * 192 + x] = 1;
		for (let y = 90; y < 93; y++)
			for (let x = 50; x < 65; x++) mask.data[y * 192 + x] = 1;
		const { upright, flat } = splitFloorClutter(mask, "pew", {
			constant: 1,
			slope: 0,
			horizonY: 0,
		});
		expect(flat.data.reduce((a, b) => a + b, 0)).toBe(45);
		for (let i = 0; i < mask.data.length; i++)
			expect(upright.data[i] + flat.data[i]).toBe(mask.data[i]);
	});
	it("follows the full sloped desk front instead of extending one low leg", () => {
		const mask = { width: 192, height: 108, data: Array(192 * 108).fill(0) };
		for (let x = 30; x < 90; x++)
			for (let y = 40; y < 95 - Math.floor((x - 30) / 3); y++)
				mask.data[y * 192 + x] = 1;
		const g = maskGeometry(mask, undefined, 0.8, 0.002, true);
		expect(g?.baseline[0].x).toBeLessThan(400);
		expect(g?.baseline[g.baseline.length - 1].x).toBeGreaterThan(800);
		expect(g?.baseline[0].y).toBeGreaterThan(
			g?.baseline[g.baseline.length - 1].y ?? Infinity,
		);
	});
});
