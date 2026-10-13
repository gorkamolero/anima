import { expect, it } from "vitest";
import { stanceSweep } from "./stanceSweep";

it("accepts a boundary graze without jumping over a short free cell interval", () => {
	const mask = { width: 2, height: 2, data: [1, 1, 0, 1] };
	// Cross x=960 before y=540: the segment never enters the blocked lower left.
	expect(stanceSweep(mask, { x: 192, y: 108 }, { x: 1728, y: 918 })).toBe(true);
	expect(stanceSweep(mask, { x: 1728, y: 918 }, { x: 192, y: 108 })).toBe(true);
});
it("rejects a real blocked-cell crossing and an invalid starting point", () => {
	const mask = { width: 2, height: 2, data: [1, 1, 0, 1] };
	expect(stanceSweep(mask, { x: 192, y: 108 }, { x: 1536, y: 1026 })).toBe(
		false,
	);
	expect(stanceSweep(mask, { x: 192, y: 800 }, { x: 1728, y: 918 })).toBe(
		false,
	);
});
