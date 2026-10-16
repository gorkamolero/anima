import { expect, it } from "vitest";
import {
	clearanceRoute,
	clearanceRouteQuery,
	routeCorners,
} from "./clearanceRoute";

it("string-pulls the shortest clearance route and counts only turns over 25 degrees", () => {
	const mask = {
		width: 12,
		height: 12,
		data: Array.from({ length: 144 }, (_, i) => {
			const x = i % 12,
				y = Math.floor(i / 12);
			return x >= 1 && x <= 10 && y >= 1 && y <= 10 && (y <= 2 || x >= 9)
				? 1
				: 0;
		}),
	};
	const route = clearanceRoute(mask, { x: 240, y: 135 }, { x: 1680, y: 945 });
	expect(route.length).toBeGreaterThan(2);
	expect(routeCorners(route)).toHaveLength(1);
	expect(
		routeCorners([
			{ x: 0, y: 0 },
			{ x: 1, y: 0 },
			{ x: 2, y: 0.1 },
		]),
	).toEqual([]);
});
it("uses the reviewer's eight-connected diagonal route without weakening stance collision checks", () => {
	const mask = { width: 2, height: 2, data: [1, 0, 0, 1] };
	expect(clearanceRoute(mask, { x: 480, y: 270 }, { x: 1440, y: 810 })).toEqual(
		[
			{ x: 480, y: 270 },
			{ x: 1440, y: 810 },
		],
	);
});
it("has no corner allowance on an open floor", () => {
	const mask = { width: 12, height: 12, data: Array(144).fill(1) };
	expect(
		routeCorners(clearanceRoute(mask, { x: 240, y: 135 }, { x: 1680, y: 945 })),
	).toEqual([]);
});

it("resumes a frontier across near, far and unreachable queries without changing ties", () => {
	const mask = {
		width: 24,
		height: 18,
		data: Array.from({ length: 24 * 18 }, (_, i) => (i % 24 === 12 ? 0 : 1)),
	};
	const query = clearanceRouteQuery(mask),
		start = { x: 120, y: 90 };
	for (const target of [
		{ x: 120, y: 90 },
		{ x: 800, y: 900 },
		{ x: 240, y: 180 },
		{ x: 1800, y: 900 },
		{ x: 720, y: 600 },
		{ x: 800, y: 900 },
	])
		expect(query(start, target)).toEqual(clearanceRoute(mask, start, target));
	const other = { x: 1700, y: 300 };
	expect(query(other, { x: 1800, y: 900 })).toEqual(
		clearanceRoute(mask, other, { x: 1800, y: 900 }),
	);
});
