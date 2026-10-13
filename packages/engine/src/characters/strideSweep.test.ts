import { expect, it } from "vitest";
import type { WalkArea } from "../walkarea/types";
import { CharacterMotor } from "./CharacterMotor";
import type { FootPose } from "./footLock";
import { strideSweep } from "./strideSweep";

function fixture(gapMetres: number, object = false): WalkArea {
	const mask = { width: 1920, height: 1, data: Array(1920).fill(1) };
	const objects = { ...mask, data: Array(1920).fill(0) };
	for (let x = 800; x < 800 + gapMetres * 300; x++) {
		mask.data[x] = 0;
		if (object) objects.data[x] = 1;
	}
	return {
		mask,
		rawMask: mask,
		clearanceMask: mask,
		objectFootprints: objects,
		perspective: { constant: 1, slope: 0, horizonY: 0 },
		baseScale: 1,
		scaleClamp: { min: 1, max: 1 },
	};
}
const soles = [
	{ x: 750, y: 800 },
	{ x: 1150, y: 800 },
] as const;
it("steps over a 10 cm gap with both soles on floor", () => {
	expect(strideSweep(fixture(0.1), soles, soles)).toBe(true);
});
it("allows the body above a bounded gap at the support transfer", () => {
	expect(strideSweep(fixture(0.1), soles, [soles[0], { x: 810, y: 800 }])).toBe(
		true,
	);
	expect(strideSweep(fixture(0.1), soles, [{ x: 810, y: 800 }, soles[1]])).toBe(
		true,
	);
	expect(strideSweep(fixture(1), soles, [soles[0], { x: 810, y: 800 }])).toBe(
		false,
	);
});
it("cannot step over a 1 m gap", () => {
	expect(strideSweep(fixture(1), soles, soles)).toBe(false);
});
it("never crosses an object footprint, even a narrow one", () => {
	expect(strideSweep(fixture(0.1, true), soles, soles)).toBe(false);
	const area = fixture(0.1, true);
	area.rawMask = { ...area.mask, data: area.mask.data.map(() => 1) };
	area.clearanceMask = area.rawMask;
	expect(strideSweep(area, soles, soles)).toBe(false);
});
it("does not land in the gap or waive clearance on real floor", () => {
	expect(strideSweep(fixture(0.1), [soles[0], { x: 810, y: 800 }], soles)).toBe(
		false,
	);
	const area = fixture(0.1);
	area.clearanceMask = { ...area.mask, data: [...area.mask.data] };
	area.clearanceMask.data[900] = 0;
	expect(strideSweep(area, soles, soles)).toBe(false);
});

it.each([
	[0.1, false, true],
	[1, false, false],
	[0.1, true, false],
] as const)("motor validates a %s metre gap (object=%s)", (width, object, accepted) => {
	const pose: FootPose = {
		frame: 0,
		flipX: false,
		cycle: {
			name: "step",
			frameWidth: 100,
			frameHeight: 200,
			fps: 24,
			switchFrames: [0, 2],
			contacts: [
				{ planted: "L", L: { x: 50, y: 200 }, R: { x: 0, y: 200 } },
				{ planted: "L", L: { x: -150, y: 200 }, R: { x: 100, y: 200 } },
				{ planted: "R", L: { x: 0, y: 200 }, R: { x: 50, y: 200 } },
			],
		},
	};
	const target = {
		x: 750,
		y: 800,
		setPosition() {},
		setScale() {},
		setDepth() {},
	};
	const motor = new CharacterMotor(target, fixture(width, object), () => {}, {
		current: () => pose,
		select: () => pose,
		show() {},
	});
	const internal = motor as unknown as {
		predictStance(p: FootPose, s: unknown): unknown;
	};
	expect(
		Boolean(
			internal.predictStance(pose, {
				anchor: { x: 750, y: 800 },
				end: target,
				foot: "L",
				scale: 1,
			}),
		),
	).toBe(accepted);
});
