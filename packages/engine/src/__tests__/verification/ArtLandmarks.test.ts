import { describe, expect, it } from "vitest";
import {
	buildPerspectiveModel,
	type LandmarksFile,
	verifySceneArt,
} from "../../verification/ArtLandmarks";

// A pier scene: horizon at y=470, a seated 1.65m figure and a 2m door,
// both consistent with size-proportional-to-distance-below-horizon.
const file: LandmarksFile = {
	image: "test-bg.png",
	space: "game",
	horizonY: 470,
	landmarks: [
		{
			id: "kat",
			kind: "figure",
			rect: { x: 900, y: 502, width: 180, height: 392 }, // ground y=894
			realHeightM: 1.65,
			standingFactor: 0.78,
		},
		{
			id: "door",
			kind: "object",
			// ground y=620: consistent with kat+horizon (~108 ppm => 2m = 216px)
			rect: { x: 1150, y: 404, width: 100, height: 216 },
			realHeightM: 2.0,
		},
		{
			id: "tiny-bus",
			kind: "object",
			rect: { x: 1600, y: 460, width: 300, height: 450 }, // ground y=910
			realHeightM: 3.0,
			use: false,
			note: "painted at half scale",
		},
		{
			id: "bench-region",
			kind: "region",
			rect: { x: 800, y: 430, width: 450, height: 300 },
			hotspotId: "waiting_bench",
		},
	],
};

describe("buildPerspectiveModel", () => {
	it("fits ppm linearly through landmarks and horizon", () => {
		const model = buildPerspectiveModel(file);
		expect(model.usable).toBe(true);
		// kat: (392 / 0.78) / 1.65 = ~305 ppm at y=894
		expect(model.ppmAt(894)).toBeGreaterThan(280);
		expect(model.ppmAt(894)).toBeLessThan(325);
		// approaches zero at the horizon
		expect(model.ppmAt(470)).toBeLessThan(30);
		// excluded landmarks still appear as samples
		expect(model.samples.find((s) => s.id === "tiny-bus")?.used).toBe(false);
	});

	it("applies figureCalibration to expectations", () => {
		const calibrated = buildPerspectiveModel({
			...file,
			figureCalibration: 0.5,
		});
		const plain = buildPerspectiveModel(file);
		expect(calibrated.ppmAt(894)).toBeCloseTo(plain.ppmAt(894) * 0.5, 5);
	});
});

describe("verifySceneArt", () => {
	const correctHermes = {
		id: "hermes",
		x: 900,
		y: 894,
		visible: true,
		// 1.75m at ~305 ppm => ~534px
		displayHeight: 534,
		scale: 0.5,
		baseScale: 0.5,
	};

	it("passes a scene whose sizes match the art", () => {
		const report = verifySceneArt(
			{
				characters: [correctHermes],
				hotspots: [
					{
						id: "waiting_bench",
						bounds: { x: 810, y: 440, width: 430, height: 290 },
					},
				],
				groundLine: [],
			},
			file,
		);
		expect(report.violations.filter((v) => v.severity === "error")).toEqual([]);
		expect(report.pass).toBe(true);
	});

	it("flags an oversized character and suggests the correcting scale", () => {
		const giant = { ...correctHermes, displayHeight: 900 };
		const report = verifySceneArt(
			{ characters: [giant], hotspots: [], groundLine: [] },
			file,
		);
		const violation = report.violations.find(
			(v) => v.type === "character-scale",
		);
		expect(violation).toBeDefined();
		// suggested scale shrinks him: expected ~534px over content 1800px => ~0.3
		const suggestion = violation?.suggestion as { scale: number };
		expect(suggestion.scale).toBeGreaterThan(0.25);
		expect(suggestion.scale).toBeLessThan(0.35);
		expect(report.pass).toBe(false);
	});

	it("flags a misplaced hotspot and suggests the art region rect", () => {
		const report = verifySceneArt(
			{
				characters: [correctHermes],
				hotspots: [
					{
						id: "waiting_bench",
						bounds: { x: 100, y: 100, width: 200, height: 200 },
					},
				],
				groundLine: [],
			},
			file,
		);
		const violation = report.violations.find(
			(v) => v.type === "hotspot-bounds",
		);
		expect(violation?.suggestion).toEqual(
			file.landmarks.find((l) => l.id === "bench-region")?.rect,
		);
	});

	it("flags a fake perspective curve on the groundline", () => {
		const report = verifySceneArt(
			{
				characters: [correctHermes],
				hotspots: [],
				// flat walkline but a wild 1.6 scale factor: geometry disagrees
				groundLine: [
					{ x: 400, y: 894, scaleFactor: 0.6 },
					{ x: 1000, y: 894, scaleFactor: 1.0 },
				],
			},
			file,
		);
		const violations = report.violations.filter(
			(v) => v.type === "groundline-scale",
		);
		expect(violations.length).toBe(1); // only the 0.6 point disagrees
		const suggestion = violations[0].suggestion as { scaleFactor: number };
		expect(suggestion.scaleFactor).toBeCloseTo(1.0, 1);
	});
});
