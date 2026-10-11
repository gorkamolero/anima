import { describe, expect, it } from "vitest";
import { REVIEW_SCENES } from "../../../../adventures/shadow-over-innsmouth/src/game/scenes/standaloneScenes";
import {
	fitFromLine,
	fromGround,
	fromMetres,
	scaleAt,
	toGround,
	toMetres,
} from "./perspective";

describe("perspective", () => {
	for (const scene of Object.values(REVIEW_SCENES))
		it(`preserves ${scene.id} authored calibration`, () => {
			const p = fitFromLine(
				scene.groundLine.points,
				scene.id === "outside" ? 470 : undefined,
			);
			for (const point of scene.groundLine.points)
				expect(scaleAt(p, point)).toBeCloseTo(point.scaleFactor ?? 1, 10);
		});
	it("round trips screen, projective and metric coordinates", () => {
		const p = { horizonY: 470, slope: 0.002 };
		for (const point of [
			{ x: 20, y: 500 },
			{ x: 1700, y: 940 },
		]) {
			expect(fromGround(p, toGround(p, point))).toEqual(point);
			expect(fromMetres(p, toMetres(p, point)).x).toBeCloseTo(point.x, 10);
		}
		expect(scaleAt(p, { x: 960, y: 471 }, { min: 0.15, max: 1.5 })).toBe(0.15);
	});
});
