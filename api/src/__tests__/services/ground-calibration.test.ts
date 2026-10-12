// @vitest-environment node

import { buildPerspectiveModel } from "@anima/engine/verification/ArtLandmarks";
import { expect, it } from "vitest";
import {
	calibrateGround,
	referenceLandmark,
} from "../../services/ground-calibration.js";

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
