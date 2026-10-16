// @vitest-environment node
import { expect, it } from "vitest";
import { calibrateDepthScale } from "../../services/ground-depth-scale.js";

function fixture() {
	const width = 100,
		height = 100;
	const points = new Float32Array(width * height * 3);
	const valid = new Uint8Array(width * height).fill(1);
	const data = new Array<number>(width * height).fill(0);
	for (let y = 0; y < height; y++) {
		for (let x = 0; x < width; x++) {
			const i = y * width + x;
			points[i * 3 + 2] = y >= 60 ? 1 / (0.5 * ((y + 0.5) / height) - 0.2) : 10;
			data[i] = y >= 60 ? 1 : 0;
		}
	}
	return {
		field: {
			width,
			height,
			points,
			valid,
			normals: new Float32Array(points.length),
		},
		floor: { width, height, data },
		reference: {
			label: "door",
			rect: { x: 0.4, y: 0.3, width: 0.2, height: 0.2 },
			realHeightM: 2,
		},
	};
}
it("transfers a raised object's height without treating its bottom as floor", () => {
	const { field, floor, reference } = fixture();
	const result = calibrateDepthScale(field, floor, reference);
	expect(result.status).toBe("accepted");
	if (result.status !== "accepted") throw new Error(result.reason);
	// Known synthetic scene: 2m object at depth10 spans216px; a1.75m
	// adult at depth5 spans378px. These are physical fixture expectations.
	expect(result.slope * (864 - result.horizonY) * 1059 * 0.5).toBeCloseTo(
		378,
		3,
	);
	expect(result.horizonY).toBeCloseTo(432, 3);
});
it("rejects missing reference geometry", () => {
	const { field, floor, reference } = fixture();
	field.valid.fill(0, 0, 6000);
	expect(calibrateDepthScale(field, floor, reference)).toEqual({
		status: "rejected",
		reason: "insufficient reference depth",
	});
});
it("rejects strong lateral depth variation instead of silently flattening it", () => {
	const { field, floor, reference } = fixture();
	for (let y = 60; y < 100; y++)
		for (let x = 0; x < 50; x++) field.points[(y * 100 + x) * 3 + 2] *= 2;
	expect(calibrateDepthScale(field, floor, reference).status).toBe("rejected");
});
it("is invariant to the arbitrary units of monocular depth", () => {
	const { field, floor, reference } = fixture();
	const before = calibrateDepthScale(field, floor, reference);
	for (let i = 2; i < field.points.length; i += 3) field.points[i] *= 7;
	const after = calibrateDepthScale(field, floor, reference);
	if (before.status !== "accepted" || after.status !== "accepted")
		throw new Error("unexpected rejection");
	expect(after.slope).toBeCloseTo(before.slope, 8);
});

it("rejects a cropped height reference", () => {
	const { field, floor, reference } = fixture();
	reference.rect.y = 0.8;
	expect(calibrateDepthScale(field, floor, reference)).toEqual({
		status: "rejected",
		reason: "reference height is not fully visible",
	});
});
it("rejects a doorway whose interior sees distant scenery", () => {
	const { field, floor, reference } = fixture();
	for (let y = 34; y < 46; y++)
		for (let x = 46; x < 54; x++) field.points[(y * 100 + x) * 3 + 2] = 30;
	expect(calibrateDepthScale(field, floor, reference)).toEqual({
		status: "rejected",
		reason: "reference interior and edges lie at different depths",
	});
});
