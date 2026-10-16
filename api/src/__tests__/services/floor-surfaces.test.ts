// @vitest-environment node
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { floorQuestions } from "../../services/floor-judge.js";
import { isFloorCovering } from "../../services/floor-surfaces.js";
import { obstacleClasses } from "../../services/ground-perception.js";

it("treats cached rugs as support while retaining solid obstacle classes", async () => {
	const root = await mkdtemp(join(tmpdir(), "floor-coverings-"));
	try {
		await writeFile(
			join(root, "image-obstacle-classes-v1.json"),
			JSON.stringify({
				obstacles: [
					"pillars",
					"rugs",
					"carpets",
					"desks",
					"stairs",
					"rolled rugs",
				],
			}),
		);
		expect(await obstacleClasses("image", Buffer.alloc(0), "", root)).toEqual([
			"pillars",
			"desks",
			"stairs",
			"rolled rugs",
		]);
	} finally {
		await rm(root, { recursive: true, force: true });
	}
});

it("recognizes floor covering outlines without accepting elevated textiles or props", () => {
	for (const name of [
		"rug",
		"rugs",
		"area carpet",
		"rug-0",
		"sized-v1-rugs-2",
		"carpets.clean",
	])
		expect(isFloorCovering(name)).toBe(true);
	for (const name of [
		"rolled rugs",
		"hanging carpet",
		"carpet rack",
		"desk",
		"boulders",
	])
		expect(isFloorCovering(name)).toBe(false);
});

it("judges carpet coverage as advisory and keeps desk inclusion a hazard", () => {
	const questions = floorQuestions([
		{ name: "rugs", bounds: [0, 0.5, 1, 1] },
		{ name: "desk", bounds: [0, 0.5, 1, 1] },
	]);
	expect(questions.object_0.advisory).toBe(true);
	expect(questions.object_1.advisory).toBe(false);
});
