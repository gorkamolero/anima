// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import type { FootCycle, FootPose } from "../core/characters/footLock";
import type { WalkDirection } from "../core/characters/walkHeading";
import { scaleAt } from "../core/walkarea/perspective";
import type { WalkArea } from "../core/walkarea/types";
import { type MotorTarget, WalkMotor } from "./WalkMotor";

function fixture() {
	const area: WalkArea = {
		mask: { width: 8, height: 8, data: Array(64).fill(1) },
		perspective: { horizonY: 0, slope: 0.001, pixelsPerMetre: 100, cx: 960 },
		baseScale: 0.5,
		scaleClamp: { min: 0.1, max: 2 },
	};
	const cycles = Object.fromEntries(
		[
			"left",
			"right",
			"away",
			"toward",
			"away-left",
			"away-right",
			"toward-left",
			"toward-right",
		].map((name) => [
			name,
			{
				name,
				frameWidth: 100,
				frameHeight: 200,
				fps: 2,
				switchFrames: [0, 1],
				contacts: [
					{ planted: "L", L: { x: 40, y: 200 }, R: { x: 60, y: 200 } },
					{ planted: "R", L: { x: 60, y: 200 }, R: { x: 40, y: 200 } },
				],
			},
		]),
	) as Record<WalkDirection, FootCycle>;
	let pose: FootPose = { cycle: cycles.left, frame: 0, flipX: false };
	const target: MotorTarget & { scale: number; depth: number } = {
		x: 0,
		y: 0,
		scale: 1,
		depth: 0,
		setPosition(x, y) {
			this.x = x;
			this.y = y;
		},
		setScale(scale) {
			this.scale = scale;
		},
		setDepth(depth) {
			this.depth = depth;
		},
	};
	const animate = vi.fn();
	const standing = (direction: WalkDirection): FootPose => ({
		cycle: { ...cycles[direction], name: `idle-${direction}` },
		frame: 0,
		flipX: false,
	});
	const motor = new WalkMotor(
		target,
		area,
		animate,
		{
			current: () => pose,
			select: (direction) => ({ cycle: cycles[direction], flipX: false }),
			show: (next) => {
				pose = next;
			},
			standing,
		},
		{ speedMetresPerSecond: 2 },
	);
	motor.place({ x: 960, y: 500 }, false);
	return { motor, target, area, cycles, animate, pose: () => pose };
}

describe("WalkMotor", () => {
	it("moves every positive render delta at perspective-scaled ground speed, even on held drawings", () => {
		const { motor, target, area, pose } = fixture();
		void motor.walk([{ x: 1800, y: 500 }]);
		for (const delta of [1, 1000 / 120, 16, 33, 40]) {
			const before = { ...motor.anchor },
				x = target.x;
			motor.update(delta);
			expect(motor.walking).toBe(true);
			expect(target.x).toBeGreaterThan(x);
			expect((motor.anchor.x - before.x) / (delta / 1000)).toBeCloseTo(
				2 * 100 * scaleAt(area.perspective, before, area.scaleClamp),
				8,
			);
			expect(pose().frame).toBe(0);
		}
		motor.stop();
		motor.place({ x: 960, y: 800 }, false);
		void motor.walk([{ x: 1800, y: 800 }]);
		motor.update(100);
		expect(motor.anchor.x).toBeCloseTo(976);
	});

	it("arrives exactly at the last waypoint, resolves, and idles once", async () => {
		const { motor, animate, pose } = fixture();
		const goal = { x: 1110, y: 500 };
		const done = motor.walk([{ x: 1000, y: 500 }, goal]);
		motor.update(2000);
		await done;
		expect(motor.anchor).toEqual(goal);
		expect(motor.arrival?.anchor).toEqual(goal);
		expect(motor.walking).toBe(false);
		expect(pose().cycle.name).toBe("idle-right");
		motor.update(1000);
		expect(animate.mock.calls.filter(([state]) => state === "idle")).toEqual([
			["idle", "right", 1],
		]);
	});

	it("copies points and drops a nearby first marker when more points follow", async () => {
		const { motor } = fixture();
		const points = [
			{ x: 930, y: 500 },
			{ x: 1200, y: 500 },
		];
		const done = motor.walk(points);
		points[0].x = 0;
		points[1].x = 0;
		points.splice(0, 2, { x: 10, y: 10 });
		motor.update(100);
		expect(motor.anchor).toEqual({ x: 970, y: 500 });
		motor.update(3000);
		await done;
		expect(motor.anchor).toEqual({ x: 1200, y: 500 });
	});

	it("keeps a nearby waypoint when it is the only destination", async () => {
		const { motor } = fixture();
		const done = motor.walk([{ x: 930, y: 500 }]);
		motor.update(1000);
		await done;
		expect(motor.anchor).toEqual({ x: 930, y: 500 });
	});

	it("preserves fractional gait phase through a heading change at native frame rates", () => {
		const { motor, cycles, pose } = fixture();
		cycles.away.fps = 4;
		void motor.walk([
			{ x: 1060, y: 500 },
			{ x: 1060, y: 200 },
		]);
		motor.update(750); // phase 1.5 in the right cycle
		expect(pose().frame).toBe(1);
		motor.update(250); // turn, then add 1 frame: phase 2.5
		expect(motor.heading).toBe("away");
		expect(pose().frame).toBe(0);
		motor.update(125); // retained half-frame reaches phase 3
		expect(pose().frame).toBe(1);
	});

	it("stops mid-walk, resolves its promise, and shows the standing pose", async () => {
		const { motor, animate, pose } = fixture();
		const done = motor.walk([{ x: 1800, y: 500 }]);
		motor.update(100);
		const stopped = { ...motor.anchor };
		motor.stop();
		await done;
		expect(motor.walking).toBe(false);
		expect(pose().cycle.name).toBe("idle-right");
		expect(animate).toHaveBeenLastCalledWith("idle", "right", 1);
		motor.update(1000);
		expect(motor.anchor).toEqual(stopped);
	});

	it("snaps placement to the nearest floor cell", () => {
		const { motor } = fixture();
		motor.place({ x: 250, y: 280 });
		expect(motor.anchor).toEqual({ x: 360, y: 337.5 });
	});

	it("aligns the drawn body centre and normalises height against the left cycle", () => {
		const { motor, cycles, target } = fixture();
		cycles.left.drawnHeight = 180;
		cycles.away.drawnHeight = 90;
		cycles.away.bodyCentreX = 70;
		motor.face("away");
		expect(target.scale).toBe(0.5); // base 0.5 * perspective 0.5 * height ratio 2
		expect(target.x).toBe(950); // anchor 960 - body offset 20 * drawn scale 0.5
		expect(target.y).toBe(500);
		expect(target.depth).toBe(35);
	});
});
