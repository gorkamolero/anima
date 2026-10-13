import { describe, expect, it } from "vitest";
import { headingFromGround } from "./walkHeading";

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
	});
});
