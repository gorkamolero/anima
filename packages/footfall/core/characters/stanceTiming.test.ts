import { describe, expect, it } from "vitest";
import { stanceFrameMs } from "./stanceTiming";

describe("natural cadence without held source frames", () => {
	it("keeps all production cycle supports moving at 24 fps within 1.6-2.2 steps/s", () => {
		for (const lengths of [
			[18, 12],
			[15, 15],
			[13, 12],
			[12, 10, 12, 14],
		]) {
			let previous = 0;
			for (const requested of [1.6, 1.9, 2.2]) {
				const durations = lengths.map((n) =>
					stanceFrameMs(lengths, n, requested),
				);
				for (const ms of durations)
					expect(ms).toBeLessThanOrEqual(1000 / 24 + 1e-6);
				const cadence =
					(1000 * lengths.length) /
					lengths.reduce((s, n, i) => s + n * durations[i], 0);
				expect(cadence).toBeGreaterThanOrEqual(1.6 - 1e-6);
				expect(cadence).toBeLessThanOrEqual(2.2 + 1e-6);
				expect(cadence).toBeGreaterThanOrEqual(previous - 1e-6);
				previous = cadence;
			}
		}
	});
});
