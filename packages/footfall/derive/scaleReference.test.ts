import { expect, it } from "vitest";
import { assessScaleReference } from "./scaleReference";

const reference = {
	label: "crate",
	rect: { x: 0.016, y: 0.613, width: 0.231, height: 0.177 },
	realHeightM: 0.5,
};
it("rejects a box spanning parts of separate crates", () => {
	const result = assessScaleReference(reference, [
		{
			id: "2",
			label: "crates-2",
			rect: {
				x: 213 / 1920,
				y: 537 / 1080,
				width: 384 / 1920,
				height: 257 / 1080,
			},
		},
		{
			id: "0",
			label: "crates-0",
			rect: { x: 0, y: 783 / 1080, width: 368 / 1920, height: 294 / 1080 },
		},
	]);
	expect(result.status).toBe("contradicted");
	expect(result.bestIoU).toBeCloseTo(0.231366986);
});
it("does not reject references when matching segmentation is missing or elsewhere", () => {
	for (const instances of [
		[],
		[{ id: "a", label: "door", rect: reference.rect }],
		[
			{
				id: "b",
				label: "crate",
				rect: { x: 0.8, y: 0.1, width: 0.1, height: 0.1 },
			},
		],
	]) {
		expect(assessScaleReference(reference, instances).status).toBe("unknown");
	}
});
it("merges pieces of one instance but not separate objects", () => {
	const r = { ...reference, rect: { x: 0.2, y: 0.2, width: 0.2, height: 0.4 } };
	const parts = [0, 1, 2, 3].map((i) => ({
		id: "same",
		label: "crates-0",
		rect: { x: 0.2, y: 0.2 + i * 0.1, width: 0.2, height: 0.1 },
	}));
	expect(assessScaleReference(r, parts).status).toBe("supported");
	expect(
		assessScaleReference(
			r,
			parts.map((p, i) => ({ ...p, id: String(i) })),
		).status,
	).toBe("contradicted");
});
