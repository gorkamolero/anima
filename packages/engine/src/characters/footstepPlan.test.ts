import { describe, expect, it } from "vitest";
import { findPath } from "../walkarea/navigation";
import type { Point } from "../walkarea/perspective";
import { planFootsteps, walkLegs } from "./footstepPlan";
import type { WalkDirection } from "./walkHeading";

const perspective = { constant: 1, slope: 0, horizonY: 0 };
const deltas: Record<string, Point> = {
	right: { x: 20, y: 0 },
	left: { x: -20, y: 0 },
	away: { x: 0, y: -20 },
	toward: { x: 0, y: 20 },
};
function plan(path: Point[], safe: (p: Point) => boolean = () => true) {
	return planFootsteps(walkLegs(path, perspective), path[0], {
		position: (p) => p,
		entry: (_p, heading) => heading,
		advance: (p, heading: WalkDirection) => {
			const d = deltas[heading];
			if (!d) return;
			const next = { x: p.x + d.x, y: p.y + d.y };
			return safe(next) ? next : undefined;
		},
		rest: (p) => (safe({ x: p.x + 5, y: p.y }) ? p : undefined),
	});
}
describe("whole-walk footstep planning", () => {
	it("snaps a straight stop to a whole stride without correcting backwards", () => {
		const p = plan([
			{ x: 0, y: 0 },
			{ x: 103, y: 0 },
		]);
		expect(p.distance).toBe(3);
		expect(p.steps[p.steps.length - 1]?.state.x).toBe(100);
		expect(p.steps.every((s) => s.heading === "right")).toBe(true);
	});
	it("changes heading only at the L corner", () => {
		const p = plan([
			{ x: 0, y: 100 },
			{ x: 100, y: 100 },
			{ x: 100, y: 0 },
		]);
		expect(p.distance).toBe(0);
		expect([...new Set(p.steps.map((s) => s.heading))]).toEqual([
			"right",
			"away",
		]);
	});
	it("keeps small bends on one heading", () => {
		const legs = walkLegs(
			[
				{ x: 0, y: 0 },
				{ x: 100, y: 1 },
				{ x: 200, y: 3 },
			],
			perspective,
		);
		expect(legs.every((l) => l.heading === "right" && !l.corner)).toBe(true);
	});
	it("keeps every stride inside a narrow corridor", () => {
		const safe = (p: Point) => p.y >= 40 && p.y <= 60 && p.x <= 150;
		const p = plan(
			[
				{ x: 0, y: 50 },
				{ x: 140, y: 50 },
			],
			safe,
		);
		expect(p.steps.every((s) => safe(s.state))).toBe(true);
		expect(p.distance).toBe(0);
	});
	it("stops one stride early when the final rest sole cannot fit near a wall", () => {
		const p = plan(
			[
				{ x: 0, y: 50 },
				{ x: 100, y: 50 },
			],
			(p) => p.x <= 100,
		);
		expect(p.steps[p.steps.length - 1]?.state.x).toBe(80);
		expect(p.distance).toBe(20);
	});
	it("projects an unreachable target before planning", () => {
		const mask = {
			width: 192,
			height: 108,
			data: Array.from({ length: 192 * 108 }, (_, i) =>
				i % 192 < 15 && Math.floor(i / 192) >= 4 && Math.floor(i / 192) <= 6
					? 1
					: 0,
			),
		};
		const route = findPath(mask, { x: 5, y: 55 }, { x: 500, y: 55 });
		expect(route[route.length - 1]?.x).toBeLessThan(150);
		const p = plan(route, (p) => p.x < 150 && p.y >= 40 && p.y < 70);
		expect(p.steps.length).toBeGreaterThan(1);
		expect(p.steps.every((s) => s.state.x < 150)).toBe(true);
	});
});

it("plans beyond the first safe corner stance before committing a turn", () => {
	const legs = walkLegs(
		[
			{ x: 0, y: 100 },
			{ x: 100, y: 100 },
			{ x: 100, y: 0 },
		],
		perspective,
	);
	const p = planFootsteps(
		legs,
		{ x: 0, y: 100 },
		{
			position: (p) => p,
			entry: (_p, heading) => heading,
			advance: (p, heading) => {
				const d = deltas[heading];
				if (!d) return;
				const next = { x: p.x + d.x, y: p.y + d.y };
				if (next.y < 0 || next.x > 100 || (next.x === 100 && next.y < 80))
					return;
				return next;
			},
			rest: (p) => p,
		},
	);
	expect(p.steps[p.steps.length - 1].state).toEqual({ x: 80, y: 0 });
	expect(p.distance).toBe(20);
});

for (const depth of [100, 600]) {
	for (const angle of [0, 10, 22.5, 30, 45, 60, 80, 90]) {
		it(`decomposes ${angle} degrees at depth ${depth} without reversals`, () => {
			const theta = (angle * Math.PI) / 180;
			const start = { x: 0, y: depth };
			const end = {
				x: 240 * Math.cos(theta),
				y: depth - 240 * Math.sin(theta),
			};
			const names: WalkDirection[] = [
				"right",
				"away-right",
				"away",
				"away-left",
				"left",
				"toward-left",
				"toward",
				"toward-right",
			];
			const result = planFootsteps(walkLegs([start, end], perspective), start, {
				position: (p) => p,
				offset: (p, d) => ({ x: p.x + d.x, y: p.y + d.y }),
				entry: (_p, h) => h,
				advance: (p, h) => {
					const a = (names.indexOf(h) * Math.PI) / 4;
					const stride = 20 * (0.5 + depth / 600) * (1 + (p.y - depth) / 2000);
					return {
						x: p.x + stride * Math.cos(a),
						y: p.y - stride * Math.sin(a),
					};
				},
				rest: (p) => p,
			});
			expect(result.distance).toBeLessThanOrEqual(
				10 * (0.5 + depth / 600) * (1 + (end.y - depth) / 2000),
			);
			const switches = result.steps.filter(
				(s, i) => i > 0 && s.heading !== result.steps[i - 1].heading,
			);
			expect(switches.length).toBeLessThanOrEqual(1);
			for (const s of result.steps) {
				const a = (names.indexOf(s.heading) * Math.PI) / 4;
				expect(Math.cos(a - theta)).toBeGreaterThan(0);
				expect(Math.hypot(s.slide.x, s.slide.y)).toBeLessThanOrEqual(1);
			}
		});
	}
}

it("flips the dogleg order when the first corner cuts an obstacle", () => {
	const names: WalkDirection[] = [
		"right",
		"away-right",
		"away",
		"away-left",
		"left",
		"toward-left",
		"toward",
		"toward-right",
	];
	const start = { x: 0, y: 0 },
		end = { x: 120, y: -40 };
	const safe = (p: Point) => !(p.x < 60 && p.y < -5) && p.y >= -50;
	const result = planFootsteps(walkLegs([start, end], perspective), start, {
		position: (p) => p,
		native: (p, h) => {
			const a = (names.indexOf(h) * Math.PI) / 4;
			return { x: p.x + 40 * Math.cos(a), y: p.y - 40 * Math.sin(a) };
		},
		entry: (_p, h) => h,
		advance: (p, h) => {
			const a = (names.indexOf(h) * Math.PI) / 4;
			const next = { x: p.x + 20 * Math.cos(a), y: p.y - 20 * Math.sin(a) };
			return safe(next) ? next : undefined;
		},
		rest: (p) => (safe(p) ? p : undefined),
	});
	expect(result.distance).toBeLessThan(10);
	expect(result.steps[0].heading).toBe("right");
	expect(result.steps.every((s) => safe(s.state))).toBe(true);
	expect(
		result.steps.filter(
			(s, i) => i && s.heading !== result.steps[i - 1].heading,
		),
	).toHaveLength(1);
});
