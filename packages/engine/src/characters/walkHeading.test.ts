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
	it("maps ground axes and nearest diagonal to the four views", () => {
		expect(headingFromGround(0, 1)).toBe("away");
		expect(headingFromGround(0, -1)).toBe("toward");
		expect(headingFromGround(-1, 0)).toBe("left");
		expect(headingFromGround(1, 0)).toBe("right");
		expect(headingFromGround(0.5, 1)).toBe("away");
		expect(headingFromGround(1, -0.5)).toBe("right");
	});
	it("retains heading at diagonal thresholds and arrival", () => {
		expect(headingFromGround(1, 1, "away")).toBe("away");
		expect(headingFromGround(1, 1, "right")).toBe("right");
		expect(
			groundPathHeading({ x: 0, y: 0 }, [{ x: 0.01, y: 0 }], 0, "away"),
		).toBe("away");
	});
});
