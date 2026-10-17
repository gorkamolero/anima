import { describe, expect, it } from "vitest";
import { lineOfSight } from "./navigation";
import { objectApproach } from "./objectApproach";
import type { WalkArea } from "./types";

function area(connected: boolean) {
	const mask = { width: 20, height: 10, data: Array(200).fill(1) };
	for (let y = 0; y < 10; y++) mask.data[y * 20 + 10] = 0;
	const clearanceMask = { ...mask, data: [...mask.data] };
	if (connected) clearanceMask.data[110] = 1;
	return {
		mask,
		clearanceMask,
		perspective: { horizonY: 0, slope: 0.001 },
		baseScale: 1,
		scaleClamp: { min: 0.1, max: 1 },
	} satisfies WalkArea;
}
const object = { name: "cabinet", bounds: [0.7, 0.1, 0.9, 0.3] };
describe("object approach", () => {
	it("reaches the object across a margin seam when body clearance permits", () => {
		const geometry = area(true);
		const path = objectApproach(geometry, { x: 400, y: 300 }, [], object, 1500);
		expect(path.at(-1)?.x).toBeGreaterThan(1400);
		for (let i = 1; i < path.length; i++)
			expect(lineOfSight(geometry.clearanceMask, path[i - 1], path[i])).toBe(
				true,
			);
	});
	it("does not cross an actual physical wall to approach an object", () => {
		const path = objectApproach(
			area(false),
			{ x: 400, y: 300 },
			[],
			object,
			1500,
		);
		expect(path.at(-1)?.x).toBeLessThan(960);
	});
});
