import { describe, expect, it } from "vitest";
import { scaleAt } from "../walkarea/perspective";
import { CharacterMotor, type MotorTarget } from "./CharacterMotor";
import {
	contactOnScreen,
	type FootCycle,
	type FootPose,
	lockedPlacement,
} from "./footLock";

function setup() {
	const cycle: FootCycle = {
		name: "walk",
		frameWidth: 100,
		frameHeight: 200,
		fps: 24,
		switchFrames: [0, 2],
		contacts: [
			{ planted: "L", L: { x: 70, y: 190 }, R: { x: 30, y: 190 } },
			{ planted: "L", L: { x: 50, y: 188 }, R: { x: 70, y: 190 } },
			{ planted: "R", L: { x: 30, y: 190 }, R: { x: 50, y: 190 } },
			{ planted: "R", L: { x: 90, y: 190 }, R: { x: 30, y: 188 } },
		],
	};
	let shown: FootPose = { cycle, frame: 0, flipX: false };
	const target: MotorTarget & { scale: number } = {
		x: 960,
		y: 850,
		scale: 1,
		setPosition(x, y) {
			this.x = x;
			this.y = y;
		},
		setScale(s) {
			this.scale = s;
		},
		setDepth() {},
	};
	const area = {
		mask: { width: 192, height: 108, data: Array(192 * 108).fill(1) },
		perspective: { horizonY: 470, slope: 0.002 },
		baseScale: 0.5,
		scaleClamp: { min: 0.18, max: 1.5 },
	};
	const motor = new CharacterMotor(target, area, () => {}, {
		current: () => shown,
		select: (d) => ({ cycle, flipX: d === "left" }),
		show: (p) => {
			shown = p;
		},
	});
	return { motor, target, area, cycle, pose: () => shown };
}
describe("contact motor", () => {
	it("locks the first foot through start and mirrored perspective changes", () => {
		for (const flipX of [false, true]) {
			const { cycle, area } = setup();
			const pose = { cycle, frame: 1, flipX };
			const anchor = { x: 400, y: 850 };
			const placed = lockedPlacement(
				anchor,
				pose,
				"L",
				area.perspective,
				area.baseScale,
				area.scaleClamp,
				0.4,
			);
			expect(contactOnScreen(pose, "L", placed, placed.scale)).toEqual(anchor);
			expect(placed.scale).toBeCloseTo(
				area.baseScale * scaleAt(area.perspective, placed, area.scaleClamp),
				10,
			);
		}
	});
	it("derives travel from frames, independently of update subdivision", () => {
		const a = setup(),
			b = setup();
		void a.motor.walk([{ x: 1400, y: 850 }]);
		void b.motor.walk([{ x: 1400, y: 850 }]);
		a.motor.update(1000 / 6);
		for (let i = 0; i < 10; i++) b.motor.update(1000 / 60);
		expect(a.target.x).toBeCloseTo(b.target.x, 9);
		expect(a.target.y).toBeCloseTo(b.target.y, 9);
		expect(a.pose().frame).toBe(b.pose().frame);
		expect(a.target.x).toBeGreaterThan(960);
	});
	it("bounds total anchor correction and never moves a held contact", () => {
		const { motor, target, pose } = setup();
		void motor.walk([{ x: 1400, y: 850 }]);
		const start = { ...motor.anchor };
		motor.update(1000 / 24);
		expect(
			Math.hypot(motor.anchor.x - start.x, motor.anchor.y - start.y),
		).toBeLessThanOrEqual(1);
		const point = contactOnScreen(
			pose(),
			pose().cycle.contacts[pose().frame].planted,
			target,
			target.scale,
		);
		expect(point.x).toBeCloseTo(motor.anchor.x, 10);
		expect(point.y).toBeCloseTo(motor.anchor.y, 10);
		motor.stop();
		const last = { x: target.x, y: target.y };
		motor.update(1000);
		expect({ x: target.x, y: target.y }).toEqual(last);
	});
	it("resolves replaced walks and preserves contact when stopping", async () => {
		const { motor, target } = setup();
		const first = motor.walk([{ x: 1400, y: 850 }]);
		void motor.walk([{ x: 1300, y: 850 }]);
		await first;
		motor.update(100);
		const last = { x: target.x, y: target.y };
		motor.detach();
		expect(target.motor).toBeUndefined();
		expect({ x: target.x, y: target.y }).toEqual(last);
	});
});
