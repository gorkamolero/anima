import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(packageRoot, "..", "..");
const outputDir = resolve(repoRoot, "tmp", "exterior-scale-candidates");
const url = process.argv[2] ?? "http://localhost:8080/";

const candidates = [
	{ id: "rejected_066", baseScale: 0.66 },
	{ id: "candidate_070", baseScale: 0.7 },
	{ id: "selected_074", baseScale: 0.74 },
	{ id: "too_large_082", baseScale: 0.82 },
];

const positions = [
	{ id: "default", x: 360, flipX: false },
	{ id: "kat_talk", x: 700, flipX: false },
	{ id: "door", x: 1520, flipX: false },
	{ id: "right_exit", x: 1800, flipX: true },
];

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
	const output = run("agent-browser", ["eval", "--stdin"], { input: source });
	return JSON.parse(output);
}

function screenshot(path) {
	run("agent-browser", ["screenshot", path]);
}

run("agent-browser", ["open", url]);
run("agent-browser", ["wait", "--load", "networkidle"]);

evalInBrowser(`
(() => {
	window.dispatchEvent(new CustomEvent("anima:review-scene", { detail: "outside" }));
	localStorage.setItem("anima.shadow-over-innsmouth.review-scene", "outside");
	const scene = window.game?.scene?.getScene("StoryGameScene");
	return scene?.getReviewQaSnapshot?.() ?? null;
})()
`);

const frames = [];
const snapshots = [];

for (const candidate of candidates) {
	const candidateFrames = [];
	for (const position of positions) {
		const snapshot = evalInBrowser(`
(() => {
	const scene = window.game?.scene?.getScene("StoryGameScene");
	const hermes = scene?.hermesSprite;
	const line = scene?.groundLineManager?.getGroundLine?.();
	if (!scene?.getReviewQaSnapshot || !hermes || !line) return { error: "scene not ready" };
	const data = line.getPositionData(${position.x}, ${candidate.baseScale});
	hermes.stopMoving();
	hermes.setBaseScale(${candidate.baseScale});
	hermes.setVisible(true);
	hermes.setPosition(${position.x}, data.y);
	hermes.setScale(data.scale);
	hermes.setFlipX(${position.flipX ? "true" : "false"});
	scene.hermesMotionState = "idle";
	const snapshot = scene.getReviewQaSnapshot();
	return {
		candidate: "${candidate.id}",
		position: "${position.id}",
		x: snapshot.hermes.x,
		y: snapshot.hermes.y,
		scale: snapshot.hermes.scale,
		renderedAlphaHeight: Math.round(snapshot.hermes.scale * 1022),
		background: snapshot.background,
		katVisible: snapshot.kat?.visible,
	};
})()
`);
		snapshots.push(snapshot);
		const framePath = resolve(outputDir, `${candidate.id}-${position.id}.png`);
		screenshot(framePath);
		candidateFrames.push(framePath);
		frames.push(framePath);
	}
	const rowPath = resolve(outputDir, `${candidate.id}-row.png`);
	const rowArgs = [];
	for (const frame of candidateFrames) {
		rowArgs.push("(", frame, "-resize", "480x216!", ")");
	}
	rowArgs.push("+append", rowPath);
	run("magick", rowArgs);
}

const rowPaths = candidates.map((candidate) =>
	resolve(outputDir, `${candidate.id}-row.png`),
);
const montagePath = resolve(
	outputDir,
	"exterior-scale-candidates-contact-sheet.png",
);
run("magick", [...rowPaths, "-append", montagePath]);

const report = {
	url,
	generatedAt: new Date().toISOString(),
	candidates,
	positions,
	montage: montagePath,
	frames,
	snapshots,
};

writeFileSync(
	resolve(outputDir, "exterior-scale-candidates-report.json"),
	`${JSON.stringify(report, null, 2)}\n`,
);

const markdown = [
	"# Exterior Scale Candidates",
	"",
	`Generated: ${report.generatedAt}`,
	"",
	`Contact sheet: \`${montagePath}\``,
	"",
	"Rows are candidate Hermes base scales. Columns are default, Kat TALK approach, door approach, and right-exit position.",
	"",
	"| Candidate | Position | X | Y | Runtime Scale | Rendered Height |",
	"| --- | --- | ---: | ---: | ---: | ---: |",
	...snapshots.map(
		(snapshot) =>
			`| ${snapshot.candidate} | ${snapshot.position} | ${snapshot.x} | ${snapshot.y} | ${snapshot.scale} | ${snapshot.renderedAlphaHeight}px |`,
	),
	"",
].join("\n");

writeFileSync(
	resolve(outputDir, "exterior-scale-candidates-report.md"),
	markdown,
);
console.log(JSON.stringify(report, null, 2));
