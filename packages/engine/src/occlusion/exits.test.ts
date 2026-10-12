import { describe, expect, it } from "vitest";
import { type Exit, exitAtArrival } from "./exits";

const exit: Exit = {
	id: "door",
	kind: "door",
	region: [
		{ x: 100, y: 100 },
		{ x: 116, y: 100 },
		{ x: 116, y: 116 },
		{ x: 100, y: 116 },
	],
};
const arrival = { target: { x: 108, y: 108 }, halfStride: 30 };
describe("footfall exit arrival", () => {
	it("finishes a clicked exit without snapping the held foot", () => {
		expect(exitAtArrival({ x: 85, y: 108 }, "door", arrival, [exit])).toBe(
			exit,
		);
	});
	it("does not travel from an ordinary nearby floor or object approach", () => {
		expect(
			exitAtArrival({ x: 85, y: 108 }, undefined, arrival, [exit]),
		).toBeUndefined();
		expect(
			exitAtArrival({ x: 85, y: 108 }, "different", arrival, [exit]),
		).toBeUndefined();
	});
	it("rejects an unfinished or out-of-range approach", () => {
		expect(
			exitAtArrival({ x: 10, y: 108 }, "door", arrival, [exit]),
		).toBeUndefined();
		expect(
			exitAtArrival({ x: 108, y: 108 }, "door", undefined, [exit]),
		).toBeUndefined();
		expect(
			exitAtArrival(
				{ x: 108, y: 108 },
				"door",
				{ target: { x: 200, y: 108 }, halfStride: 100 },
				[exit],
			),
		).toBeUndefined();
	});
});
