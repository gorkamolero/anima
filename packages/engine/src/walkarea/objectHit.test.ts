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
});
