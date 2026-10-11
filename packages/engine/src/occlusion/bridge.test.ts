import { describe, expect, it } from "vitest";
import { bridgeFloor } from "./bridge";
import type { Occluder } from "./occlusion";

const object: Occluder = {
	id: "post",
	label: "post",
	bbox: { x: 768, y: 0, w: 384, h: 864 },
	baseline: [{ x: 960, y: 864 }],
	png: "post.png",
};
describe("geometric hidden-floor bridge", () => {
	it("requires visible floor on both sides and stays above the contact", () => {
		const mask = { width: 10, height: 10, data: Array(100).fill(1) };
		for (let y = 0; y < 10; y++)
			for (let x = 4; x < 6; x++) mask.data[y * 10 + x] = 0;
		bridgeFloor(mask, object, (x) => x >= 768 && x < 1152);
		expect(mask.data[5 * 10 + 4]).toBe(1);
		expect(mask.data[9 * 10 + 4]).toBe(0);
	});
	it("does not fill a one-sided gap or a gap outside the object silhouette", () => {
		const mask = { width: 10, height: 10, data: Array(100).fill(0) };
		for (let y = 0; y < 10; y++)
			for (let x = 0; x < 4; x++) mask.data[y * 10 + x] = 1;
		bridgeFloor(mask, object, (x) => x >= 768 && x < 1152);
		expect(mask.data[5 * 10 + 4]).toBe(0);
	});
});
