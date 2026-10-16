// @vitest-environment node

import { buildPerspectiveModel } from "@anima/engine/verification/ArtLandmarks";
import { expect, it } from "vitest";
import {
	calibrateGround,
	referenceLandmark,
	validatedScaleGuidance,
} from "../../services/ground-calibration.js";

it("rejects a contradicted object reference without mutating cached guidance", () => {
	const guidance = {
		horizonY: 0.55,
		referenceFootY: 0.9,
		referenceHeight: 0.5,
		scaleReference: {
			label: "crate",
			rect: { x: 0.016, y: 0.613, width: 0.231, height: 0.177 },
			realHeightM: 0.5,
		},
	};
	const selected = validatedScaleGuidance(guidance, [
		{
			id: "crates-2-upright",
			label: "crates-2",
			bbox: { x: 213, y: 537, w: 384, h: 257 },
			baseline: [],
			png: "unused.png",
		},
	]);
	expect(selected.scaleReference).toBeUndefined();
	expect(guidance.scaleReference).toBeDefined();
	const calibrated = calibrateGround(selected);
	expect(
		(0.9 * 1080 - calibrated.horizonY) * calibrated.slope * 1059 * 0.5,
	).toBeCloseTo(540);
	expect(validatedScaleGuidance(guidance, [])).toBe(guidance);
});

it("uses the visible object's physical height rather than an imagined adult", () => {
	const scaleReference = {
		label: "door",
		rect: { x: 0.7, y: 0.3, width: 0.05, height: 0.2 },
		realHeightM: 2,
	};
	const guidance = {
		horizonY: 0.4,
		referenceFootY: 0.7,
		referenceHeight: 0.6,
		scaleReference,
	};
	const model = calibrateGround(guidance);
	const landmark = referenceLandmark(scaleReference);
	const verification = buildPerspectiveModel({
		image: "test.png",
		space: "game",
		horizonY: model.horizonY,
		landmarks: [landmark],
	});
	for (const y of [540, 650, 900]) {
		expect((y - model.horizonY) * model.slope * 1059 * 0.5).toBeCloseTo(
			verification.ppmAt(y) * 1.75,
			8,
		);
	}
	expect(model.referenceFactor * 1059 * 0.5).toBeCloseTo(189);
});
it("rejects a reference at the horizon instead of hiding it with a denominator clamp", () => {
	expect(() =>
		calibrateGround({
			horizonY: 0.5,
			referenceFootY: 0.8,
			referenceHeight: 0.3,
			scaleReference: {
				label: "bad",
				rect: { x: 0.1, y: 0.3, width: 0.1, height: 0.2 },
				realHeightM: 2,
			},
		}),
	).toThrow();
});
it("retains legacy cached calibration when no measured object exists", () => {
	expect(
		calibrateGround({
			horizonY: 0.44,
			referenceFootY: 0.62,
			referenceHeight: 0.45,
		}).slope,
	).toBeCloseTo(0.004721435316336165);
});
