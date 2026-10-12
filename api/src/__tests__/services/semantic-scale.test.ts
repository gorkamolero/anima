import { describe, expect, it } from "vitest";
import { measureSemanticScale } from "../../services/semantic-scale.js";

function rectangle(width: number, height: number, box: number[], score = 0.95) {
	const data = new Uint8Array(width * height);
	for (let y = box[1]; y < box[3]; y++)
		for (let x = box[0]; x < box[2]; x++) data[y * width + x] = 255;
	return { mask: { width, height, data }, score };
}
describe("semantic scale measurement", () => {
	it("uses detected pixels at arbitrary image positions, not a fixed reference", () => {
		for (const x of [15, 110]) {
			const result = measureSemanticScale(
				[rectangle(200, 100, [x, 30, x + 10, 60])],
				[rectangle(200, 100, [0, 50, 200, 100], 0.8)],
			);
			expect(result.scaleReference.rect).toEqual({
				x: x / 200,
				y: 0.3,
				width: 0.05,
				height: 0.3,
			});
			expect(result.horizonY).toBeCloseTo(0.49);
		}
	});
	it("rejects buildings, weak detections and absent horizons", () => {
		const sea = [rectangle(200, 100, [0, 50, 200, 100], 0.8)];
		expect(() =>
			measureSemanticScale([rectangle(200, 100, [0, 0, 100, 80])], sea),
		).toThrow("Unattended scale limitation");
		expect(() =>
			measureSemanticScale([rectangle(200, 100, [10, 30, 20, 60], 0.4)], sea),
		).toThrow();
		expect(() =>
			measureSemanticScale([rectangle(200, 100, [10, 30, 20, 60])], []),
		).toThrow();
	});
	it("rejects conflicting horizons and ill-conditioned depth", () => {
		const door = [rectangle(200, 100, [10, 30, 20, 60])];
		expect(() =>
			measureSemanticScale(door, [
				rectangle(200, 100, [0, 50, 200, 100], 0.8),
				rectangle(200, 100, [0, 40, 200, 100], 0.8),
			]),
		).toThrow("disagree");
		expect(() =>
			measureSemanticScale(door, [rectangle(200, 100, [0, 60, 200, 100], 0.8)]),
		).toThrow("too close");
	});
});
