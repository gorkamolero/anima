import { describe, expect, it } from "vitest";
import { walkHeading, walkPlaybackRate } from "./walkHeading";

describe("walk heading", () => {
	const origin = { x: 0, y: 0 };
	it("selects all four directions", () => {
		for (const [x, y, direction] of [
			[100, 0, "right"],
			[-100, 0, "left"],
			[0, -100, "away"],
			[0, 100, "toward"],
		] as const)
			expect(walkHeading(origin, [{ x, y }], 0, "left")).toBe(direction);
	});
	it("looks through horizontal grid steps into depth without flicker", () => {
		const path = Array.from({ length: 30 }, (_, i) => ({
			x: Math.floor((i + 1) / 2) * 8,
			y: -Math.ceil((i + 1) / 2) * 24,
		}));
		const previous = "away" as const;
		for (let i = 0; i < path.length - 3; i++)
			expect(walkHeading(i ? path[i - 1] : origin, path, i, previous)).toBe(
				"away",
			);
	});
	it("uses separate enter and exit thresholds around diagonals", () => {
		expect(walkHeading(origin, [{ x: 100, y: -100 }], 0, "right")).toBe(
			"right",
		);
		expect(walkHeading(origin, [{ x: 100, y: -100 }], 0, "away")).toBe("away");
		expect(walkHeading(origin, [{ x: 100, y: -120 }], 0, "right")).toBe("away");
		expect(walkHeading(origin, [{ x: 100, y: -70 }], 0, "away")).toBe("right");
	});
	it("holds facing for empty paths and tiny final grid steps", () => {
		expect(walkHeading(origin, [], 0, "toward")).toBe("toward");
		expect(walkHeading(origin, [{ x: 8, y: 0 }], 0, "away")).toBe("away");
	});
	it("reverses depth heading and ignores duplicate points", () => {
		expect(walkHeading(origin, [origin, { x: 0, y: 100 }], 0, "away")).toBe(
			"toward",
		);
	});
	it("keeps cadence proportional to scale and actual movement", () => {
		expect(walkPlaybackRate(300, 0.5, 600)).toBe(1);
		expect(walkPlaybackRate(60, 0.1, 600)).toBe(1);
		expect(walkPlaybackRate(30, 0.1, 600)).toBe(0.5);
		expect(walkPlaybackRate(0, 0.1, 600)).toBe(0);
	});
});

import { groundPathHeading, headingFromGround } from "./walkHeading";

describe("ground heading", () => {
	it("selects all eight sectors", () => {
		for (const [x, z, direction] of [
			[1, 0, "right"],
			[1, 1, "away-right"],
			[0, 1, "away"],
			[-1, 1, "away-left"],
			[-1, 0, "left"],
			[-1, -1, "toward-left"],
			[0, -1, "toward"],
			[1, -1, "toward-right"],
		] as const)
			expect(headingFromGround(x, z)).toBe(direction);
	});
	it("measures directions relative to the local view ray", () => {
		expect(headingFromGround(1, 1, "left", { x: 5, y: 5 })).toBe("away");
		expect(headingFromGround(1, -1, "left", { x: 5, y: 5 })).toBe("right");
		expect(headingFromGround(-1, 1, "right", { x: -5, y: 5 })).toBe("away");
	});
	it("uses five degrees of hysteresis across sector boundaries", () => {
		const at = (degrees: number, old: "right" | "away-right") =>
			headingFromGround(
				Math.cos((degrees * Math.PI) / 180),
				Math.sin((degrees * Math.PI) / 180),
				old,
			);
		expect(at(24, "right")).toBe("right");
		expect(at(24, "away-right")).toBe("away-right");
		expect(at(29, "right")).toBe("away-right");
		expect(at(15, "away-right")).toBe("right");
	});
	it("retains heading at arrival", () => {
		expect(headingFromGround(0, 0, "toward-left")).toBe("toward-left");
		expect(
			groundPathHeading({ x: 0, y: 1 }, [{ x: 0.01, y: 1 }], 0, "away"),
		).toBe("away");
	});
});
