import { describe, expect, it } from "vitest";
import { scaleAt, toMetres } from "../walkarea/perspective";
import { CharacterMotor, type MotorTarget } from "./CharacterMotor";

function setup() {
	const target: MotorTarget & { scale: number } = {
		x: 960,
		y: 920,
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
		mask: { width: 2, height: 2, data: [1, 1, 1, 1] },
		perspective: { horizonY: 470, slope: 0.002 },
		baseScale: 0.5,
		scaleClamp: { min: 0.18, max: 1.5 },
	};
	const calls: { state: string; heading: string }[] = [];
	const motor = new CharacterMotor(target, area, (state, heading) => {
		calls.push({ state, heading });
	});
	return { target, area, motor, calls };
}
describe("CharacterMotor", () => {
	it("maintains ground speed and current-position scale across variable frame times", () => {
		const { motor, target, area } = setup();
		void motor.walk([{ x: 1100, y: 560 }]);
		for (const dt of [16, 33, 50, 100, 16, 80, 33]) {
			const before = toMetres(area.perspective, target);
			motor.update(dt);
			const after = toMetres(area.perspective, target);
			expect(
				Math.hypot(after.x - before.x, after.y - before.y) / (dt / 1000),
			).toBeCloseTo(1, 9);
			expect(target.scale).toBeCloseTo(
				0.5 * scaleAt(area.perspective, target, area.scaleClamp),
				10,
			);
		}
	});
	it("resolves arrival and replacement using only the virtual clock", async () => {
		const { motor, target } = setup();
		const first = motor.walk([{ x: 960, y: 800 }]);
		const second = motor.walk([{ x: 1100, y: 920 }]);
		await first;
		motor.update(10000);
		await second;
		expect(target.x).toBeCloseTo(1100);
		expect(motor.walking).toBe(false);
		expect(motor.heading).toBe("right");
		motor.detach();
		expect(target.motor).toBeUndefined();
	});
	it("consumes signed animation displacement without creating a forward remainder", () => {
		const { motor, target } = setup();
		let pixels = 10;
		motor.rootStep = () => pixels;
		void motor.walk([{ x: 1100, y: 920 }]);
		motor.update(1);
		expect(target.x).toBeCloseTo(970);
		pixels = -2;
		motor.update(1);
		expect(target.x).toBeCloseTo(968);
		pixels = 0;
		motor.update(100);
		expect(target.x).toBeCloseTo(968);
		pixels = 200;
		motor.update(1);
		expect(target.x).toBeCloseTo(1100);
		expect(motor.walking).toBe(false);
	});
	it("faces the current root-motion leg before looking ahead around a corner", () => {
		const { motor, target, calls } = setup();
		const headings: string[] = [];
		motor.rootStep = (heading, tangent) => {
			headings.push(heading);
			return Math.abs(tangent.y) > 0.9 ? 5 : 10;
		};
		void motor.walk([
			{ x: 960, y: 915 },
			{ x: 1000, y: 915 },
		]);
		motor.update(1);
		expect(headings[0]).toBe("away");
		expect(calls.filter((c) => c.state === "walk")).toEqual([
			{ state: "walk", heading: "away" },
		]);
		expect(target.y).toBeCloseTo(915);
		motor.update(1);
		expect(headings[1]).toBe("right");
		expect(target.x).toBeCloseTo(970);
	});
	it("keeps visual sway out of navigation and eases it to zero in four frames", () => {
		const { motor, target } = setup();
		motor.rootStep = () => ({
			distance: 2,
			offset: { x: 0, y: 6 },
			cycle: "side",
		});
		void motor.walk([{ x: 1100, y: 920 }]);
		for (let i = 0; i < 6; i++) motor.update(1000 / 24);
		expect(target.y).toBe(920);
		expect(motor.visualOffset.y).toBe(6);
		motor.stop();
		motor.update(1000 / 24);
		expect(motor.visualOffset.y).toBeGreaterThan(0);
		expect(motor.visualOffset.y).toBeLessThan(6);
		for (let i = 0; i < 4; i++) motor.update(1000 / 24);
		expect(motor.visualOffset.y).toBe(0);
		expect(target.y).toBe(920);
	});
});
