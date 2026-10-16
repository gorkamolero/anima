import { describe, expect, it, vi } from "vitest";
import {
	contactOnScreen,
	type FootCycle,
	type FootPose,
	lockedPlacement,
} from "../core/characters/footLock";
import { scaleAt } from "../core/walkarea/perspective";
import { CharacterMotor, type MotorTarget } from "./CharacterMotor";

function setup(standing = false, drawn = false) {
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
	const animate = vi.fn();
	const motor = new CharacterMotor(target, area, animate, {
		current: () => shown,
		select: (d) => ({ cycle, flipX: d === "left" }),
		standing: standing
			? () => ({
					cycle: {
						...cycle,
						name: "standing",
						settleFrames: drawn ? [2, 1, 0] : undefined,
						contacts: drawn
							? [
									{ planted: "L", L: { x: 70, y: 190 }, R: { x: 80, y: 190 } },
									{ planted: "L", L: { x: 70, y: 190 }, R: { x: 30, y: 190 } },
									cycle.contacts[0],
								]
							: [{ planted: "L", L: { x: 45, y: 200 }, R: { x: 55, y: 200 } }],
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
		animate,
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
	it("holds drawn stop poses for two ticks and starts them in reverse on the locked boot", async () => {
		const { motor, cycle, target, pose } = setup(true, true);
		cycle.matchedCut = {
			standing: "standing",
			headings: ["right"],
			exitFrames: [0],
			entryFrames: [0],
		};
		motor.place({ x: 960, y: 850 });
		let done = false;
		const walk = motor.walk([{ x: 1700, y: 850 }], "right").then(() => {
			done = true;
		});
		const anchor = { ...motor.anchor };
		const assertLocked = () => {
			const p = contactOnScreen(pose(), "L", target, target.scale);
			expect(p.x).toBeCloseTo(anchor.x, 9);
			expect(p.y).toBeCloseTo(anchor.y, 9);
		};
		for (const expected of [0, 1, 1, 2, 2]) {
			motor.update(1000 / 24);
			expect(pose().cycle.name).toBe("standing");
			expect(pose().frame).toBe(expected);
			assertLocked();
		}
		motor.update(1000 / 24);
		expect(pose().cycle.name).toBe("walk");
		expect(pose().frame).toBe(0);
		motor.stop();
		for (let i = 0; i < 40 && pose().cycle.name === "walk"; i++)
			motor.update(1000 / 24);
		expect(pose().cycle.name).toBe("standing");
		expect(pose().frame).toBe(1);
		expect(done).toBe(false);
		assertLocked();
		motor.update(1000 / 24);
		expect(pose().frame).toBe(1);
		motor.update(1000 / 24);
		expect(pose().frame).toBe(0);
		assertLocked();
		await walk;
		expect(done).toBe(true);
		expect(motor.walking).toBe(false);
	});
	it("cancels pending drawn frames on teleport", () => {
		const { motor, pose } = setup(true, true);
		motor.place({ x: 960, y: 850 });
		void motor.walk([{ x: 1700, y: 850 }], "right");
		motor.update(2000 / 24);
		expect(motor.snapshot().drawn).toBeDefined();
		motor.place({ x: 1000, y: 850 });
		motor.update(1000);
		expect(motor.snapshot().drawn).toBeUndefined();
		expect(motor.walking).toBe(false);
		expect(pose().frame).toBe(0);
	});
	it("settles back to rest when stopped during reverse playback", async () => {
		const { motor, pose, target } = setup(true, true);
		motor.place({ x: 960, y: 850 });
		const walk = motor.walk([{ x: 1700, y: 850 }], "right");
		motor.update(2000 / 24);
		expect(pose().frame).toBe(1);
		const position = { x: target.x, y: target.y };
		motor.stop();
		motor.update(2000 / 24);
		await walk;
		motor.update(1000);
		expect(motor.walking).toBe(false);
		expect(pose().cycle.name).toBe("standing");
		expect(pose().frame).toBe(0);
		expect(target.x).toBeCloseTo(position.x, 9);
		expect(target.y).toBeCloseTo(position.y, 9);
	});
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
	it("exposes an immediate passing exit across subdivided 24fps capture ticks", () => {
		const { motor, cycle, pose } = setup(true);
		// A long stance runs faster than 24 source frames/s at natural cadence.
		cycle.contacts = Array.from({ length: 60 }, (_, i) => ({
			planted: i < 30 ? "L" : "R",
			L: { x: i < 30 ? 70 - i : 40 + (i - 30), y: 190 },
			R: { x: i < 30 ? 40 + i : 70 - (i - 30), y: 190 },
		}));
		cycle.switchFrames = [0, 30];
		cycle.matchedCut = {
			standing: "standing",
			headings: ["left"],
			exitFrames: [0, 30],
			entryFrames: [0, 30],
		};
		motor.place({ x: 960, y: 850 });
		void motor.walk([{ x: 1400, y: 850 }]);
		motor.stop();
		const exit = pose().frame;
		motor.update(1000 / 60);
		motor.update(1000 / 60);
		expect(pose().cycle.name).toBe("walk");
		expect(pose().frame).toBe(exit);
		motor.update(1000);
		expect(pose().cycle.name).toBe("standing");
	}, 30000);
	it("waits beyond half a cycle for the sole source frame, transferring supports", () => {
		const { motor, cycle, pose, target } = setup(true);
		cycle.contacts = Array.from({ length: 12 }, (_, i) => ({
			planted: i < 6 ? "L" : "R",
			L: { x: i < 6 ? 70 - i * 2 : 70 + (i - 6) * 2, y: 190 },
			// The incoming sole must land ahead; the old fixture moved backwards at every transfer.
			R: { x: i < 6 ? 70 + i * 2 : 70 - (i - 6) * 2, y: 190 },
		}));
		cycle.switchFrames = [0, 6];
		cycle.matchedCut = {
			standing: "standing",
			headings: ["right"],
			entryFrames: [0],
			exitFrames: [0],
		};
		motor.place({ x: 960, y: 850 });
		void motor.walk([{ x: 1700, y: 850 }]);
		motor.update(80);
		expect(pose().frame).toBe(1);
		motor.stop();
		expect(motor.snapshot().transition?.remaining).toBe(11);
		let last = pose().frame;
		for (let i = 0; i < 30 && motor.walking; i++) {
			last = pose().frame;
			motor.update(1000 / 24);
			const snap = motor.snapshot();
			const sole = contactOnScreen(pose(), snap.planted, target, target.scale);
			expect(sole.x).toBeCloseTo(snap.anchor.x, 9);
			expect(sole.y).toBeCloseTo(snap.anchor.y, 9);
		}
		expect(last).toBe(0);
		expect(pose().cycle.name).toBe("standing");
		expect(motor.snapshot().cut?.waitFrames).toBe(11);
		expect(motor.snapshot().cut?.matched).toBe(true);
	});

	it("measures arrival at the eventual planted sole after support transfers", () => {
		const { motor, cycle, pose } = setup(true);
		cycle.matchedCut = {
			standing: "standing",
			headings: ["right"],
			entryFrames: [0],
			exitFrames: [0],
		};
		motor.place({ x: 960, y: 850 });
		// Choose a reachable source-frame endpoint from an independent traversal.
		const reference = setup(true);
		reference.cycle.matchedCut = cycle.matchedCut;
		reference.motor.place({ x: 960, y: 850 });
		void reference.motor.walk([{ x: 1700, y: 850 }]);
		for (let i = 0; i < 15; i++) reference.motor.update(1000 / 24);
		reference.motor.stop();
		for (let i = 0; i < 40 && reference.motor.walking; i++)
			reference.motor.update(1000 / 24);
		void motor.walk([{ x: reference.target.x, y: reference.target.y }]);
		for (let i = 0; i < 1000 && motor.walking; i++) motor.update(1000 / 24);
		const arrival = motor.snapshot().arrival;
		expect(arrival).toBeDefined();
		expect(pose().cycle.name).toBe("standing");
		if (!arrival) throw Error("Missing arrival");
		expect(
			Math.hypot(
				motor.anchor.x - arrival.target.x,
				motor.anchor.y - arrival.target.y,
			),
		).toBeCloseTo(arrival.distance, 8);
		expect(arrival.distance).toBeLessThanOrEqual(arrival.halfStride);
		expect(motor.snapshot().cut?.matched).toBe(true);
	});

	it("does not substitute an unmatched standing cut when the source is blocked", () => {
		const { motor, cycle, pose } = setup(true);
		cycle.matchedCut = {
			standing: "standing",
			headings: ["right"],
			entryFrames: [0],
			exitFrames: [0],
		};
		motor.place({ x: 960, y: 850 });
		void motor.walk([{ x: 1700, y: 850 }]);
		motor.update(250);
		const frame = pose().frame;
		// The remaining approach would plant the incoming sole outside the room.
		cycle.contacts[3].L.x = 10000;
		motor.stop();
		motor.update(1000);
		expect(motor.walking).toBe(false);
		expect(pose().cycle.name).toBe("walk");
		expect(pose().frame).toBe(frame);
		expect(motor.snapshot().cut).toBeUndefined();
		expect(motor.snapshot().unmatchedCut).toBe(true);
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

	it("does not transfer to a swinging foot when boundary recovery cannot settle", () => {
		const { motor, cycle, pose, target } = setup(true);
		cycle.matchedCut = {
			standing: "standing",
			headings: ["right"],
			entryFrames: [0],
			exitFrames: [0],
		};
		motor.place({ x: 960, y: 850 });
		void motor.walk([{ x: 1700, y: 850 }]);
		motor.update(250);
		cycle.contacts[3].L.x = 10000;
		// The planner requests this recovery after exhausting safe turns.
		Object.assign(motor, { recoverAfterStanding: true });
		const before = motor.snapshot();
		const position = { x: target.x, y: target.y, depth: target.depth };
		motor.stop();
		expect(motor.snapshot().unmatchedCut).toBe(true);
		expect(motor.snapshot().planted).toBe(before.planted);
		expect(motor.anchor).toEqual(before.anchor);
		expect({ x: target.x, y: target.y, depth: target.depth }).toEqual(position);
		expect(
			contactOnScreen(pose(), before.planted, target, target.scale),
		).toEqual(before.anchor);
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
		// Compare execution of the same search result, not two wall-time cutoffs.
		const clock = vi.spyOn(performance, "now").mockReturnValue(0);
		void a.motor.walk([{ x: 1400, y: 850 }]);
		void b.motor.walk([{ x: 1400, y: 850 }]);
		clock.mockRestore();
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

it("executes cached lattice supports exactly without runtime replanning", async () => {
	const { motor, cycle } = setup(true, true);
	cycle.matchedCut = {
		standing: "standing",
		headings: ["right"],
		exitFrames: [0],
		entryFrames: [0],
	};
	motor.place({ x: 960, y: 850 });
	const internal = motor as unknown as {
		planned: { state: { anchor: { x: number; y: number } } }[];
		buildPlan: () => void;
	};
	const walk = motor.walk([{ x: 1400, y: 850 }]);
	const expected = internal.planned.map((s) => ({ ...s.state.anchor }));
	let consumed = 0,
		remaining = internal.planned.length;
	internal.buildPlan = () => {
		throw Error("Playback must not replan");
	};
	for (let i = 0; i < 2000 && motor.walking; i++) {
		motor.update(1000 / 24);
		const next = internal.planned.length;
		if (next < remaining && next > 0) {
			expect(motor.anchor.x).toBeCloseTo(expected[consumed].x, 7);
			expect(motor.anchor.y).toBeCloseTo(expected[consumed].y, 7);
			consumed++;
		}
		remaining = next;
	}
	await walk;
	expect(consumed).toBeGreaterThan(0);
	expect(motor.walking).toBe(false);
});

it("cancels an in-flight worker and ignores its stale reply", async () => {
	class FakeWorker {
		static current: FakeWorker;
		onmessage?: (event: unknown) => void;
		onerror?: (event: unknown) => void;
		terminate = vi.fn();
		postMessage = vi.fn();
		constructor() {
			FakeWorker.current = this;
		}
	}
	vi.stubGlobal("Worker", FakeWorker);
	try {
		const { motor, target, animate } = setup();
		motor.place({ x: 960, y: 850 });
		const start = { x: target.x, y: target.y };
		const promise = motor.walk([{ x: 1300, y: 850 }]);
		expect(motor.snapshot().plan.pending).toBe(true);
		expect(animate).toHaveBeenLastCalledWith("walk", motor.heading, 1);
		expect(motor.walking).toBe(false);
		motor.update(1000);
		expect({ x: target.x, y: target.y }).toEqual(start);
		const worker = FakeWorker.current;
		motor.stop(true);
		await promise;
		expect(worker.terminate).toHaveBeenCalledOnce();
		expect(animate).toHaveBeenLastCalledWith("idle", motor.heading, 1);
		worker.onmessage?.({ data: {} });
		expect(motor.snapshot().plan.pending).toBe(false);
		expect(motor.walking).toBe(false);
	} finally {
		vi.unstubAllGlobals();
	}
});

it.each([
	false,
	true,
])("produces identical worker and synchronous frames (threshold=%s)", (threshold) => {
	const direct = setup(true, true);
	if (threshold) direct.motor.placeContact({ x: 960, y: 850 });
	else direct.motor.place({ x: 960, y: 850 });
	void direct.motor.walk([{ x: 1400, y: 850 }]);
	class InlineWorker {
		onmessage?: (event: {
			data: ReturnType<typeof CharacterMotor.computePlan>;
		}) => void;
		terminate() {}
		postMessage(request: Parameters<typeof CharacterMotor.computePlan>[0]) {
			this.onmessage?.({ data: CharacterMotor.computePlan(request) });
		}
	}
	vi.stubGlobal("Worker", InlineWorker);
	try {
		const worker = setup(true, true);
		if (threshold) worker.motor.placeContact({ x: 960, y: 850 });
		else worker.motor.place({ x: 960, y: 850 });
		void worker.motor.walk([{ x: 1400, y: 850 }]);
		for (let i = 0; i < 300; i++) {
			direct.motor.update(1000 / 24);
			worker.motor.update(1000 / 24);
			expect(worker.motor.snapshot()).toEqual(direct.motor.snapshot());
			expect(worker.pose()).toEqual(direct.pose());
			expect([worker.target.x, worker.target.y, worker.target.scale]).toEqual([
				direct.target.x,
				direct.target.y,
				direct.target.scale,
			]);
		}
	} finally {
		vi.unstubAllGlobals();
	}
});

it("absorbs a one-pixel stop error smoothly within the final stance", () => {
	const cycle: FootCycle = {
		name: "absorption-walk",
		frameWidth: 200,
		frameHeight: 200,
		fps: 24,
		switchFrames: [0, 6],
		matchedCut: {
			standing: "absorption-idle",
			headings: ["right"],
			entryFrames: [0],
			exitFrames: [5],
		},
		contacts: Array.from({ length: 12 }, (_, i) => ({
			planted: i < 6 ? "L" : "R",
			L: { x: 100 - i * 20, y: 200 },
			R: { x: 120, y: 200 },
		})),
	};
	const idle: FootCycle = {
		...cycle,
		name: "absorption-idle",
		contacts: [{ planted: "L", L: { x: 100, y: 200 }, R: { x: 120, y: 200 } }],
		switchFrames: [],
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
			perspective: { constant: 1, horizonY: 0, slope: 0 },
			baseScale: 1,
			scaleClamp: { min: 1, max: 1 },
		},
		() => {},
		{
			current: () => pose,
			select: () => ({ cycle, flipX: false }),
			show: (p) => {
				pose = p;
			},
			standing: () => ({ cycle: idle, frame: 0, flipX: false }),
		},
	);
	motor.place({ x: 500, y: 800 }, false);
	// Prepare a native stance at its first drawing, as planStance does.
	const state = motor as unknown as {
		pose: FootPose;
		goal: { x: number; y: number };
	};
	state.pose = pose = { cycle, frame: 0, flipX: false };
	state.goal = { x: 501, y: 800 };
	motor.stop(false, true);
	expect(motor.anchor).toEqual({ x: 500, y: 800 });
	const positions: number[] = [];
	for (let i = 0; i < 30 && motor.walking; i++) {
		motor.update(1000 / 24);
		positions.push(motor.anchor.x);
	}
	expect(motor.walking).toBe(false);
	expect(motor.anchor.x).toBeCloseTo(501, 8);
	expect(positions.filter((x) => x > 500 && x < 501).length).toBeGreaterThan(2);
	expect(Math.max(...positions) - 500).toBeLessThanOrEqual(1.5);
	expect(positions.every((x, i) => i === 0 || x >= positions[i - 1])).toBe(
		true,
	);
});

it("rejects a boot on an object footprint even when raw floor and body are clear", () => {
	const { motor, area, cycle } = setup();
	motor.area.objectFootprints = {
		...area.mask,
		data: area.mask.data.map(() => 0),
	};
	motor.place({ x: 960, y: 850 }, false);
	const state = motor as unknown as {
		predictStance(
			pose: FootPose,
		): { anchor: { x: number; y: number } } | undefined;
	};
	const pose = { cycle, frame: 0, flipX: false };
	const next = state.predictStance(pose);
	expect(next).toBeDefined();
	if (!next) throw new Error("Expected an unobstructed baseline stance");
	const landing = next.anchor;
	const m = motor.area.objectFootprints;
	m.data[
		Math.floor((landing.y * m.height) / 1080) * m.width +
			Math.floor((landing.x * m.width) / 1920)
	] = 1;
	expect(state.predictStance(pose)).toBeUndefined();
});

it("allows an initial marginal body cell to escape inward, but not a later stance", () => {
	const { motor, area, cycle } = setup();
	motor.area.rawMask = { ...area.mask, data: [...area.mask.data] };
	motor.area.clearanceMask = {
		...area.mask,
		data: area.mask.data.map((_, i) => (i % area.mask.width < 90 ? 0 : 1)),
	};
	motor.place({ x: 899, y: 850 }, false);
	const state = motor as unknown as {
		predictStance(
			pose: FootPose,
		): { end: { x: number; y: number } } | undefined;
	};
	expect(
		state.predictStance({ cycle, frame: 0, flipX: false }),
	).toBeUndefined();
	const inward = state.predictStance({
		cycle,
		frame: 0,
		flipX: false,
		firstStance: true,
	});
	expect(inward).toBeDefined();
	expect(inward?.end.x).toBeGreaterThanOrEqual(900);
	motor.place({ x: 879, y: 850 }, false);
	expect(
		state.predictStance({ cycle, frame: 0, flipX: false, firstStance: true }),
	).toBeUndefined();
});

it("tries the next compatible entry when the first phase clips an object footprint", () => {
	const { motor, area, cycle, pose } = setup(true);
	cycle.contacts = [
		{ planted: "L", L: { x: 100, y: 190 }, R: { x: 30, y: 190 } },
		{ planted: "L", L: { x: 50, y: 190 }, R: { x: 70, y: 190 } },
		{ planted: "L", L: { x: 30, y: 190 }, R: { x: 90, y: 190 } },
		{ planted: "R", L: { x: 30, y: 190 }, R: { x: 50, y: 190 } },
		{ planted: "R", L: { x: 70, y: 190 }, R: { x: 30, y: 190 } },
		{ planted: "R", L: { x: 90, y: 190 }, R: { x: 10, y: 190 } },
	];
	cycle.switchFrames = [0, 1, 3];
	motor.area.clearanceMask = {
		...area.mask,
		data: area.mask.data.map((v, i) => (i % area.mask.width === 94 ? 0 : v)),
	};
	motor.area.objectFootprints = {
		...area.mask,
		data: area.mask.data.map((_, i) => (i % area.mask.width === 94 ? 1 : 0)),
	};
	motor.place({ x: 960, y: 850 }, false);
	const internal = motor as unknown as {
		animation: { select: (direction: string) => Omit<FootPose, "frame"> };
	};
	const invalid = {
		...cycle,
		name: "invalid",
		contacts: cycle.contacts.map((c) => ({
			...c,
			L: { x: 0, y: -1 },
			R: { x: 0, y: -1 },
		})),
	};
	internal.animation.select = (direction) => ({
		cycle: direction === "right" ? cycle : invalid,
		flipX: false,
	});
	void motor.walk([{ x: 1400, y: 850 }], "right");
	expect(motor.walking).toBe(true);
	expect(pose().frame).toBe(1);
});

it("uses the drawn support through an idle turn's settle frames", () => {
	const { motor, target, area } = setup();
	const source: FootCycle = {
		name: "source-idle",
		frameWidth: 100,
		frameHeight: 200,
		fps: 24,
		switchFrames: [],
		contacts: [{ planted: "R", L: { x: 50, y: 190 }, R: { x: 70, y: 190 } }],
	};
	const destination: FootCycle = {
		...source,
		name: "destination-idle",
		settleFrames: [2, 1, 0],
		contacts: [90, 50, 30].map((x) => ({
			planted: "L",
			L: { x: 50, y: 190 },
			R: { x, y: 190 },
		})),
	};
	let pose: FootPose = { cycle: source, frame: 0, flipX: false };
	const animation = {
		current: () => pose,
		show: (p: FootPose) => {
			pose = p;
		},
		select: (h: string) => ({
			cycle: h === "right" ? source : destination,
			flipX: false,
		}),
		standing: (h: string) => ({
			cycle: h === "right" ? source : destination,
			frame: 0,
			flipX: false,
		}),
	};
	motor.detach();
	const turning = new CharacterMotor(target, area, () => {}, animation);
	turning.heading = "right";
	turning.place({ x: 960, y: 850 }, false);
	const support = contactOnScreen(pose, "L", target, target.scale);
	turning.face("left");
	for (let i = 0; i < 8; i++) {
		turning.update(1000 / 24);
		const sole = contactOnScreen(pose, "L", target, target.scale);
		expect(
			Math.hypot(sole.x - support.x, sole.y - support.y),
		).toBeLessThanOrEqual(1.5);
	}
	expect(pose.cycle.name).toBe("destination-idle");
});

it("measures first-stance clearance from the cut pose, not the old standing origin", () => {
	const { motor, area, cycle, target } = setup();
	motor.area.rawMask = { ...area.mask, data: [...area.mask.data] };
	motor.area.clearanceMask = {
		...area.mask,
		data: area.mask.data.map((_, i) => (i % area.mask.width < 90 ? 0 : 1)),
	};
	motor.place({ x: 920, y: 850 }, false);
	const state = {
		start: { x: 879, y: 850 },
		end: { x: 879, y: 850 },
		anchor: { ...motor.anchor },
		foot: "L",
		pose: { cycle, frame: 0, flipX: false },
		scale: target.scale,
	};
	const internal = motor as unknown as {
		predictStance(pose: FootPose, state: unknown): unknown;
	};
	expect(internal.predictStance(state.pose, state)).toBeUndefined();
	expect(
		internal.predictStance({ ...state.pose, firstStance: true }, state),
	).toBeDefined();
});

it("holds a standing pivot and cancels it without starting the queued stride", () => {
	const { motor, target, cycle, pose } = setup(true);
	motor.place({ x: 960, y: 850 });
	const resting = pose();
	const anchor = contactOnScreen(resting, "L", target, target.scale);
	const internal = motor as unknown as {
		planned: unknown[];
		beginWalk(): void;
	};
	internal.planned = [
		{
			heading: "right",
			pose: { cycle, frame: 0, flipX: false },
			state: {
				start: { x: target.x, y: target.y },
				end: { x: target.x, y: target.y },
				pose: resting,
				foot: "L",
				anchor,
				scale: target.scale,
				pivot: { pose: resting, foot: "L", anchor },
			},
			stop: false,
			slide: { x: 0, y: 0 },
		},
	];
	internal.beginWalk();
	expect(motor.walking).toBe(true);
	expect(pose().cycle.name).toBe("standing");
	const sole = contactOnScreen(pose(), "L", target, target.scale);
	motor.update(1000 / 24);
	expect(contactOnScreen(pose(), "L", target, target.scale)).toEqual(sole);
	motor.stop();
	motor.update(1000);
	expect(motor.walking).toBe(false);
	expect(internal.planned).toHaveLength(0);
	expect(pose().cycle.name).toBe("standing");
});

it("steps inward from the caption boundary while keeping both supports on raw floor", () => {
	const { motor, area, cycle } = setup();
	motor.area.rawMask = { ...area.mask, data: [...area.mask.data] };
	motor.area.clearanceMask = {
		...area.mask,
		data: area.mask.data.map((_, i) =>
			Math.floor(i / area.mask.width) < 85 ? 1 : 0,
		),
	};
	cycle.contacts[1].L.y = 198;
	cycle.contacts[1].R.y = 160;
	motor.place({ x: 960, y: 860 }, false);
	const internal = motor as unknown as {
		predictStance(
			pose: FootPose,
		): { anchor: { x: number; y: number } } | undefined;
	};
	expect(motor.anchor.y).toBeGreaterThan(850);
	expect(
		internal.predictStance({ cycle, frame: 0, flipX: false }),
	).toBeUndefined();
	const inward = internal.predictStance({
		cycle,
		frame: 0,
		flipX: false,
		firstStance: true,
	});
	expect(inward).toBeDefined();
	expect(inward?.anchor.y).toBeLessThan(850);
});

it("measures a full authored stride even when the next landing is blocked", () => {
	const { motor, area, cycle } = setup(true);
	motor.place({ x: 960, y: 850 });
	const internal = motor as unknown as {
		authoredHalfStride(
			heading: "right",
			anchor: { x: number; y: number },
		): number;
	};
	const before = internal.authoredHalfStride("right", motor.anchor);
	expect(before).toBeGreaterThan(2);
	// Collision changes cannot turn an authored stride into a two-pixel tolerance.
	area.mask.data.fill(0);
	expect(internal.authoredHalfStride("right", motor.anchor)).toBe(before);
	expect(cycle.switchFrames.length).toBe(2);
});
it("a click plan contains standing pivots only at its first action and one final stop", () => {
	const { motor } = setup(true);
	motor.place({ x: 960, y: 850 });
	void motor.walk([{ x: 1700, y: 850 }]);
	const internal = motor as unknown as {
		planned: { stop: boolean; state: { pivot?: unknown } }[];
	};
	expect(internal.planned.length).toBeGreaterThan(1);
	expect(internal.planned.slice(1).every((step) => !step.state.pivot)).toBe(
		true,
	);
	expect(internal.planned.filter((step) => step.stop)).toHaveLength(1);
	expect(internal.planned[internal.planned.length - 1]?.stop).toBe(true);
});

it("does not stretch a late entry over the duration of a complete support", () => {
	const { motor, cycle, pose } = setup();
	const original = cycle.contacts;
	cycle.contacts = Array.from(
		{ length: 24 },
		(_, i) => original[Math.floor(i / 6)],
	);
	cycle.switchFrames = [0, 12];
	motor.place({ x: 960, y: 850 });
	const internal = motor as unknown as {
		planned: unknown[];
		planStance: () => boolean;
	};
	internal.planned = [
		{
			pose: { cycle, frame: 10, flipX: false },
			heading: "right",
			stop: false,
			slide: { x: 0, y: 0 },
			state: { anchor: { ...motor.anchor } },
		},
	];
	expect(internal.planStance()).toBe(true);
	motor.walking = true;
	motor.update(1000 / 24);
	expect(pose().frame).toBe(11);
});
