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
	// Face the way most walks go, so a start is a start and not a pivot.
	motor.face("right");
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

	it("keeps the gait phase continuous through a heading change", () => {
		const { motor, pose } = fixture();
		void motor.walk([
			{ x: 1060, y: 500 },
			{ x: 1060, y: 200 },
		]);
		// Drawings follow ground metres, so the same distance always advances the
		// phase by the same amount; a turn must not restart the stride.
		const frames: number[] = [];
		let turned = false;
		for (let i = 0; i < 400 && !turned; i++) {
			motor.update(10);
			frames.push(pose().frame);
			turned = motor.heading === "away";
		}
		expect(turned).toBe(true);
		const before = frames.at(-2);
		const after = frames.at(-1);
		// The frame shown right after the turn is the next one in sequence (or the
		// same one), never a jump back to the cycle's start from a later frame.
		expect([before, (before! + 1) % 2]).toContain(after);
	});

	it("pivots through the standing poses on a reversal, then walks off", () => {
		const { motor, pose } = fixture();
		void motor.walk([{ x: 1800, y: 500 }]);
		for (let i = 0; i < 30; i++) motor.update(10);
		expect(motor.heading).toBe("right");
		const turned = { ...motor.anchor };
		void motor.walk([{ x: 100, y: 500 }]);
		// A 180-degree turn stands through the three headings between, facing
		// the camera on the way, and the body does not move while it turns.
		const seen: string[] = [];
		for (let i = 0; i < 30; i++) {
			motor.update(10);
			const name = pose().cycle.name;
			if (seen.at(-1) !== name) seen.push(name);
		}
		expect(seen).toEqual([
			"idle-toward-right",
			"idle-toward",
			"idle-toward-left",
			"left",
		]);
		expect(motor.heading).toBe("left");
		const poses = seen.length;
		expect(poses).toBe(4);
		expect(motor.anchor.x).toBeLessThan(turned.x);
		expect(turned.x - motor.anchor.x).toBeLessThan(10);
	});

	it("switches cycles in stride for a turn under 135 degrees", () => {
		const { motor, pose } = fixture();
		void motor.walk([{ x: 1800, y: 500 }]);
		for (let i = 0; i < 30; i++) motor.update(10);
		void motor.walk([{ x: motor.anchor.x, y: 100 }]);
		motor.update(10);
		expect(motor.heading).toBe("away");
		expect(pose().cycle.name).toBe("away");
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
