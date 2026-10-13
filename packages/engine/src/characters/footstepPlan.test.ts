import { describe, expect, it } from "vitest";
import { findPath } from "../walkarea/navigation";
import type { Point } from "../walkarea/perspective";
import {
	planFootsteps,
	type SearchOptions,
	type WalkLeg,
} from "./footstepPlan";
import { GROUND_SECTORS } from "./walkHeading";

type State = Point & { foot: "L" | "R" };
function search(
	target: Point,
	stride = 0.3,
	safe: (p: Point) => boolean = () => true,
	options: SearchOptions = {},
	restSafe = safe,
) {
	const start: State = { x: 0, y: 0, foot: "L" };
	const legs: WalkLeg[] = [
		{ from: start, to: target, heading: "right", corner: false },
	];
	return planFootsteps(
		legs,
		start,
		{
			position: (s) => s,
			support: (s) => s.foot,
			entry: (_s, h) => h,
			advance: (s, h) => {
				const a = (GROUND_SECTORS.indexOf(h) * Math.PI) / 4;
				const next: State = {
					x: s.x + stride * Math.cos(a),
					y: s.y + stride * Math.sin(a),
					foot: s.foot === "L" ? "R" : "L",
				};
				// Swept body footprint, including the initial and landing configurations.
				for (let i = 0; i <= 20; i++)
					if (
						!safe({
							x: s.x + ((next.x - s.x) * i) / 20,
							y: s.y + ((next.y - s.y) * i) / 20,
						})
					)
						return;
				return next;
			},
			rest: (s) => (restSafe(s) ? s : undefined),
		},
		{ maxStride: stride, nodeBudget: 50000, timeBudgetMs: 1000, ...options },
	);
}
function changes(result: ReturnType<typeof search>) {
	return result.steps.filter(
		(s, i) => i > 0 && s.heading !== result.steps[i - 1].heading,
	);
}
function noReversals(result: ReturnType<typeof search>) {
	for (let i = 1; i < result.steps.length; i++) {
		const turn = Math.abs(
			GROUND_SECTORS.indexOf(result.steps[i].heading) -
				GROUND_SECTORS.indexOf(result.steps[i - 1].heading),
		);
		expect(Math.min(turn, 8 - turn)).toBeLessThanOrEqual(2);
	}
}
describe("state-lattice A*", () => {
	for (const depth of ["near", "far"] as const)
		for (const angle of [0, 20, 45, 70, 90]) {
			it(`${angle} degrees at ${depth} depth reaches half a stride with at most two changes`, () => {
				const a = (angle * Math.PI) / 180,
					stride = depth === "near" ? 0.32 : 0.21;
				const result = search(
					{ x: 3 * Math.cos(a), y: 3 * Math.sin(a) },
					stride,
				);
				expect(result.complete).toBe(true);
				expect(result.distance).toBeLessThanOrEqual(stride / 2 + 1e-8);
				expect(changes(result).length).toBeLessThanOrEqual(2);
				noReversals(result);
				expect(
					result.steps.every((s) => s.slide.x === 0 && s.slide.y === 0),
				).toBe(true);
			});
		}
	it("takes one corner through an L corridor", () => {
		const safe = (p: Point) =>
			p.x >= -0.2 &&
			p.x <= 3.2 &&
			p.y >= -0.2 &&
			p.y <= 3.2 &&
			(p.y <= 0.2 || p.x >= 2.8);
		const result = search({ x: 3, y: 3 }, 0.3, safe);
		expect(result.complete).toBe(true);
		expect(changes(result).length).toBeLessThanOrEqual(2);
		noReversals(result);
	});
	it("goes around a pillar without crossing its swept footprint", () => {
		const safe = (p: Point) =>
			p.x >= -0.2 &&
			p.x <= 4.2 &&
			Math.abs(p.y) <= 1.5 &&
			!(p.x > 1.3 && p.x < 2.7 && Math.abs(p.y) < 0.5);
		const result = search({ x: 4, y: 0 }, 0.3, safe);
		expect(result.complete).toBe(true);
		expect(result.steps.every((s) => safe(s.state))).toBe(true);
		noReversals(result);
	});
	for (const gap of [0.5, 0.2])
		it(`a ${gap} m gap respects the 0.3 m body diameter`, () => {
			const safe = (p: Point) =>
				Math.abs(p.y) < 1 &&
				p.x >= -0.2 &&
				p.x <= 3.2 &&
				(!(p.x > 1.2 && p.x < 1.8) || Math.abs(p.y) + 0.15 <= gap / 2);
			const result = search({ x: 3, y: 0 }, 0.3, safe);
			expect(result.complete).toBe(gap > 0.3);
			noReversals(result);
		});
	it("projects an unreachable click to the starting floor component before search", () => {
		const mask = {
			width: 192,
			height: 108,
			data: Array.from({ length: 192 * 108 }, (_, i) =>
				i % 192 < 15 && Math.floor(i / 192) === 5 ? 1 : 0,
			),
		};
		const path = findPath(mask, { x: 5, y: 55 }, { x: 500, y: 55 });
		expect(path[path.length - 1]?.x).toBe(145);
		const result = search(
			{ x: 1.4, y: 0 },
			0.2,
			(p) => p.x <= 1.45 && Math.abs(p.y) < 0.1,
		);
		expect(result.complete).toBe(true);
	});
	it("requires room for the settle and reports a blocked stop as partial", () => {
		const result = search(
			{ x: 3, y: 0 },
			0.3,
			(p) => p.x >= 0 && p.x <= 3 && Math.abs(p.y) < 0.1,
			{},
			(p) => p.x + 0.2 <= 3,
		);
		expect(result.complete).toBe(false);
		expect(result.distance).toBeCloseTo(0.3);
		expect(result.steps[result.steps.length - 1]?.stop).toBe(true);
	});
	it("returns a safe partial plan at the node budget and reports it", () => {
		const result = search({ x: 10, y: 0 }, 0.3, () => true, { nodeBudget: 10 });
		expect(result.complete).toBe(false);
		expect(result.stats.reason).toBe("node-budget");
		expect(result.stats.expanded).toBe(10);
		expect(result.steps[result.steps.length - 1]?.stop).toBe(true);
		noReversals(result);
	});
	it("obeys the time budget with a deterministic clock", () => {
		let clock = 0;
		const result = search({ x: 10, y: 0 }, 0.3, () => true, {
			timeBudgetMs: 5,
			now: () => clock++,
		});
		expect(result.stats.reason).toBe("time-budget");
		expect(result.stats.expanded).toBeLessThanOrEqual(5);
	});
});
