import { describe, expect, it } from "vitest";

// F19: whole-body overlap hid a trailing leg disappearing at a wide-stride cut.
// Exercise the shipped metadata, which is the policy the motor consumes.
describe("passing-pose cut assets", () => {
	it.each([
		"hermes-fal-veo-transparent-loop",
		"hermes-walk-away",
		"hermes-walk-away-right",
		"hermes-walk-toward",
		"hermes-walk-toward-right",
	])("%s uses reviewed passing poses for both seams", async (name) => {
		const { readFileSync } = await import("node:fs");
		const data = JSON.parse(
			readFileSync(
				`adventures/shadow-over-innsmouth/public/assets/sprites/hermes/${name}.json`,
				"utf8",
			),
		);
		const cut = data.matchedCut;
		expect(cut.standing).toContain("hermes-passing-stand-");
		const idle = JSON.parse(
			readFileSync(
				`adventures/shadow-over-innsmouth/public/assets/sprites/hermes/${cut.standing}.json`,
				"utf8",
			),
		);
		expect(idle.normalization.reference).toBe(name);
		expect(cut.exitFrames).toEqual([idle.normalization.sourceFrame]);
		expect(cut.entryFrames).toEqual(cut.exitFrames);
		expect(cut.metrics[cut.exitFrames[0]].lowerBodyIoU).toBeGreaterThanOrEqual(
			0.9,
		);
		for (const frame of [...cut.exitFrames, ...cut.entryFrames]) {
			expect(data.reviewedPassingFrames).toContain(frame);
			const metric = cut.metrics[frame];
			expect(metric.passing).toBe(true);
			expect(metric.lowerBodyIoU).toBeGreaterThan(0);
			expect(metric.freeFootPx).toBeGreaterThanOrEqual(0);
		}
		if (name === "hermes-fal-veo-transparent-loop") {
			expect(cut.exitFrames).not.toContain(24);
			expect(cut.entryFrames).not.toContain(24);
		}
	});
});
