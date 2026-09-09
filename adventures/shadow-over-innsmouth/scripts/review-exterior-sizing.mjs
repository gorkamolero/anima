import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(packageRoot, "..", "..");
const outputDir = resolve(repoRoot, "tmp", "exterior-sizing");
const url = process.argv[2] ?? "http://localhost:8080/";

const positions = [
	{ id: "left_dock", x: 120, flipX: false },
	{ id: "default_idle", x: 360, flipX: false },
	{ id: "open_dock", x: 520, flipX: false },
	{ id: "kat_approach", x: 755, flipX: false },
	{ id: "kat_near", x: 1040, flipX: true },
	{ id: "door_approach", x: 1520, flipX: false },
	{ id: "right_bus_edge", x: 1800, flipX: true },
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

for (const position of positions) {
	const snapshot = evalInBrowser(`
(() => {
	const scene = window.game?.scene?.getScene("StoryGameScene");
	const hermes = scene?.hermesSprite;
	const line = scene?.groundLineManager?.getGroundLine?.();
	if (!scene?.getReviewQaSnapshot || !hermes || !line) return { error: "scene not ready" };
	const baseScale = hermes.getBaseScale();
	const data = line.getPositionData(${position.x}, baseScale);
	hermes.stopMoving();
	hermes.setVisible(true);
	hermes.setPosition(${position.x}, data.y);
	hermes.setScale(data.scale);
	hermes.setFlipX(${position.flipX ? "true" : "false"});
	scene.hermesMotionState = "idle";
	const snapshot = scene.getReviewQaSnapshot();
	return {
		id: "${position.id}",
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
	const path = resolve(outputDir, `${position.id}.png`);
	run("agent-browser", ["screenshot", path]);
	frames.push(path);
}

const montagePath = resolve(outputDir, "exterior-sizing-contact-sheet.png");
const rows = [];
for (let i = 0; i < frames.length; i += 2) {
	const rowPath = resolve(outputDir, `row-${Math.floor(i / 2) + 1}.png`);
	const args = [];
	for (const frame of frames.slice(i, i + 2)) {
		args.push("(", frame, "-resize", "640x288!", ")");
	}
	args.push("+append", rowPath);
	run("magick", args);
	rows.push(rowPath);
}
run("magick", [...rows, "-append", montagePath]);

const report = {
	url,
	generatedAt: new Date().toISOString(),
	montage: montagePath,
	frames,
	snapshots,
};
const reportPath = resolve(outputDir, "exterior-sizing-report.json");
writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
const markdownPath = resolve(outputDir, "exterior-sizing-report.md");
const markdown = [
	"# Exterior Sizing Review",
	"",
	`Generated: ${report.generatedAt}`,
	"",
	`Contact sheet: \`${montagePath}\``,
	"",
	"![Exterior sizing contact sheet](./exterior-sizing-contact-sheet.png)",
	"",
	"| Position | X | Y | Scale | Rendered height | Kat sprite visible | Frame |",
	"| --- | ---: | ---: | ---: | ---: | --- | --- |",
	...snapshots.map((snapshot, index) => {
		const frameName = frames[index].split("/").at(-1);
		return `| ${snapshot.id} | ${snapshot.x} | ${snapshot.y} | ${snapshot.scale} | ${snapshot.renderedAlphaHeight}px | ${snapshot.katVisible ? "yes" : "no"} | [${frameName}](./${frameName}) |`;
	}),
	"",
	"Review notes:",
	"- Hermes should read taller than seated Kat at `kat_approach`.",
	"- The TALK stop should not overlap Kat, her backpack, or the bench seat.",
	"- The right-side frames should keep Hermes plausibly sized against the station door and car.",
	"",
].join("\n");
writeFileSync(markdownPath, markdown);
console.log(JSON.stringify(report, null, 2));
