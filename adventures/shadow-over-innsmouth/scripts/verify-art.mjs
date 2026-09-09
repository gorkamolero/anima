#!/usr/bin/env node
/**
 * Verify scene data against the art's own landmarks.
 *
 * Each background ships a `<image>.landmarks.json` describing its geometry
 * (known-height objects, horizon, interactive regions). This runner loads
 * each review scene in the running game and asks the engine
 * (window.__anima.verifyArt) whether the LIVE rendered scene — character
 * sizes, groundline scale curve, hotspot bounds — agrees with the art.
 * Every disagreement is reported with the value to use instead.
 *
 * Usage:  node scripts/verify-art.mjs [url]
 * Needs:  dev server running (pnpm dev) and `agent-browser` on PATH.
 */
import { spawnSync } from "node:child_process";

const url = process.argv[2] ?? "http://localhost:8080/";

const SCENES = [
	{
		id: "outside",
		landmarks: "backgrounds/bus-station-kat-seated-composite-v1.landmarks.json",
	},
	{
		id: "inside",
		landmarks: "backgrounds/arkham-bus-depot-flat-2d.landmarks.json",
	},
];

function runAgentBrowser(args, options = {}) {
	const result = spawnSync("agent-browser", ["--session", "anima", ...args], {
		encoding: "utf8",
		input: options.input,
	});
	if (result.error) throw result.error;
	if (result.status !== 0) {
		throw new Error(
			[`agent-browser ${args.join(" ")} failed`, result.stdout, result.stderr]
				.filter(Boolean)
				.join("\n"),
		);
	}
	return result.stdout.trim();
}

function evalInBrowser(source) {
	return JSON.parse(runAgentBrowser(["eval", "--stdin"], { input: source }));
}

runAgentBrowser(["set", "viewport", "1920", "1080"]);
runAgentBrowser(["open", url]);
runAgentBrowser(["wait", "--load", "networkidle"]);

let failed = 0;
for (const scene of SCENES) {
	const report = evalInBrowser(`
(async () => {
	for (let i = 0; i < 100; i++) {
		if (window.__anima) break;
		await new Promise((r) => setTimeout(r, 100));
	}
	const anima = window.__anima;
	if (!anima) throw new Error("window.__anima never appeared");
	window.dispatchEvent(new CustomEvent("anima:review-scene", { detail: "${scene.id}" }));
	anima.step(300);
	await anima.waitUntil(() => anima.scene.getReviewQaSnapshot().reviewSceneId === "${scene.id}");
	return anima.verifyArt("${scene.landmarks}", { referenceCharacterId: "hermes" });
})()
`);

	const errors = report.violations.filter((v) => v.severity === "error");
	const warnings = report.violations.filter((v) => v.severity === "warning");
	console.log(
		`\n=== ${scene.id} (${report.image}) — ${report.pass ? "PASS" : "FAIL"} (${errors.length} errors, ${warnings.length} warnings) ===`,
	);
	for (const violation of report.violations) {
		console.log(
			`[${violation.severity.toUpperCase()}] ${violation.type} :: ${violation.subject}`,
		);
		console.log(`  actual:    ${JSON.stringify(violation.actual)}`);
		console.log(`  expected:  ${JSON.stringify(violation.expected)}`);
		console.log(`  use this:  ${JSON.stringify(violation.suggestion)}`);
		if (violation.note) console.log(`  note:      ${violation.note}`);
	}
	if (!report.pass) failed++;
}

console.log(
	failed === 0
		? "\nArt verification: all scenes PASS"
		: `\nArt verification: ${failed} scene(s) FAIL`,
);
if (failed > 0) process.exit(1);
