// @vitest-environment node
import { expect, it } from "vitest";
import {
	type HeightCandidate,
	selectHeightCandidates,
} from "../../services/ground-semantic-height.js";

function candidate(
	id: string,
	category: string,
	slope: number,
): HeightCandidate {
	return {
		id,
		category,
		reference: {
			label: category,
			rect: { x: 0.2, y: 0.2, width: 0.1, height: 0.3 },
			realHeightM: 2,
		},
		calibration: {
			status: "estimated",
			horizonY: 400,
			slope,
			referenceFootY: 0.8,
			referenceFactor: 1,
			residual90: 0.01,
		},
	};
}
it("does not count duplicate object pieces as independent references", () => {
	const one = candidate("door1", "doors", 0.002);
	expect(selectHeightCandidates([one, { ...one }]).status).toBe("unknown");
});
it("retains explicit physical-height uncertainty for consistent references", () => {
	const r = selectHeightCandidates([
		candidate("d1", "doors", 0.002),
		candidate("d2", "doors", 0.0021),
	]);
	expect(r.status).toBe("estimated");
	if (r.status !== "estimated") throw Error("missing estimate");
	expect(r.heightUncertaintyM).toBe(0.2);
	expect(r.instances).toHaveLength(2);
});
it("does not cherry-pick an agreeing pair from a contradictory category", () => {
	expect(
		selectHeightCandidates([
			candidate("d1", "doors", 0.002),
			candidate("d2", "doors", 0.0021),
			candidate("d3", "doors", 0.004),
		]).status,
	).toBe("unknown");
});
it("rejects disagreement between otherwise consistent categories", () => {
	expect(
		selectHeightCandidates([
			candidate("d1", "doors", 0.002),
			candidate("d2", "doors", 0.0021),
			candidate("desk", "desk", 0.004),
		]).status,
	).toBe("unknown");
});
it("does not infer a fixed physical size for variable-size props", () => {
	expect(
		selectHeightCandidates([
			candidate("barrel1", "barrels", 0.002),
			candidate("barrel2", "barrels", 0.002),
		]).status,
	).toBe("unknown");
});

it("retains broad uncertainty for a lone lamp-post reference", () => {
	const r = selectHeightCandidates([candidate("lamp1", "lamp-post", 0.002)]);
	expect(r.status).toBe("estimated");
	if (r.status !== "estimated") throw Error("missing estimate");
	expect(r.heightUncertaintyM).toBe(1);
});
