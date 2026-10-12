import { describe, expect, it } from "vitest";
import { scaleAt } from "../walkarea/perspective";
import { CharacterMotor, type MotorTarget } from "./CharacterMotor";
import {
	contactOnScreen,
	type FootCycle,
	type FootPose,
	lockedPlacement,
} from "./footLock";

function setup(standing = false) {
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
	const target: MotorTarget & { scale: number; depth: number } = {
		x: 960,
		y: 850,
		scale: 1,
		depth: 0,
		setPosition(x, y) {
			this.x = x;
			this.y = y;
		},
		setScale(s) {
			this.scale = s;
		},
		setDepth(depth) {
			this.depth = depth;
		},
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
		standing: standing
			? () => ({
					cycle: {
						...cycle,
						name: "standing",
						contacts: [
							{ planted: "L", L: { x: 45, y: 200 }, R: { x: 55, y: 200 } },
						],
						switchFrames: [],
					},
					frame: 0,
					flipX: false,
				})
			: undefined,
		show: (p) => {
			shown = p;
		},
	});
	return {
		motor,
		target,
		area,
		cycle,
		pose: () => shown,
		setPose: (p: FootPose) => {
			shown = p;
		},
	};
}
describe("contact motor", () => {
	it("cuts to standing on a frame boundary, preserving the support", async () => {
		const { motor, target, pose } = setup(true);
		motor.place({ x: 960, y: 850 });
		let resolved = false;
		const walk = motor.walk([{ x: 1400, y: 850 }]).then(() => {
			resolved = true;
		});
		for (let i = 0; i < 8; i++) motor.update(1000 / 24);
		const anchor = { ...motor.anchor };
		const foot = motor.snapshot().planted;
		motor.stop();
		for (let i = 0; i < 4; i++) {
			expect(resolved).toBe(false);
			motor.update(1000 / 24);
			const sole = contactOnScreen(pose(), foot, target, target.scale);
			expect(sole.x).toBeCloseTo(anchor.x, 9);
			expect(sole.y).toBeCloseTo(anchor.y, 9);
		}
		await walk;
		expect(resolved).toBe(true);
		expect(motor.walking).toBe(false);
		expect(pose().cycle.name).toBe("standing");
	});
	it("restarts on the actual right support instead of the standing sheet default", () => {
		const { motor, target, pose } = setup(true);
		motor.place({ x: 960, y: 850 });
		void motor.walk([{ x: 1700, y: 850 }]);
		for (let i = 0; i < 100 && motor.snapshot().planted !== "R"; i++)
			motor.update(1000 / 24);
		expect(motor.snapshot().planted).toBe("R");
		motor.stop();
		for (let i = 0; i < 4; i++) motor.update(1000 / 24);
		const anchor = { ...motor.anchor };
		void motor.walk([{ x: 1700, y: 850 }]);
		expect(motor.snapshot().planted).toBe("R");
		for (let i = 0; i < 4; i++) {
			motor.update(1000 / 24);
			const sole = contactOnScreen(pose(), "R", target, target.scale);
			expect(sole.x).toBeCloseTo(anchor.x, 9);
			expect(sole.y).toBeCloseTo(anchor.y, 9);
		}
	});
	it("cuts into walking immediately and locks the starting support", () => {
		const { motor, target, pose } = setup(true);
		motor.place({ x: 960, y: 850 });
		const anchor = { ...motor.anchor };
		void motor.walk([{ x: 1400, y: 850 }]);
		for (let i = 0; i < 4; i++) {
			motor.update(1000 / 24);
			const sole = contactOnScreen(pose(), "L", target, target.scale);
			expect(sole.x).toBeCloseTo(anchor.x, 9);
			expect(sole.y).toBeCloseTo(anchor.y, 9);
		}
		expect(motor.snapshot().settling).toBe(false);
		expect(pose().cycle.name).toBe("walk");
	});
	it("waits for the measured exit and cuts only on the following boundary", () => {
		const { motor, cycle, pose } = setup(true);
		cycle.matchedCut = {
			standing: "standing",
			headings: ["left"],
			exitFrames: [1, 3],
			entryFrames: [0, 2],
		};
		motor.place({ x: 960, y: 850 });
		void motor.walk([{ x: 1400, y: 850 }]);
		expect(pose().cycle.name).toBe("walk");
		expect(cycle.matchedCut.entryFrames).toContain(pose().frame);
		motor.stop();
		let lastWalk = pose().frame;
		for (let i = 0; i < 40 && motor.walking; i++) {
			if (pose().cycle.name === "walk") lastWalk = pose().frame;
			motor.update(1000 / 24);
		}
		expect(cycle.matchedCut.exitFrames).toContain(lastWalk);
		expect(pose().cycle.name).toBe("standing");
		expect(motor.walking).toBe(false);
	});
	it("renders the selected exit before a cut even after a large update", () => {
		const { motor, cycle, pose } = setup(true);
		cycle.matchedCut = {
			standing: "standing",
			headings: ["left"],
			exitFrames: [1, 3],
			entryFrames: [0, 2],
		};
		motor.place({ x: 960, y: 850 });
		void motor.walk([{ x: 1400, y: 850 }]);
		motor.stop();
		motor.update(1000);
		expect(pose().cycle.name).toBe("walk");
		expect(cycle.matchedCut.exitFrames).toContain(pose().frame);
		motor.update(1000);
		expect(pose().cycle.name).toBe("standing");
		expect(motor.snapshot().cut?.from).toEqual(motor.snapshot().cut?.to);
	});
	it("sorts by the planted sole rather than bobbing sprite origin", () => {
		const { motor, target } = setup();
		void motor.walk([{ x: 1400, y: 850 }]);
		const anchor = { ...motor.anchor },
			depth = target.depth;
		motor.update(1000 / 24);
		expect(motor.anchor).toEqual(anchor);
		expect(target.depth).toBe(depth);
		expect(target.depth).toBeCloseTo(10 + anchor.y / 20, 10);
	});

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
		a.motor.update(500);
		for (let i = 0; i < 30; i++) b.motor.update(1000 / 60);
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
	it("rejects a stance whose incoming boot would land outside the raw floor", () => {
		const { motor, area, target, cycle } = setup();
		area.mask.data.fill(1);
		// Body remains well inside the room, but the incoming sole points outside it.
		cycle.contacts[1].R.x = 10000;
		cycle.contacts[3].L.x = 10000;
		const before = { x: target.x, y: target.y };
		void motor.walk([{ x: 1400, y: 850 }]);
		expect(motor.walking).toBe(false);
		expect({ x: target.x, y: target.y }).toEqual(before);
	});
	it("checks body clearance through the whole stance, not just its endpoint", () => {
		const { motor, target, cycle } = setup();
		cycle.contacts[1].L.y = -5000;
		cycle.contacts[3].R.y = -5000;
		const before = { x: target.x, y: target.y };
		void motor.walk([{ x: 1400, y: 850 }]);
		expect(motor.walking).toBe(false);
		expect({ x: target.x, y: target.y }).toEqual(before);
	});
	it("keeps every accepted stance on the body floor while replanning", () => {
		const { motor, target, area } = setup();
		for (let y = 0; y < area.mask.height; y++)
			for (let x = 115; x < area.mask.width; x++)
				area.mask.data[y * area.mask.width + x] = 0;
		void motor.walk([{ x: 1500, y: 850 }]);
		for (let i = 0; i < 300 && motor.walking; i++) {
			motor.update(1000 / 24);
			expect(target.x).toBeLessThan(1150);
		}
		expect(motor.walking).toBe(false);
		expect(target.x).toBeGreaterThan(1050);
	});
	it("uses the raw floor for boots and the eroded floor for the body", () => {
		const { motor, area, cycle } = setup();
		motor.area.rawMask = { ...area.mask, data: [...area.mask.data] };
		for (let i = 0; i < area.mask.data.length; i++)
			if (i % area.mask.width < 90) area.mask.data[i] = 0;
		for (const c of cycle.contacts) {
			c.L.x -= 200;
			c.R.x -= 200;
		}
		void motor.walk([{ x: 1400, y: 850 }]);
		expect(motor.anchor.x).toBeLessThan(900);
		expect(motor.walking).toBe(true);
	});
	it("places using a freshly selected pose instead of restoring the last walk pose", () => {
		const { motor, cycle, pose, setPose } = setup();
		void motor.walk([{ x: 1400, y: 850 }]);
		motor.update(1000 / 24);
		setPose({ cycle, frame: 3, flipX: true });
		motor.place({ x: 800, y: 850 });
		expect(pose().frame).toBe(3);
		expect(pose().flipX).toBe(true);
		expect(motor.walking).toBe(false);
	});
	it("rejects a stance whose incoming body has no safe continuation", () => {
		const { motor, target, cycle, pose } = setup();
		cycle.contacts[2].R.y = -3000;
		void motor.walk([{ x: 1400, y: 850 }]);
		expect(motor.walking).toBe(false);
		for (let i = 0; i < 12; i++) {
			motor.update(1000 / 24);
			expect(target.y).toBeGreaterThanOrEqual(0);
			expect(target.y).toBeLessThan(1080);
			expect(pose().frame).not.toBe(2);
		}
	});
	it("does not enter a one-frame support pivot that can disappear between captures", () => {
		const { motor, cycle } = setup();
		cycle.contacts[1].planted = "R";
		cycle.contacts[2].planted = "L";
		cycle.switchFrames = [0, 1, 2, 3];
		void motor.walk([{ x: 1400, y: 850 }]);
		expect(motor.walking).toBe(false);
	});
	it("caps even sparse partial supports at 2.2 steps per second", () => {
		const { motor, cycle } = setup();
		cycle.contacts = [
			cycle.contacts[0],
			cycle.contacts[0],
			cycle.contacts[1],
			cycle.contacts[1],
			cycle.contacts[2],
			cycle.contacts[3],
		];
		cycle.switchFrames = [0, 4];
		cycle.fps = 6; // Sparse artwork must not force an unnaturally fast cadence.
		void motor.walk([{ x: 1800, y: 850 }]);
		for (let i = 0; i < 24 && motor.snapshot().planted === "L"; i++)
			motor.update(1000 / 24);
		expect(motor.snapshot().planted).toBe("R");
		let frames = 0;
		while (motor.snapshot().planted === "R" && frames < 24) {
			motor.update(1000 / 24);
			frames++;
		}
		expect(motor.snapshot().planted).toBe("L");
		expect(frames).toBeGreaterThanOrEqual(10);
		expect(frames).toBeLessThanOrEqual(13);
	});
});
