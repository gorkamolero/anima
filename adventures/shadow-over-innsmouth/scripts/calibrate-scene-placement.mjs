import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(packageRoot, "..", "..");
const outputDir = resolve(repoRoot, "tmp", "placement-calibration");

function usage() {
	console.log(`Usage:
  node scripts/calibrate-scene-placement.mjs prompt <calibration.json>
  node scripts/calibrate-scene-placement.mjs apply <calibration.json>

The prompt command writes an image-model prompt for a 5-6 position placement
contact sheet. The apply command converts measured model placements into the
scene groundLine + idle anchor data used by the game.`);
}

function readCalibration(path) {
	return JSON.parse(readFileSync(resolve(path), "utf8"));
}

function writeOutput(name, extension, content) {
	mkdirSync(outputDir, { recursive: true });
	const path = resolve(outputDir, `${name}.${extension}`);
	writeFileSync(path, content);
	return path;
}

function makePrompt(calibration) {
	const positions = calibration.requestedPositions
		.map(
			(position, index) =>
				`${index + 1}. ${position.id}: feet planted near x=${position.x}, on the correct walkable floor/ground plane; ${position.note}`,
		)
		.join("\n");

	return `Use case: illustration-story
Asset type: game-scene placement calibration contact sheet
Input images:
- Background reference: ${calibration.background}
- Full character reference: ${calibration.characterReference}
- Transparent/current sprite reference: ${calibration.spriteReference}

Primary request:
Place ${calibration.characterName} into the exact background at ${calibration.requestedPositions.length} separate full-body positions. This is not final art; it is a calibration sheet for measuring feet anchors, walk trajectory, idle stance positions, and sprite scale.

Scene/backdrop:
Use the provided background as the strict camera, lighting, and perspective reference. Do not redesign the background. Keep every placement in the same 1920x1080 frame.

Character:
Preserve ${calibration.characterName}'s identity, clothes, proportions, silhouette, and line style from the references. Full body must be visible at every position.

Positions:
${positions}

Output format:
Create one wide 1920x1080 contact sheet using the provided background once, with the character placed at all requested positions simultaneously. Each instance should be a small readable full-body placement study at the correct in-scene scale, with feet exactly on the floor/ground plane.

Critical measurement constraints:
- Do not crop the character.
- Do not change the camera.
- Do not add shadows that obscure the feet.
- Do not add labels, arrows, text, UI, watermarks, or measuring guides.
- Do not create transparent sprites.
- Do not bake the character into a new redesigned background.
- Keep the character scale different where perspective demands it.
- The only goal is to solve: x, foot y, scale, facing, and idle stance for each position.

After generation, measure each placement as:
{ "id": string, "x": feetCenterX, "y": feetGroundY, "displayHeight": visibleCharacterHeight, "facing": "left" | "right" }`;
}

function normalizeSamples(calibration) {
	const samples = [...calibration.measuredPlacements].sort((a, b) => a.x - b.x);
	const referenceHeight =
		calibration.referenceDisplayHeight ??
		samples.find((sample) => sample.displayHeight)?.displayHeight ??
		1;

	return samples.map((sample) => {
		const scaleFactor =
			sample.scaleFactor ??
			(sample.displayHeight ? sample.displayHeight / referenceHeight : 1);
		return {
			id: sample.id,
			x: Math.round(sample.x),
			y: Math.round(sample.y),
			scaleFactor: Number(scaleFactor.toFixed(4)),
			facing: sample.facing ?? "right",
			state: sample.state ?? "idle",
		};
	});
}

function applyCalibration(calibration) {
	const samples = normalizeSamples(calibration);
	const groundLine = {
		interpolation: calibration.interpolation ?? "catmull-rom",
		points: samples.map(({ x, y, scaleFactor }) => ({
			x,
			y,
			scaleFactor,
		})),
		clampToBounds: calibration.clampToBounds ?? true,
	};
	const idleAnchors = Object.fromEntries(
		samples.map((sample) => [
			sample.id,
			{
				x: sample.x,
				y: sample.y,
				scaleFactor: sample.scaleFactor,
				facing: sample.facing,
				state: sample.state,
			},
		]),
	);

	return {
		sceneId: calibration.sceneId,
		characterId: calibration.characterId,
		baseScale: calibration.baseScale,
		groundLine,
		idleAnchors,
	};
}

const [mode, inputPath] = process.argv.slice(2);
if (!mode || !inputPath || !["prompt", "apply"].includes(mode)) {
	usage();
	process.exit(1);
}

const calibration = readCalibration(inputPath);
const outputName = `${calibration.sceneId}-${calibration.characterId}`;

if (mode === "prompt") {
	const path = writeOutput(
		outputName,
		"prompt.md",
		`${makePrompt(calibration)}\n`,
	);
	console.log(path);
} else {
	const result = applyCalibration(calibration);
	const path = writeOutput(
		outputName,
		"placement.json",
		`${JSON.stringify(result, null, 2)}\n`,
	);
	console.log(path);
}
