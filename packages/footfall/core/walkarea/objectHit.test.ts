import { describe, expect, it } from "vitest";
import { objectAtPoint } from "./objectHit";

describe("scene object hit testing", () => {
	const object = { name: "Distant houses", bounds: [0.4, 0.4, 0.6, 0.6] };
	const floor = { width: 1, height: 1, data: [1] };
	it("keeps floor clicks from selecting an overlapping object", () => {
		expect(
			objectAtPoint([object], [], floor, 960, 540, 1920, 1080),
		).toBeUndefined();
	});
	it("uses texture alpha in preference to the object's bounding box", () => {
		const layer = { data: { label: "distant houses" }, alpha: () => false };
		expect(
			objectAtPoint([object], [layer], undefined, 960, 540, 1920, 1080),
		).toBeUndefined();
	});
	it("selects unlayered objects by normalized bounds including their edge", () => {
		expect(objectAtPoint([object], [], undefined, 1152, 648, 1920, 1080)).toBe(
			object,
		);
		expect(
			objectAtPoint([object], [], undefined, 1153, 648, 1920, 1080),
		).toBeUndefined();
	});
	it("uses every split outline for the same object", () => {
		const layers = [
			{ data: { label: "distant houses" }, alpha: () => false },
			{ data: { label: "distant houses" }, alpha: () => true },
		];
		expect(
			objectAtPoint([object], layers, undefined, 960, 540, 1920, 1080),
		).toBe(object);
	});
	it("associates numbered semantic instances with the overlapping named object", () => {
		const left = { name: "left building", bounds: [0.01, 0.2, 0.3, 0.7] };
		const right = { name: "right building", bounds: [0.7, 0.2, 0.99, 0.7] };
		const sky = { name: "sky", bounds: [0, 0, 1, 0.5] };
		const layers = [
			{
				data: { label: "buildings-3", bbox: { x: 10, y: 10, w: 20, h: 60 } },
				alpha: (x: number) => x === 20,
			},
			{
				data: { label: "buildings-4", bbox: { x: 70, y: 10, w: 20, h: 60 } },
				alpha: (x: number) => x === 80,
			},
		];
		const objects = [left, right, sky];
		expect(objectAtPoint(objects, layers, undefined, 20, 15, 100, 100)).toBe(
			left,
		);
		expect(objectAtPoint(objects, layers, undefined, 80, 15, 100, 100)).toBe(
			right,
		);
		// Partial category masks must not remove the existing named hit box.
		expect(objectAtPoint(objects, layers, undefined, 25, 25, 100, 100)).toBe(
			left,
		);
	});
});
