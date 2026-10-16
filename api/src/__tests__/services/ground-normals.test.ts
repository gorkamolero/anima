// @vitest-environment node
import { describe, expect, it } from "vitest";
import {
	cleanMainFloor,
	combineNormals,
	smoothNormals,
	svdPlane,
} from "../../services/ground-normals.js";

describe("MoGe ground normals", () => {
	it("fits the least singular direction of a tilted plane and rejects a line", () => {
		const points = Array.from({ length: 100 }, (_, i) => {
			const x = i % 10,
				z = Math.floor(i / 10);
			return [x, 2 + 0.2 * x - 0.1 * z, z];
		});
		const { normal, center } = svdPlane(points);
		expect(
			Math.abs(normal[0] * -0.2 + normal[1] + normal[2] * 0.1),
		).toBeCloseTo(Math.sqrt(1.05), 8);
		expect(center[1]).toBeCloseTo(2.45, 8);
		expect(() =>
			svdPlane([
				[0, 0, 0],
				[1, 1, 1],
				[2, 2, 2],
			]),
		).toThrow("Collinear");
	});
	it("smooths pebble normals before thresholding, rejects raised unseeded points and dilated water", () => {
		const w = 40,
			h = 30,
			points = new Float32Array(w * h * 3),
			normals = new Float32Array(w * h * 3),
			valid = new Uint8Array(w * h).fill(1);
		for (let y = 0; y < h; y++)
			for (let x = 0; x < w; x++) {
				const i = y * w + x;
				points.set([x / 10, 0, 2 + y / 10], i * 3);
				normals.set([0, 1, 0], i * 3);
			}
		normals.set([1, 0, 0], (15 * w + 12) * 3);
		points[(15 * w + 30) * 3 + 1] = 3;
		points[(15 * w + 15) * 3] = Number.NaN;
		const floor = {
				width: w,
				height: h,
				data: Array.from({ length: w * h }, (_, i) => (i % w < 20 ? 1 : 0)),
			},
			water = { ...floor, data: floor.data.map(() => 0) };
		water.data[15 * w + 5] = 1;
		const result = combineNormals(
			{ width: w, height: h, points, normals, valid },
			floor,
			water,
		);
		expect(result.data[15 * w + 12]).toBe(1);
		expect(result.data[15 * w + 15]).toBe(1);
		expect(result.data[15 * w + 30]).toBe(0);
		expect(result.data[15 * w + 7]).toBe(0);
		expect(result.data[15 * w + 8]).toBe(1);
		const smoothed = smoothNormals(normals, w, h);
		expect(smoothed[(15 * w + 12) * 3 + 1]).toBeGreaterThan(0.99);
	});
	it("keeps linked components without inventing floor across holes or disconnected pockets", () => {
		const w = 100,
			h = 60,
			data = Array<number>(w * h).fill(0);
		for (let y = 20; y < 55; y++)
			for (let x = 5; x < 50; x++) data[y * w + x] = 1;
		for (let y = 30; y < 50; y++)
			for (let x = 65; x < 85; x++) data[y * w + x] = 1;
		data[35 * w + 25] = 0;
		const mask = { width: w, height: h, data },
			g = { horizonY: 0.1, referenceFootY: 0.8, referenceHeight: 0.2 };
		const first = cleanMainFloor(mask, g);
		expect(first.data[40 * w + 75]).toBe(0);
		const linked = cleanMainFloor(mask, g, [
			{
				from: { x: (25 / w) * 1920, y: (40 / h) * 1080 },
				to: { x: (75 / w) * 1920, y: (40 / h) * 1080 },
			},
		]);
		expect(linked.data[40 * w + 75]).toBe(1);
		expect(linked.data[35 * w + 25]).toBe(0);
		expect(linked.data[40 * w + 60]).toBe(0);
		expect(linked.data.every((v, i) => !v || !!data[i])).toBe(true);
	});
	it("preserves a shallow passage wide enough in projected ground space", () => {
		const width = 192,
			height = 108,
			data = Array<number>(width * height).fill(0);
		for (let y = 49; y < 59; y++)
			for (let x = 10; x < 180; x++) data[y * width + x] = 1;
		const result = cleanMainFloor(
			{ width, height, data },
			{ horizonY: 0.44, referenceFootY: 0.75, referenceHeight: 0.5 },
		);
		// Near the horizon a body disk is shallow on screen. A screen-space disk
		// would erase this real passage despite its ample physical depth.
		expect(result.data[54 * width + 90]).toBe(1);
		expect(result.data[54 * width + 20]).toBe(1);
		expect(result.data.every((v, i) => !v || !!data[i])).toBe(true);
	});
	it("combines SAM floor with missed upward ground while retaining SAM object outlines", () => {
		const width = 200,
			height = 100,
			points = new Float32Array(width * height * 3),
			normals = new Float32Array(points.length),
			valid = new Uint8Array(width * height).fill(1);
		const floor = {
				width,
				height,
				data: Array<number>(width * height).fill(1),
			},
			water = { ...floor, data: Array<number>(width * height).fill(0) },
			excluded = { ...floor, data: Array<number>(width * height).fill(0) };
		for (let y = 0; y < height; y++)
			for (let x = 0; x < width; x++) {
				const i = y * width + x;
				points.set([x / 10, 0, 5 + y / 10], i * 3);
				normals.set(x >= 160 ? [1, 0, 0] : [0, 1, 0], i * 3);
				if (x >= 30 && x < 70) normals.set([0.5, Math.sqrt(0.75), 0], i * 3);
				if (x >= 100 && x < 130) floor.data[i] = 0;
			}
		excluded.data[50 * width + 110] = 1;
		const result = combineNormals(
			{ width, height, points, normals, valid },
			floor,
			water,
			excluded,
		);
		expect(result.data[50 * width + 20]).toBe(1); // retain confirmed SAM floor
		expect(result.data[50 * width + 50]).toBe(1); // retain SAM slopes between 20 and 35 degrees
		expect(result.data[50 * width + 120]).toBe(1); // add upward ground SAM missed
		expect(result.data[50 * width + 110]).toBe(0); // never paint over SAM's object outline
		expect(result.data[50 * width + 185]).toBe(0); // remove a non-upward solid SAM kept
	});
	it("preserves accepted SAM edges instead of applying body erosion to them twice", () => {
		const width = 100,
			height = 60,
			data = Array<number>(width * height).fill(0);
		for (let y = 20; y < 55; y++)
			for (let x = 5; x < 50; x++) data[y * width + x] = 1;
		data[35 * width + 25] = 0;
		const mask = { width, height, data };
		expect(
			cleanMainFloor(
				mask,
				{ horizonY: 0.1, referenceFootY: 0.8, referenceHeight: 0.5 },
				[],
				mask,
			).data,
		).toEqual(data);
	});
});
