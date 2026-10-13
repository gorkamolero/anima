import { describe, expect, it } from "vitest";
import { findPath } from "../walkarea/navigation";
import type { Point } from "../walkarea/perspective";
import { planFootsteps, type SearchOptions } from "./footstepPlan";
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
	return planFootsteps(
		target,
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

it("searches both grounded starting supports even when the first has a safe partial stop", () => {
	const initial: State = { x: 0, y: 0, foot: "L" };
	const result = planFootsteps(
		{ x: 2, y: 0 },
		initial,
		{
			position: (s) => s,
			support: (s) => s.foot,
			starts: (s): State[] => [{ ...s, foot: "R" }],
			entry: (_s, h) => (h === "right" ? h : undefined),
			advance: (s) =>
				s.foot === "L"
					? s.x === 0
						? { ...s, x: 0.1 }
						: undefined
					: { ...s, x: s.x + 0.25 },
			rest: (s) => s,
		},
		{ timeBudgetMs: 1000, maxStride: 0.25 },
	);
	expect(result.complete).toBe(true);
	expect(result.steps[0].state.foot).toBe("R");
	expect(result.distance).toBe(0);
});

for (const allowSlide of [true, false])
	it(`keeps an off-lattice stop unmodified even with offset support (${allowSlide})`, () => {
		const result = planFootsteps(
			{ x: 110, y: 6 },
			{ x: 0, y: 0 },
			{
				position: (s) => s,
				ground: (p) => ({ x: p.x / 100, y: p.y / 100 }),
				offset: (s, d) => ({ x: s.x + d.x, y: s.y + d.y }),
				entry: (_s, h) => (h === "right" ? h : undefined),
				advance: (s) =>
					s.x >= 160 || (!allowSlide && s.y !== 0)
						? undefined
						: { ...s, x: s.x + 20 },
				rest: (s) => (allowSlide || s.y === 0 ? s : undefined),
			},
			{ timeBudgetMs: 1000, maxStride: 0.2 },
		);
		expect(result.complete).toBe(false);
		expect(result.stats.reason).toBe("nearest-reachable");
		expect(result.stats.optimal).toBe(true);
		expect(result.steps.every((s) => s.heading === "right")).toBe(true);
		expect(
			result.steps.every(
				(s) => Math.hypot(s.slide.x, s.slide.y) <= 0.99 + 1e-9,
			),
		).toBe(true);
		expect(result.steps.every((s) => s.slide.x === 0 && s.slide.y === 0)).toBe(
			true,
		);
	});

it.each([
	0.2, 0.3, 0.45,
])("a zero-corner walk at stride %s never weaves", (stride) => {
	const result = search({ x: 3, y: 0 }, stride, () => true, {
		maxHeadingChanges: 1,
		minHeadingRun: 2,
		turnCost: 1.2,
	});
	expect(result.complete).toBe(true);
	expect(result.stats.reason).toBe("complete");
	expect(changes(result).length).toBeLessThanOrEqual(1);
});

it("always returns the standing stop when no action is reachable", () => {
	const result = search({ x: 3, y: 0 }, 0.3, (p) => p.x === 0 && p.y === 0);
	expect(result.steps).toEqual([]);
	expect(result.distance).toBe(3);
	expect(result.arrivalKind).toBe("nearest-reachable");
	expect(result.stats.optimal).toBe(true);
});

// A turn preference must not make a short, physically reachable corridor disappear.
it("budgets the default search for a high-penalty corner", () => {
	const safe = (p: Point) =>
		p.x >= -0.1 &&
		p.x <= 1.3 &&
		p.y >= -0.1 &&
		p.y <= 1.3 &&
		(p.y <= 0.1 || p.x >= 1.1);
	const result = search({ x: 1.2, y: 1.2 }, 0.3, safe, {
		turnCost: 1.2,
		maxHeadingChanges: 1,
	});
	expect(result.complete).toBe(true);
	expect(result.distance).toBeLessThanOrEqual(0.15);
});

it("scores a partial rest by the route around an obstacle, while arrival stays geometric", () => {
	const result = planFootsteps(
		{ x: 1, y: 0 },
		{ x: 0, y: 0 },
		{
			position: (s) => s,
			remaining: (p) => (p.x === 0.8 ? 5 : p.y === 1 ? 0.4 : 2),
			entry: (_s, heading) => heading,
			advance: (s, heading) => {
				if (s.x || s.y) return undefined;
				if (heading === "right") return { x: 0.8, y: 0 };
				if (heading === "away") return { x: 0, y: 1 };
				return undefined;
			},
			rest: (s) => s,
		},
		{ turnCost: 0, costBound: 10 },
	);
	expect(result.steps[result.steps.length - 1]?.state).toEqual({ x: 0, y: 1 });
	expect(result.complete).toBe(false);
	expect(result.distance).toBeCloseTo(Math.SQRT2);
	expect(result.stats.optimal).toBe(false);
});

/** A single available route exposes rule violations without cost preferences hiding them. */
function forcedRoute(
	headings: (typeof GROUND_SECTORS)[number][],
	options: SearchOptions = {},
) {
	return planFootsteps(
		{ x: headings.length, y: 0 },
		{ x: 0, y: 0 },
		{
			position: (s) => s,
			entry: (s, h) => (h === headings[s.x] ? h : undefined),
			advance: (s) => ({ x: s.x + 1, y: 0 }),
			rest: (s) =>
				s.x === headings.length - 1 ? { x: headings.length, y: 0 } : undefined,
		},
		{
			now: () => 0,
			costBound: 100,
			maxStride: 1,
			turnCost: 0,
			minHeadingRun: 2,
			routeCorners: [],
			...options,
		},
	);
}
it("rejects a one-stance middle run in search, including before the stop edge", () => {
	const result = forcedRoute(["right", "away-right", "away"]);
	expect(result.steps).toEqual([]);
	expect(result.stats.rejections?.["search:min-heading-run"]).toBeGreaterThan(
		0,
	);
	expect(
		forcedRoute(["right", "away-right", "away-right", "away"]).complete,
	).toBe(true);
});
it("bounds accumulated turns even when each consecutive turn is legal", () => {
	const result = forcedRoute([
		"right",
		"away-right",
		"away-right",
		"away",
		"away",
		"away-left",
	]);
	expect(result.steps).toEqual([]);
	expect(result.stats.rejections?.["search:turn-limit"]).toBeGreaterThan(0);
});
it("releases extra heading changes only near a route corner, once", () => {
	const route: (typeof GROUND_SECTORS)[number][] = [
		"right",
		"away",
		"away",
		"left",
		"left",
		"toward",
	];
	expect(
		forcedRoute(route, { routeCorners: [{ x: 3, y: 0 }], cornerRadius: 0.1 })
			.complete,
	).toBe(true);
	expect(
		forcedRoute(route, { routeCorners: [{ x: 30, y: 0 }], cornerRadius: 0.1 })
			.complete,
	).toBe(false);
	expect(
		forcedRoute([...route, "toward", "right", "right", "away"], {
			routeCorners: [{ x: 3, y: 0 }],
			cornerRadius: 10,
		}).complete,
	).toBe(false);
});
it("applies the heading-change budget to the complete plan including the stop edge", () => {
	const route: (typeof GROUND_SECTORS)[number][] = [
		"right",
		"away-right",
		"away-right",
		"away",
		"away",
		"away-right",
	];
	expect(forcedRoute(route, { maxHeadingChanges: 2 }).complete).toBe(false);
	expect(
		forcedRoute(route, {
			maxHeadingChanges: 4,
			routeCorners: [{ x: 5, y: 0 }],
			cornerRadius: 0.1,
		}).complete,
	).toBe(true);
});
it("offers standing pivots only before the first stance", () => {
	const startingFlags: boolean[] = [];
	let starts = 0;
	const result = planFootsteps(
		{ x: 3, y: 0 },
		{ x: 0, y: 0 },
		{
			position: (s) => s,
			starts: (s) => {
				starts++;
				return [{ ...s, y: 0.01 }];
			},
			entry: (_s, h, starting) => {
				startingFlags.push(starting);
				return h === "right" ? h : undefined;
			},
			advance: (s) => ({ ...s, x: s.x + 0.3 }),
			rest: (s) => s,
		},
		{ now: () => 0 },
	);
	expect(result.complete).toBe(true);
	expect(starts).toBe(1);
	expect(startingFlags).toContain(false);
});

it("searches alternative entry phases when the first valid phase leads to a dead end", () => {
	const result = planFootsteps(
		{ x: 2, y: 0 },
		{ x: 0, y: 0, phase: "full" },
		{
			position: (s) => s,
			support: (s) => s.phase,
			entry: (_s, h) => (h === "right" ? "short" : undefined),
			entries: (s, h, starting) =>
				h === "right" ? (starting ? ["short", "full"] : [s.phase]) : [],
			advance: (s, p) =>
				p === "short"
					? s.x === 0
						? { ...s, x: 0.1, phase: p }
						: undefined
					: { ...s, x: s.x + 0.25, phase: p },
			rest: (s) => s,
		},
		{ now: () => 0, maxStride: 0.25 },
	);
	expect(result.complete).toBe(true);
	expect(result.steps[0].pose).toBe("full");
});

it("a grounded restart preserves the previous run and the whole-click turn budget", () => {
	const resume = (
		heading: (typeof GROUND_SECTORS)[number],
		changes: number,
		run: number,
	) => {
		const starting: boolean[] = [];
		const result = planFootsteps(
			{ x: 1, y: 0 },
			{ x: 0, y: 0 },
			{
				position: (s) => s,
				entry: (_s, h, first) => {
					starting.push(first);
					return h === heading ? h : undefined;
				},
				advance: (s) => ({ x: s.x + 0.25, y: 0 }),
				rest: (s) => s,
			},
			{
				now: () => 0,
				maxHeadingChanges: 2,
				minHeadingRun: 2,
				initialRoute: { heading: "right", changes, run, corner: 0, history: 1 },
			},
		);
		return { result, starting };
	};
	expect(resume("left", 0, 4).result.steps).toEqual([]);
	expect(resume("away", 2, 4).result.steps).toEqual([]);
	expect(resume("away", 1, 1).result.steps).toEqual([]);
	const legal = resume("away", 1, 2);
	expect(legal.result.complete).toBe(true);
	expect(legal.result.routeState?.changes).toBe(2);
	expect(legal.starting).toContain(true);
	expect(legal.starting).toContain(false);
});
