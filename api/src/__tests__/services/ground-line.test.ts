// @vitest-environment node
import { expect, it } from "vitest";
import { safeGroundLine } from "../../services/ground-line.js";

it("routes a continuous legacy line around an obstacle instead of interpolating through it", () => {
	const mask = {
		width: 60,
		height: 40,
		data: Array.from({ length: 2400 }, (_, i) => {
			const x = i % 60,
				y = Math.floor(i / 60);
			return y > 10 && !(x >= 20 && x <= 30 && y >= 15 && y <= 29) ? 1 : 0;
		}),
	};
	const points = safeGroundLine(mask, 200, 0.002, 0.5);
	expect(points).toHaveLength(6);
	for (let i = 1; i < points.length; i++)
		for (let step = 0; step <= 10; step++) {
			const t = step / 10,
				a = points[i - 1],
				b = points[i];
			const x = Math.floor(((a.x + (b.x - a.x) * t) / 1920) * 60),
				y = Math.floor(((a.y + (b.y - a.y) * t) / 1080) * 40);
			expect(mask.data[y * 60 + x]).toBe(1);
		}
});
it("cannot bridge disconnected floor islands", () => {
	const mask = {
		width: 60,
		height: 40,
		data: Array.from({ length: 2400 }, (_, i) =>
			Math.floor(i / 60) > 10 && (i % 60 < 20 || i % 60 > 25) ? 1 : 0,
		),
	};
	const points = safeGroundLine(mask, 200, 0.002, 0.5);
	expect(points.every((p) => p.x > (26 / 60) * 1920)).toBe(true);
});
