import { describe, expect, it } from "vitest";
import { planFootsteps, type SearchOptions } from "../../phaser/footstepPlan";
import { findPath } from "../walkarea/navigation";
import type { Point } from "../walkarea/perspective";
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

it("rounds adjacent compatible route bends within the same stride", () => {
	const route: (typeof GROUND_SECTORS)[number][] = [
		"right",
		"away",
		"away",
		"left",
		"left",
		"toward",
		"toward",
		"right",
		"right",
		"away",
		"away",
		"left",
	];
	expect(
		forcedRoute(route, {
			routeCorners: [
				{ x: 1, y: 0 },
				{ x: 1.05, y: 0 },
			],
			cornerHeadings: ["away", "away"],
			cornerRadius: 0.1,
		}).complete,
	).toBe(true);
	expect(
		forcedRoute(route, {
			routeCorners: [
				{ x: 1, y: 0 },
				{ x: 1.05, y: 0 },
			],
			cornerHeadings: ["away", "toward"],
			cornerRadius: 0.1,
		}).complete,
	).toBe(false);
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

it("goal-biased ordering preserves the cost and route constraints", () => {
	const result = search({ x: 3, y: 0.9 }, 0.3, () => true, {
		searchWeight: 4,
		stopWeight: 128,
		maxHeadingChanges: 2,
		minHeadingRun: 2,
		nodeBudget: 1000,
		now: () => 0,
	});
	expect(result.complete).toBe(true);
	expect(changes(result).length).toBeLessThanOrEqual(2);
	noReversals(result);
	expect(result.stats.optimal).toBe(false);
	expect(result.stats.expanded).toBeLessThanOrEqual(1000);
});

it("considers an exit phase even when it cannot advance a complete stride", () => {
	const advanced: string[] = [];
	const result = planFootsteps(
		{ x: 1, y: 0 },
		{ x: 0, y: 0 },
		{
			position: (s) => s,
			entry: (_s, h) => (h === "right" ? "stride" : undefined),
			entries: (_s, h, _starting, stopping) =>
				h === "right" ? [stopping ? "exit-only" : "stride"] : [],
			advance: (s, pose) => {
				advanced.push(pose);
				return { x: s.x + 0.6, y: 0 };
			},
			rest: (_s, pose) => (pose === "exit-only" ? { x: 1, y: 0 } : undefined),
		},
		{ now: () => 0, stopPhases: true },
	);
	expect(result.complete).toBe(true);
	expect(result.distance).toBe(0);
	expect(result.steps[result.steps.length - 1]?.pose).toBe("exit-only");
	expect(advanced).not.toContain("exit-only");
});

it("uses the authored arrival test when a full next stride is blocked", () => {
	const result = planFootsteps(
		{ x: 1, y: 0 },
		{ x: 0.85, y: 0 },
		{
			position: (s) => s,
			entry: (_s, h) => (h === "right" ? h : undefined),
			advance: () => undefined,
			rest: (s) => s,
			acceptRest: (_s, _pose, rest, target) =>
				Math.hypot(rest.x - target.x, rest.y - target.y) <= 0.2,
		},
		{ now: () => 0 },
	);
	expect(result.complete).toBe(true);
	expect(result.distance).toBeCloseTo(0.15);
});

it.each([
	"away",
	"left",
] as const)("finishes with a planted %s pivot without another walking turn or changing the stride heading", (finishHeading) => {
	const finish = (travel: number) =>
		planFootsteps(
			{ x: 3, y: 0 },
			{ x: 0, y: 0 },
			{
				position: (s) => s,
				entry: (_s, h) => (h === "right" ? h : undefined),
				entries: (_s, h, _starting, stopping) =>
					h === "right" || (stopping && h === finishHeading) ? [h] : [],
				advance: (s, h) => (h === "right" ? { x: s.x + 1, y: 0 } : undefined),
				rest: (s, h) =>
					h === finishHeading && s.x === 3 ? { ...s, travel } : undefined,
				acceptRest: (_s, _pose, rest, target, heading) =>
					heading === "right" && rest.x === target.x,
			},
			{ now: () => 0, maxHeadingChanges: 0, pivotStops: true },
		);
	const result = finish(0);
	expect(result.complete).toBe(true);
	expect(
		result.steps.filter((s) => !s.stop).every((s) => s.heading === "right"),
	).toBe(true);
	expect(result.steps[result.steps.length - 1]).toMatchObject({
		stop: true,
		heading: finishHeading,
		arrivalHeading: "right",
	});
	expect(finish(0.1).complete).toBe(false);
});

it("funds a necessary detour without relaxing the heading-change limit", () => {
	const points = [
		{ x: 0, y: 0 },
		{ x: 0, y: 1 },
		{ x: 0, y: 2 },
		{ x: 1, y: 2 },
		{ x: 2, y: 2 },
		{ x: 2, y: 1 },
		{ x: 2, y: 0 },
	];
	const headings = [
		"away",
		"away",
		"right",
		"right",
		"toward",
		"toward",
		"toward",
	] as const;
	const run = (options: SearchOptions) =>
		planFootsteps(
			points[6],
			0,
			{
				position: (i) => points[i],
				entry: (i, h) => (h === headings[i] ? h : undefined),
				advance: (i) => (i < 6 ? i + 1 : undefined),
				rest: (i) => (i === 6 ? points[i] : undefined),
			},
			{
				now: () => 0,
				turnCost: 0,
				stepCost: 0,
				maxStride: 1,
				maxHeadingChanges: 2,
				minHeadingRun: 2,
				...options,
			},
		);
	expect(run({}).complete).toBe(false);
	expect(run({ costScale: 2 }).complete).toBe(true);
	expect(run({ costScale: 2, maxHeadingChanges: 1 }).complete).toBe(false);
	expect(run({ costScale: 2, costBound: 4 }).complete).toBe(false);
});

it("keeps a stationary fallback without pruning a valid moving arrival", () => {
	const result = search({ x: 0.1, y: 0 }, 0.2, () => true, {
		preferMotion: true,
	});
	expect(result.complete).toBe(true);
	expect(result.steps.some((s) => !s.stop)).toBe(true);
	const blocked = search({ x: 0, y: 0 }, 0.2, (p) => p.x === 0 && p.y === 0, {
		preferMotion: true,
	});
	expect(blocked.complete).toBe(true);
	expect(blocked.steps.every((s) => s.stop)).toBe(true);
});

it("crosses a support reset as an edge of one search while preserving route state", () => {
	type S = Point & { reset: boolean };
	const result = planFootsteps(
		{ x: 0.6, y: 0 },
		{ x: 0, y: 0, reset: true } as S,
		{
			position: (s) => s,
			support: (s) => String(s.reset),
			entry: (_s, h) => (h === "right" ? h : undefined),
			advance: (s) =>
				s.reset && s.x < 0.6 ? { x: s.x + 0.3, y: 0, reset: false } : undefined,
			rest: (s) => s,
			restCandidates: () => {
				throw new Error("Terminal bound cannot prune a restart");
			},
			continueFromRest: (s) => (s.reset ? [] : [{ ...s, reset: true }]),
		},
		{
			now: () => 0,
			maxStride: 0.3,
			nodeBudget: 100,
			minHeadingRun: 2,
			maxHeadingChanges: 0,
		},
	);
	expect(result.complete).toBe(true);
	expect(result.steps.filter((s) => !s.stop)).toHaveLength(2);
	expect(result.steps.filter((s) => s.stop)).toHaveLength(2);
	expect(result.routeState?.changes).toBe(0);
});

it("does not count a held support twice across an interior settle", () => {
	type S = Point & { stage: number };
	const state = (stage: number): S => ({ x: stage, y: 0, stage });
	const result = planFootsteps<S, (typeof GROUND_SECTORS)[number]>(
		{ x: 5, y: 0 },
		state(0),
		{
			position: (s) => s,
			support: (s) => String(s.stage),
			entry: (_s, h) => h,
			advance: (s, h) => {
				if (s.stage === 0 && h === "right") return state(1);
				if (s.stage === 1 && h === "away") return state(2);
				if (s.stage === 2.5 && h === "away") return state(3);
				if (s.stage === 3 && h === "away") return state(4);
				if ((s.stage === 3 || s.stage === 4) && h === "left") return state(5);
			},
			countStance: (s) => s.stage !== 1,
			stanceKey: (s, _p, h) =>
				s.stage === 2.5 ? "away:held" : `${h}:${s.stage}`,
			rest: (s, _p, h) =>
				s.stage === 2 && h === "away"
					? { ...s, supports: [{ key: "away:held", counted: true }] }
					: s.stage === 5
						? s
						: undefined,
			continueFromRest: (s) => (s.stage === 2 ? [state(2.5)] : []),
		},
		{
			now: () => 0,
			nodeBudget: 200,
			costBound: 100,
			maxStride: 0.1,
			minHeadingRun: 2,
			maxHeadingChanges: 2,
		},
	);
	expect(result.complete).toBe(true);
	expect(result.steps.find((s) => s.heading === "left")?.state.stage).toBe(4);
});

it("retains the captured start's turn budget throughout the search", () => {
	const headings = [
		"right",
		"away",
		"away",
		"left",
		"left",
		"toward",
		"toward",
	] as const;
	const run = (limit: number) =>
		planFootsteps<number, (typeof headings)[number]>(
			{ x: 6, y: 0 },
			0,
			{
				position: (n) => ({ x: n, y: 0 }),
				startTurnLimit: () => limit,
				entry: (n, h) => (h === headings[n] ? h : undefined),
				advance: (n) => (n < 6 ? n + 1 : undefined),
				rest: (n) => (n === 6 ? { x: n, y: 0 } : undefined),
			},
			{
				now: () => 0,
				maxHeadingChanges: 4,
				minHeadingRun: 2,
				costBound: 100,
				nodeBudget: 100,
			},
		);
	expect(run(4).complete).toBe(true);
	expect(run(2).complete).toBe(false);
	expect(run(2).stats.rejections?.["search:turn-limit"]).toBeGreaterThan(0);
});

it("does not let a closer partial stop prune a valid arrival with a wider tolerance", () => {
	const points = [
		{ x: 0, y: 0 },
		{ x: 0.9, y: 0 },
		{ x: 0, y: 2 },
		{ x: 0.7, y: 0 },
	];
	const result = planFootsteps<number, (typeof GROUND_SECTORS)[number]>(
		{ x: 1, y: 0 },
		0,
		{
			position: (n) => points[n],
			entry: (_n, h) => h,
			advance: (n, h) =>
				n === 0 && h === "right"
					? 1
					: n === 0 && h === "away"
						? 2
						: n === 2 && h === "right"
							? 3
							: undefined,
			rest: (n) => (n === 1 || n === 3 ? points[n] : undefined),
			acceptRest: (n) => n === 3,
		},
		{
			now: () => 0,
			firstArrival: true,
			searchWeight: 4,
			stopWeight: 1,
			turnCost: 0,
			stepCost: 0,
			costBound: 10,
			nodeBudget: 50,
		},
	);
	expect(result.complete).toBe(true);
	expect(result.steps.at(-1)?.state).toBe(3);
});

it("can require sustained first and last runs for continuing walks", () => {
	const headings = ["right", "away", "away"] as const;
	const run = (options: SearchOptions) =>
		planFootsteps<number, (typeof headings)[number]>(
			{ x: 2, y: 0 },
			0,
			{
				position: (n) => ({ x: n, y: 0 }),
				entry: (n, h) => (h === headings[n] ? h : undefined),
				advance: (n) => (n < 2 ? n + 1 : undefined),
				rest: (n) => (n === 2 ? { x: n, y: 0 } : undefined),
			},
			{ now: () => 0, costBound: 20, nodeBudget: 50, ...options },
		);
	expect(run({}).complete).toBe(true);
	expect(run({ minFirstHeadingRun: 2 }).complete).toBe(false);
	expect(run({ minTerminalRun: 2 }).complete).toBe(false);
});

it("rejects an invalid captured start while retaining an alternative entry", () => {
	const points = [
		{ x: 0, y: 0 },
		{ x: 1, y: 0 },
		{ x: 0, y: 1 },
		{ x: 1, y: 0 },
	];
	const result = planFootsteps<number, (typeof GROUND_SECTORS)[number]>(
		points[1],
		0,
		{
			position: (n) => points[n],
			entry: (_n, h) => h,
			startTurnLimit: (_n, _pose, h) => (h === "right" ? -1 : 2),
			advance: (n, h) =>
				n === 0 && h === "right"
					? 1
					: n === 0 && h === "away"
						? 2
						: n === 2 && h === "right"
							? 3
							: undefined,
			rest: (n) => (n === 1 || n === 3 ? points[n] : undefined),
		},
		{ now: () => 0, costBound: 10, nodeBudget: 50 },
	);
	expect(result.complete).toBe(true);
	expect(result.steps[0].heading).toBe("away");
	expect(result.steps.at(-1)?.state).toBe(3);
	expect(result.stats.rejections?.["search:start-turn-limit"]).toBeGreaterThan(
		0,
	);
});

it("keeps feasible arrivals whose heading differs from the target preference", () => {
	const result = planFootsteps<number, string>(
		{ x: 2, y: 0 },
		0,
		{
			position: (n) => ({ x: n, y: 0 }),
			entry: (_n, heading) => (heading === "right" ? heading : undefined),
			advance: (n) => (n < 2 ? n + 1 : undefined),
			rest: (n) => (n === 2 ? { x: n, y: 0 } : undefined),
		},
		{
			now: () => 0,
			firstArrival: true,
			searchWeight: 4,
			goalHeadings: ["left"],
			costBound: 20,
			nodeBudget: 50,
		},
	);
	expect(result.complete).toBe(true);
	expect(result.steps.at(-1)?.state).toBe(2);
});

it("preserves walking runs across a settling turn while counting both drawn turns", () => {
	const run = (limit: number, resume: "right" | "toward" = "right") =>
		planFootsteps<number, (typeof GROUND_SECTORS)[number]>(
			{ x: 2, y: 0 },
			0,
			{
				position: (s) => ({ x: s === 2 ? 1 : s === 3 ? 2 : s, y: 0 }),
				support: (s) => String(s),
				entry: (_s, h) => h,
				advance: (s, h) =>
					s === 0 && h === "right"
						? 1
						: s === 2 && h === resume
							? 3
							: undefined,
				rest: (s, _p, h) =>
					s === 1 && h === "away"
						? { x: 1, y: 0, stances: 0 }
						: s === 3 && h === resume
							? { x: 2, y: 0 }
							: undefined,
				continueFromRest: (s) => (s === 1 ? [2] : []),
			},
			{
				now: () => 0,
				minHeadingRun: 2,
				minRestartRun: 1,
				maxHeadingChanges: limit,
				costBound: 20,
				nodeBudget: 100,
				maxStride: 0.1,
			},
		);
	expect(run(2).complete).toBe(true);
	expect(run(2).routeState?.changes).toBe(2);
	expect(run(1).complete).toBe(false);
	expect(run(3, "toward").complete).toBe(false);
});

it("evaluates each stop once while retaining stop-only phases", () => {
	const stopped: string[] = [];
	planFootsteps(
		{ x: 2, y: 0 },
		{ x: 0, y: 0 },
		{
			position: (s) => s,
			entry: () => undefined,
			entries: (_s, h, _starting, stopping) =>
				h === "right" ? (stopping ? ["walk", "stop-only"] : ["walk"]) : [],
			advance: () => undefined,
			rest: (_s, pose) => {
				stopped.push(pose);
				return undefined;
			},
		},
		{ now: () => 0, stopPhases: true, nodeBudget: 1 },
	);
	expect(stopped).toEqual(["walk", "stop-only"]);
});

it("ranks complete finishes without changing the route to the first arrival", () => {
	const run = (rank: boolean) =>
		planFootsteps(
			{ x: 2, y: 0 },
			{ x: 0, y: 0 },
			{
				position: (s) => s,
				entry: () => undefined,
				entries: (_s, h) => (h === "right" ? ["jump", "smooth"] : []),
				advance: (s) => (s.x < 2 ? { x: s.x + 1, y: 0 } : undefined),
				rest: (s) => s,
				acceptRest: (s) => s.x === 2,
				finishRank: rank
					? (steps) => (steps.at(-1)?.pose === "smooth" ? 0 : 10)
					: undefined,
			},
			{
				now: () => 0,
				firstArrival: true,
				maxStride: 1,
				costBound: 20,
				nodeBudget: 100,
				turnCost: 0,
			},
		);
	const original = run(false),
		ranked = run(true);
	expect(original.complete).toBe(true);
	expect(ranked.complete).toBe(true);
	expect(original.steps.at(-1)?.pose).toBe("jump");
	expect(ranked.steps.at(-1)?.pose).toBe("smooth");
	expect(ranked.steps.slice(0, -1)).toEqual(original.steps.slice(0, -1));
	expect(ranked.stats.expanded).toBe(original.stats.expanded);
});

it("gives alternate starts a chance before a cheap dead end spends the boundary budget", () => {
	const run = (layeredFrontier: boolean) =>
		planFootsteps(
			{ x: 10, y: 0 },
			{ x: 8, y: 0, lane: "dead-end" },
			{
				position: (s) => s,
				support: (s) => s.lane,
				starts: () => [{ x: 0, y: 0, lane: "arrival" }],
				entry: (_s, h) => (h === "right" ? h : undefined),
				advance: (s) => ({ ...s, x: s.x + (s.lane === "arrival" ? 5 : 0.01) }),
				rest: (s) => s,
				acceptRest: (s) => s.lane === "arrival" && s.x === 10,
			},
			{
				now: () => 0,
				firstArrival: true,
				preferMotion: true,
				searchWeight: 3,
				layeredFrontier,
				resolution: 0.001,
				nodeBudget: 8,
				costBound: 50,
			},
		);
	expect(run(false).complete).toBe(false);
	const result = run(true);
	expect(result.complete).toBe(true);
	expect(result.stats.expanded).toBeLessThanOrEqual(8);
	expect(result.steps.every((step) => step.state.lane === "arrival")).toBe(
		true,
	);
});

it("prefers a valid partial walk over an arrival made only by a stationary finish", () => {
	const result = planFootsteps(
		{ x: 1, y: 0 },
		{ x: 0, y: 0 },
		{
			position: (s) => s,
			entry: (_s, h) => (h === "right" ? h : undefined),
			advance: (s) => (s.x < 0.6 ? { x: s.x + 0.3, y: 0 } : undefined),
			rest: (s) => (s.x === 0 ? { x: 1, y: 0 } : s),
			acceptPlan: (steps) => steps.some((step) => !step.stop),
		},
		{
			preferMotion: true,
			maxStride: 0.2,
			resolution: 0.001,
			costBound: 10,
			nodeBudget: 20,
		},
	);
	expect(result.steps.some((step) => !step.stop)).toBe(true);
	expect(result.complete).toBe(false);
	expect(result.steps.at(-1)?.state.x).toBeCloseTo(0.6);
});
