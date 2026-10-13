import { describe, expect, it } from "vitest";
import { CharacterMotor } from "../characters/CharacterMotor";
import { cellAt } from "../walkarea/navigation";
import { beginArrival, passageArrival } from "./arrivals";

const area = {
	mask: {
		width: 8,
		height: 8,
		data: Array.from({ length: 64 }, (_, i) => (i >= 18 && i < 48 ? 1 : 0)),
	},
	perspective: { horizonY: 0, slope: 0.001 },
	baseScale: 1,
	scaleClamp: { min: 0, max: 2 },
};
describe("perspective passage arrivals", () => {
	it("starts far at the smallest reachable floor depth", () => {
		expect(passageArrival(area, { x: 840, y: 600 }, "far", 1064)).toEqual({
			x: 840,
			y: 337.5,
		});
	});
	it("starts near at the lowest floor row above the caption limit", () => {
		expect(passageArrival(area, { x: 840, y: 400 }, "near", 700)).toEqual({
			x: 840,
			y: 607.5,
		});
	});
	it("rejects missing floor", () => {
		expect(() =>
			passageArrival(
				{ ...area, mask: { ...area.mask, data: area.mask.data.map(() => 0) } },
				{ x: 840, y: 400 },
				"far",
				1064,
			),
		).toThrow();
	});
});

it("puts a door arrival's sole on floor when the threshold is the first floor row", () => {
	const area = {
		mask: {
			width: 384,
			height: 216,
			data: Array.from({ length: 384 * 216 }, (_, i) =>
				Math.floor(i / 384) >= 67 ? 1 : 0,
			),
		},
		perspective: { horizonY: 0, slope: 0.001 },
		baseScale: 1,
		scaleClamp: { min: 0, max: 2 },
	};
	const cycle = {
		name: "idle",
		frameWidth: 100,
		frameHeight: 100,
		fps: 24,
		switchFrames: [],
		contacts: [
			{ planted: "L" as const, L: { x: 50, y: 80 }, R: { x: 60, y: 80 } },
		],
	};
	const pose = { cycle, frame: 0, flipX: false };
	const target = {
		x: 0,
		y: 0,
		setPosition(x: number, y: number) {
			this.x = x;
			this.y = y;
		},
		setScale() {},
		setDepth() {},
	};
	const motor = new CharacterMotor(target, area, () => {}, {
		current: () => pose,
		select: () => pose,
		show: () => {},
		standing: () => pose,
	});
	beginArrival(
		motor,
		area,
		{ id: "door", kind: "door", approach: { x: 840, y: 338 }, region: [] },
		"door",
		1064,
	);
	expect(area.mask.data[cellAt(area.mask, motor.anchor)]).toBe(1);
});
