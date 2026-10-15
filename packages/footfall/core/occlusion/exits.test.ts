import { describe, expect, it } from "vitest";
import { type Exit, exitAtArrival, exitForFrame } from "./exits";

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

it("uses a requested stance-clear approach without expanding the physical trigger", () => {
	const gate: Exit = {
		id: "return",
		kind: "edge-left",
		region: [
			{ x: 0, y: 0 },
			{ x: 10, y: 0 },
			{ x: 10, y: 10 },
			{ x: 0, y: 10 },
		],
		approach: { x: 50, y: 50 },
	};
	const arrival = { target: { x: 50, y: 50 }, halfStride: 10 };
	expect(exitAtArrival({ x: 55, y: 50 }, "return", arrival, [gate])).toBe(gate);
	expect(
		exitAtArrival({ x: 55, y: 50 }, undefined, arrival, [gate]),
	).toBeUndefined();
	expect(
		exitAtArrival({ x: 75, y: 50 }, "return", arrival, [gate]),
	).toBeUndefined();
	expect(
		exitAtArrival(
			{ x: 55, y: 50 },
			"return",
			{ target: { x: 54, y: 50 }, halfStride: 10 },
			[gate],
		),
	).toBeUndefined();
});

it("waits for the planned support before a requested transfer and latches once", () => {
	const state = {
		anchor: { x: 108, y: 108 },
		exits: [exit],
		requested: exit.id,
		wasWalking: true,
		approachingObject: false,
		arriving: false,
		busy: false,
	};
	expect(exitForFrame(state).trigger).toBeUndefined();
	const arrival = {
		target: state.anchor,
		halfStride: 10,
		anchor: { x: 110, y: 108 },
	};
	expect(exitForFrame({ ...state, arrival }).trigger).toBeUndefined();
	const arrived = { ...state, arrival: { ...arrival, anchor: state.anchor } };
	expect(exitForFrame(arrived).trigger?.id).toBe(exit.id);
	expect(exitForFrame({ ...arrived, latch: exit.id }).trigger).toBeUndefined();
});

it("honours the requested exit when arrival regions overlap", () => {
	const requested = { ...exit, id: "other-door" };
	const anchor = { x: 108, y: 108 };
	const result = exitForFrame({
		anchor,
		exits: [exit, requested],
		requested: requested.id,
		arrival: { anchor, target: anchor, halfStride: 10 },
		wasWalking: true,
		approachingObject: false,
		arriving: false,
		busy: false,
	});
	expect(result.trigger?.id).toBe(requested.id);
});
