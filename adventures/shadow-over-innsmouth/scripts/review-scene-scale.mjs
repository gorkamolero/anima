import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(packageRoot, "..", "..");
const url = process.argv[2] ?? "http://localhost:8080/";
const manifestPath = resolve(
	packageRoot,
	process.argv[3] ?? "scene-scale-reviews/outside-route.json",
);
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
const outputDir = resolve(repoRoot, "tmp", "scene-scale-reviews", manifest.id);
const captureReportPath = resolve(outputDir, "capture.json");

mkdirSync(outputDir, { recursive: true });

function run(command, args, options = {}) {
	const result = spawnSync(command, args, {
		cwd: repoRoot,
		encoding: "utf8",
		input: options.input,
	});
	if (result.error) throw result.error;
	if (result.status !== 0) {
		throw new Error(
			[
				`${command} ${args.join(" ")} failed with ${result.status}`,
				result.stdout,
				result.stderr,
			]
				.filter(Boolean)
				.join("\n"),
		);
	}
	return result.stdout.trim();
}

function evalInBrowser(source) {
	return JSON.parse(
		run("agent-browser", ["eval", "--stdin"], { input: source }),
	);
}

function browserString(value) {
	return JSON.stringify(value).replaceAll("</", "<\\/");
}

run("agent-browser", ["set", "viewport", "1920", "1080"]);
run("agent-browser", ["open", url]);
run("agent-browser", ["wait", "--load", "networkidle"]);
evalInBrowser(`
(() => {
	const scene = window.game?.scene?.getScene("StoryGameScene");
	if (!scene?.getReviewQaSnapshot) throw new Error("StoryGameScene QA API unavailable");
	window.dispatchEvent(new CustomEvent("anima:review-scene", { detail: ${browserString(manifest.reviewSceneId)} }));
	localStorage.setItem("anima.shadow-over-innsmouth.review-scene", ${browserString(manifest.reviewSceneId)});
	scene.setPlacementDebugEnabled?.(true);
	return scene.getReviewQaSnapshot();
})()
`);

const samples = [];
for (const sample of manifest.samples) {
	const snapshot = evalInBrowser(`
(() => {
	const scene = window.game?.scene?.getScene("StoryGameScene");
	if (!scene?.reviewPlaceHermesAt) throw new Error("reviewPlaceHermesAt QA API unavailable");
	return scene.reviewPlaceHermesAt(${sample.x}, {
		sceneId: ${browserString(manifest.reviewSceneId)},
		flipX: ${sample.flipX === undefined ? "undefined" : JSON.stringify(sample.flipX)},
		motionState: "idle",
	});
})()
`);
	const screenshotPath = resolve(
		outputDir,
		`${String(samples.length + 1).padStart(2, "0")}-${sample.id}.png`,
	);
	run("agent-browser", ["screenshot", screenshotPath]);
	samples.push({
		...sample,
		screenshot: screenshotPath,
		snapshot,
	});
}

const captureReport = {
	id: manifest.id,
	url,
	manifest: manifestPath,
	reviewSceneId: manifest.reviewSceneId,
	generatedAt: new Date().toISOString(),
	samples,
};
writeFileSync(captureReportPath, `${JSON.stringify(captureReport, null, 2)}\n`);

const python = resolve(repoRoot, ".venv", "bin", "python");
run(python, [
	resolve(packageRoot, "scripts/render-scene-scale-review.py"),
	repoRoot,
	manifestPath,
	captureReportPath,
	outputDir,
]);
