import { expect, it } from "vitest";
import { CharacterMotor } from "../../phaser/CharacterMotor";
import type { FootPose } from "./footLock";

it("chooses a supported inward stop without moving the live character", async () => {
	const cycle = {
		name: "walk",
		frameWidth: 100,
		frameHeight: 200,
		fps: 24,
		switchFrames: [0, 2],
		contacts: [
			{ planted: "L" as const, L: { x: 50, y: 200 }, R: { x: -50, y: 200 } },
			{ planted: "L" as const, L: { x: -50, y: 200 }, R: { x: 50, y: 200 } },
			{ planted: "R" as const, L: { x: -50, y: 200 }, R: { x: 50, y: 200 } },
			{ planted: "R" as const, L: { x: 50, y: 200 }, R: { x: -50, y: 200 } },
		],
	};
	let pose: FootPose = { cycle, frame: 0, flipX: false };
	const target = {
		x: 500,
		y: 800,
		setPosition(x: number, y: number) {
			this.x = x;
			this.y = y;
		},
		setScale() {},
		setDepth() {},
	};
	const motor = new CharacterMotor(
		target,
		{
			mask: { width: 192, height: 108, data: Array(192 * 108).fill(1) },
			perspective: { constant: 1, slope: 0, horizonY: 0 },
			baseScale: 1,
			scaleClamp: { min: 1, max: 1 },
		},
		() => {},
		{
			current: () => pose,
			select: (h) => ({ cycle, flipX: h === "left" }),
			show: (p) => {
				pose = p;
			},
		},
	);
	motor.heading = "right";
	motor.placeContact({ x: 500, y: 800 });
	const before = {
		anchor: { ...motor.anchor },
		x: target.x,
		y: target.y,
		pose,
	};
	const stop = motor.inwardStop({ x: 900, y: 880 });
	expect(stop).toBeDefined();
	if (!stop) throw new Error("No supported inward stop");
	expect(stop?.x).toBeGreaterThanOrEqual(800);
	expect(stop?.y).toBe(800);
	expect({ anchor: motor.anchor, x: target.x, y: target.y, pose }).toEqual(
		before,
	);
	const walking = motor.walk([stop]);
	for (let i = 0; i < 240 && motor.walking; i++) motor.update(1000 / 24);
	await walking;
	expect(motor.anchor.x).toBeCloseTo(stop.x, 5);
	expect(motor.anchor.y).toBeCloseTo(stop.y, 5);
	const close = motor.walk([{ x: stop.x + 20, y: stop.y }]);
	for (let i = 0; i < 240 && motor.walking; i++) motor.update(1000 / 24);
	await close;
	expect(motor.anchor.x).toBeCloseTo(stop.x, 5);
	expect(motor.anchor.y).toBeCloseTo(stop.y, 5);
});
