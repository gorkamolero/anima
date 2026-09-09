import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(packageRoot, "..", "..");
const outputDir = resolve(repoRoot, "tmp", "visual-reference-audits");
const url = process.argv[2] ?? "http://localhost:8080/";
const manifestPath = resolve(
	packageRoot,
	process.argv[3] ?? "visual-reference-audits/outside-kat-talk.json",
);
const snapshotPath = resolve(outputDir, "outside-kat-talk.snapshot.json");
const screenshotPath = resolve(outputDir, "outside-kat-talk.runtime.png");

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

const clickAndWaitScript = (x, y, predicate, timeout = 6000) => `
(async () => {
	const canvas = document.querySelector("canvas");
	const scene = window.game?.scene?.getScene("StoryGameScene");
	if (!canvas || !scene?.getReviewQaSnapshot) throw new Error("Playable scene is not ready");
	scene.setPlacementDebugEnabled?.(false);
	const rect = canvas.getBoundingClientRect();
	const clientX = rect.left + (${x} / 1920) * rect.width;
	const clientY = rect.top + (${y} / 1080) * rect.height;
	for (const type of ["pointerdown", "mousedown", "pointerup", "mouseup", "click"]) {
		const EventClass = type.startsWith("pointer") && window.PointerEvent ? PointerEvent : MouseEvent;
		canvas.dispatchEvent(new EventClass(type, {
			bubbles: true,
			cancelable: true,
			clientX,
			clientY,
			pointerId: 1,
			pointerType: "mouse",
			button: 0,
			buttons: type.endsWith("down") ? 1 : 0,
		}));
	}
	return await new Promise((resolve, reject) => {
		const started = performance.now();
		const tick = () => {
			const snapshot = scene.getReviewQaSnapshot();
			if (${predicate}) return resolve(snapshot);
			if (performance.now() - started > ${timeout}) {
				reject(new Error("Timed out waiting for reference audit state: " + JSON.stringify(snapshot)));
				return;
			}
			requestAnimationFrame(tick);
		};
		tick();
	});
})()
`;

run("agent-browser", ["set", "viewport", "1920", "1080"]);
run("agent-browser", ["open", url]);
run("agent-browser", ["wait", "--load", "networkidle"]);
evalInBrowser(`
(() => {
	const scene = window.game?.scene?.getScene("StoryGameScene");
	if (!scene?.getReviewQaSnapshot) throw new Error("StoryGameScene QA API unavailable");
	localStorage.setItem("anima.shadow-over-innsmouth.review-scene", "outside");
	window.dispatchEvent(new CustomEvent("anima:review-scene", { detail: "outside" }));
	scene.setPlacementDebugEnabled?.(false);
	return scene.getReviewQaSnapshot();
})()
`);
const snapshot = evalInBrowser(
	clickAndWaitScript(
		1040,
		560,
		'snapshot.reviewSceneId === "outside" && snapshot.katState === "seatedTalk" && snapshot.hermes && snapshot.hermes.motionState === "talk" && Math.abs(snapshot.hermes.x - 755) <= 8',
		6000,
	),
);
writeFileSync(snapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`);
run("agent-browser", ["screenshot", screenshotPath]);

const python = resolve(repoRoot, ".venv", "bin", "python");
run(python, [
	resolve(packageRoot, "scripts/render-visual-reference-audit.py"),
	repoRoot,
	manifestPath,
	snapshotPath,
	screenshotPath,
	outputDir,
]);
