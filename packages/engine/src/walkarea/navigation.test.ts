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

it("dilates physical supports without eroding open floor a second time", () => {
	const floor = { width: 384, height: 216, data: Array(384 * 216).fill(1) };
	const supports = { ...floor, data: Array(384 * 216).fill(0) };
	supports.data[100 * 384 + 100] = 1;
	const cleared = erode(
		floor,
		{ horizonY: 0, slope: 0, constant: 1, pixelsPerMetre: 300 },
		0.3,
		supports,
	);
	expect(cleared.data[100 * 384]).toBe(1);
	expect(cleared.data[100 * 384 + 108]).toBe(0);
	expect(cleared.data[100 * 384 + 110]).toBe(1);
});

it("rejects a one-cell floor sliver without applying the physical radius to open floor", () => {
	const floor = { width: 384, height: 216, data: Array(384 * 216).fill(0) };
	for (let x = 0; x < 384; x++)
		for (const y of [100, 110, 111, 112]) floor.data[y * 384 + x] = 1;
	const supports = { ...floor, data: Array(384 * 216).fill(0) };
	const cleared = erode(
		floor,
		{ horizonY: 0, slope: 0, constant: 1, pixelsPerMetre: 300 },
		0.3,
		supports,
	);
	expect(cleared.data[100 * 384 + 200]).toBe(0);
	expect(cleared.data[111 * 384 + 200]).toBe(1);
});

it("measures object clearance in ground metres along both axes", async () => {
	const { fromMetres, toMetres } = await import("./perspective");
	const perspective = { horizonY: 470, slope: 0.002, pixelsPerMetre: 300 };
	const mask = { width: 384, height: 216, data: Array(384 * 216).fill(1) };
	const obstacle = { ...mask, data: mask.data.map(() => 0) };
	const point = { x: 962.5, y: 802.5 };
	obstacle.data[160 * 384 + 192] = 1;
	const clear = erode(mask, perspective, 0.3, obstacle, 0);
	const ground = toMetres(perspective, point);
	for (const [dx, dz, expected] of [
		[0.08, 0, 0],
		[0, 0.08, 0],
		[0.3, 0, 1],
		[0, 0.3, 1],
	]) {
		const p = fromMetres(perspective, { x: ground.x + dx, y: ground.y + dz });
		expect(clear.data[Math.floor(p.y / 5) * 384 + Math.floor(p.x / 5)]).toBe(
			expected,
		);
	}
});
