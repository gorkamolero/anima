import { describe, expect, it } from "vitest";
import {
	cellAt,
	erode,
	findPath,
	lineOfSight,
	nearestReachable,
} from "./navigation";

const mask = () => ({ width: 20, height: 10, data: Array(200).fill(1) });
describe("navigation", () => {
	it("shortcuts an open floor to a single diagonal", () => {
		expect(
			findPath(mask(), { x: 200, y: 200 }, { x: 1700, y: 850 }),
		).toHaveLength(2);
	});
	it("routes around a wall with every shortcut on floor", () => {
		const m = mask();
		for (let y = 0; y < 8; y++) m.data[y * 20 + 10] = 0;
		const path = findPath(m, { x: 400, y: 300 }, { x: 1500, y: 300 });
		expect(path.length).toBeGreaterThan(2);
		for (let i = 1; i < path.length; i++)
			expect(lineOfSight(m, path[i - 1], path[i])).toBe(true);
	});
	it("snaps within the reachable component and cannot cut corners", () => {
		const m = mask();
		for (let y = 0; y < 10; y++) m.data[y * 20 + 10] = 0;
		expect(
			nearestReachable(m, { x: 400, y: 300 }, { x: 1500, y: 300 }) % 20,
		).toBeLessThan(10);
		const corner = { width: 2, height: 2, data: [1, 0, 0, 1] };
		expect(
			nearestReachable(corner, { x: 10, y: 10 }, { x: 1910, y: 1070 }),
		).toBe(0);
	});
	it("clears the footprint from boundaries", () => {
		const m = erode(mask(), { horizonY: 0, slope: 0.002 });
		expect(m.data[cellAt(m, { x: 1, y: 1 })]).toBe(0);
		expect(m.data[cellAt(m, { x: 960, y: 540 })]).toBe(1);
	});
});
