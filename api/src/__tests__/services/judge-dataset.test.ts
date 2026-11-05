// @vitest-environment node
import { expect, it } from "vitest";
import { aggregateFloorScores, agreement, reviewedExpectation } from "../../lib/judge-dataset.js";

it("labels only the exact approved mask, never judge verdicts or other floors", () => {
	const floor = { width: 2, height: 1, data: [1, 0] };
	const record = { mask: floor, review: { approvedBy: "reviewer", date: "2026-10-12" } };
	expect(reviewedExpectation(record, floor, "review.json")).toMatchObject({ pass: true, source: "review.json" });
	expect(reviewedExpectation(record, { ...floor, data: [1, 1] }, "review.json")).toBeUndefined();
	expect(reviewedExpectation({ mask: floor }, floor, "cached-verdict.json")).toBeUndefined();
	expect(reviewedExpectation({ ...record, review: { approvedBy: "model", date: "2026-10-12" } }, floor, "x")).toBeUndefined();
});
it("scores agreement only where reviewed output exists and aggregates only labeled results", () => {
	const output = { pass: false, why: "green on water" };
	expect(agreement(output)).toEqual([]);
	const evaluations = agreement(output, { pass: true, source: "approved.json", approvedBy: "reviewer", date: "2026-10-12" });
	expect(evaluations[0]).toMatchObject({ name: "floor_agreement", value: 0, dataType: "BOOLEAN" });
	expect(aggregateFloorScores([
		{ item: {}, output, evaluations },
		{ item: {}, output: { pass: true }, evaluations: [] },
		{ item: {}, output: undefined, evaluations: [] },
	])).toEqual(expect.arrayContaining([
		expect.objectContaining({ name: "floor_pass_rate", value: 0.5 }),
		expect.objectContaining({ name: "floor_agreement_rate", value: 0 }),
		expect.objectContaining({ name: "floor_completion_rate", value: 2 / 3 }),
	]));
});
