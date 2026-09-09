#!/usr/bin/env node
import { spawnSync } from "node:child_process";
/**
 * Agent playtest: full user journey through the review scenes.
 *
 * Drives the running game via the engine's window.__anima API (virtual
 * clock + synthetic input), so it works from hidden/headless tabs where
 * requestAnimationFrame never fires.
 *
 * Usage:  node scripts/playtest-journey.mjs [url]
 * Needs:  dev server running (pnpm dev) and `agent-browser` on PATH.
 */
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(packageRoot, "..", "..");
const outputDir = resolve(repoRoot, "tmp");
const url = process.argv[2] ?? "http://localhost:8080/";
mkdirSync(outputDir, { recursive: true });

const checks = [];

function runAgentBrowser(args, options = {}) {
	const result = spawnSync("agent-browser", ["--session", "anima", ...args], {
		cwd: repoRoot,
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

function expect(name, pass, details = undefined) {
	checks.push({ name, pass, details });
	const mark = pass ? "PASS" : "FAIL";
	console.log(`[${mark}] ${name}${pass ? "" : `: ${JSON.stringify(details)}`}`);
}

function screenshot(name) {
	runAgentBrowser(["screenshot", resolve(outputDir, name)]);
}

// A click step: click game coords, pump virtual frames until predicate
// (written against `qa` = getReviewQaSnapshot()) holds, return the snapshot.
const act = (x, y, predicate, timeoutMs = 15000) => `
(async () => {
	const anima = window.__anima;
	if (!anima) throw new Error("window.__anima missing - engine debug API not installed");
	anima.click(${x}, ${y});
	const scene = anima.scene;
	const snap = await anima.waitUntil(() => {
		const qa = scene.getReviewQaSnapshot();
		return (${predicate});
	}, { timeoutMs: ${timeoutMs} });
	return { generic: snap, qa: scene.getReviewQaSnapshot() };
})()
`;

runAgentBrowser(["set", "viewport", "1920", "1080"]);
runAgentBrowser(["open", url]);
runAgentBrowser(["wait", "--load", "networkidle"]);

// Fresh state, then wait for boot.
evalInBrowser(
	`(() => { localStorage.clear(); location.reload(); return true; })()`,
);
runAgentBrowser(["wait", "--load", "networkidle"]);
const boot = evalInBrowser(`
(async () => {
	for (let i = 0; i < 100; i++) {
		if (window.__anima) break;
		await new Promise((r) => setTimeout(r, 100));
	}
	const anima = window.__anima;
	if (!anima) throw new Error("window.__anima never appeared");
	anima.step(500);
	return { generic: anima.snapshot(), qa: anima.scene.getReviewQaSnapshot() };
})()
`);

const hermesOf = (result) =>
	result.generic.characters.find((c) => c.id === "hermes");

expect(
	"boots into outside review scene",
	boot.qa.reviewSceneId === "outside",
	boot.qa.reviewSceneId,
);
const bootHermes = hermesOf(boot);
expect(
	"Hermes spawns idle at exterior spawn",
	bootHermes?.x === 360 && bootHermes?.animationState === "idle",
	bootHermes,
);
const spawnScale = bootHermes?.scale;
expect(
	"y-sorted depth: on the dock Hermes renders IN FRONT of the vehicle overlay",
	boot.qa.vehicleOverlay?.visible === true &&
		bootHermes?.depth > boot.qa.vehicleOverlay.depth,
	{ overlay: boot.qa.vehicleOverlay, hermesDepth: bootHermes?.depth },
);

// 1. TALK to Kat at the bench.
const talk = evalInBrowser(
	act(
		1000,
		550,
		`qa.hermes && qa.hermes.motionState === "talk" && Math.abs(qa.hermes.x - 755) <= 8`,
	),
);
expect("bench TALK walks Hermes to Kat and plays talk animation", true, null);
expect(
	"Kat enters seatedTalk state during conversation",
	talk.qa.katState === "seatedTalk",
	talk.qa.katState,
);
screenshot("playtest-1-bench-talk.png");

// 2. Walk away, then USE the bus. Regression: Hermes must NOT stay stuck
//    in his talk animation after the conversation is over.
evalInBrowser(
	act(
		420,
		900,
		`qa.hermes.motionState === "idle" && Math.abs(qa.hermes.x - 420) <= 8`,
	),
);
const bus = evalInBrowser(
	act(
		1700,
		600,
		`qa.hermes.motionState !== "walk" && Math.abs(qa.hermes.x - 1660) <= 8`,
	),
);
expect(
	"REGRESSION sticky-talk: Hermes is idle (not talking) after USE bus",
	hermesOf(bus)?.animationState === "idle",
	hermesOf(bus),
);
screenshot("playtest-2-bus-use.png");

// 3. USE the depot doors -> transition inside. Instrumented: samples every
//    frame to enforce staging invariants on the scripted exit path.
const exitTrack = evalInBrowser(`
(async () => {
	const anima = window.__anima;
	const scene = anima.scene;
	anima.click(1550, 450);
	const track = [];
	for (let i = 0; i < 500; i++) {
		anima.step(33.33);
		for (let j = 0; j < 5; j++) await Promise.resolve();
		await new Promise((r) => queueMicrotask(r));
		const h = scene.hermesSprite;
		const qa = scene.getReviewQaSnapshot();
		track.push({
			x: Math.round(h.x * 10) / 10,
			y: Math.round(h.y * 10) / 10,
			anim: h.getAnimationState(),
			visible: h.visible,
			displayHeight: Math.round(h.displayHeight),
			// visibility oracle: geometric fraction of his silhouette the
			// player can see (occluders' texture alpha, no rendering)
			seen: Math.round(anima.visibility("hermes").fraction * 100) / 100,
			scene: qa.reviewSceneId,
		});
		if (qa.reviewSceneId === "inside" && i > 30) break;
	}
	return track;
})()
`);
const exitSamples = exitTrack.filter((s) => s.scene === "outside");
let stalls = 0;
let hiddenSpan = 0;
let maxHiddenSpan = 0;
for (let i = 1; i < exitSamples.length; i++) {
	const prev = exitSamples[i - 1];
	const cur = exitSamples[i];
	const moved = Math.abs(cur.x - prev.x) + Math.abs(cur.y - prev.y);
	if (cur.visible && cur.seen > 0.15 && moved < 0.3 && cur.anim === "walk") {
		stalls++;
	}
	if (!cur.visible || cur.seen <= 0.15) {
		hiddenSpan++;
		maxHiddenSpan = Math.max(maxHiddenSpan, hiddenSpan);
	} else {
		hiddenSpan = 0;
	}
}
expect(
	"REGRESSION exit-stall: Hermes never freezes while visible on the exit path",
	stalls === 0,
	{ stalls },
);
expect(
	"REGRESSION exit-hidden: Hermes is never out of sight longer than 0.8s",
	maxHiddenSpan <= 24,
	{ maxHiddenSpanFrames: maxHiddenSpan },
);
// Arrival scale: the house-door landmark is the character's ruler at the
// end of this path (213px door / 2.03m * 1.75m person = ~184px).
const lastOutside = exitSamples[exitSamples.length - 1];
const doorExpectedPx = (213 / 2.03) * 1.75;
expect(
	"REGRESSION door-scale: Hermes arrives at the house door at door scale",
	Math.abs(lastOutside.displayHeight - doorExpectedPx) / doorExpectedPx <= 0.2,
	{
		arrivedAt: lastOutside.displayHeight,
		expected: Math.round(doorExpectedPx),
	},
);
// The instrumented run above already performed the transition - just read.
const inside = evalInBrowser(`
(async () => {
	const anima = window.__anima;
	anima.step(300);
	for (let j = 0; j < 5; j++) await Promise.resolve();
	return { generic: anima.snapshot(), qa: anima.scene.getReviewQaSnapshot() };
})()
`);
expect(
	"depot doors transition to interior",
	inside.qa.reviewSceneId === "inside",
	inside.qa.reviewSceneId,
);
expect(
	"vehicle overlay is hidden in the interior scene",
	inside.qa.vehicleOverlay?.visible === false,
	inside.qa.vehicleOverlay,
);
expect(
	"Hermes spawns visible inside at the doorway",
	hermesOf(inside)?.visible === true &&
		Math.abs(hermesOf(inside)?.x - 1760) <= 8,
	hermesOf(inside),
);
screenshot("playtest-3-inside.png");

// 4. TALK to the clerk, then LOOK at the bench. Second sticky-talk check.
// Click coords sit inside the landmark-derived hotspot bounds (booth, bench).
evalInBrowser(
	act(
		600,
		500,
		`qa.hermes.motionState === "talk" && Math.abs(qa.hermes.x - 480) <= 8`,
	),
);
const benchLook = evalInBrowser(
	act(
		1100,
		700,
		`qa.hermes.motionState !== "walk" && Math.abs(qa.hermes.x - 780) <= 8`,
	),
);
expect(
	"REGRESSION sticky-talk: Hermes is idle after LOOK at bench (post-clerk-talk)",
	hermesOf(benchLook)?.animationState === "idle",
	hermesOf(benchLook),
);

// 5. USE the bus platform -> back outside. Regression: his size must
//    survive the round trip.
const back = evalInBrowser(
	act(
		1550,
		500,
		`qa.reviewSceneId === "outside" && qa.hermes.motionState !== "walk"`,
		30000,
	),
);
expect(
	"bus platform transitions back outside",
	back.qa.reviewSceneId === "outside",
	back.qa.reviewSceneId,
);

const backAtSpawn = evalInBrowser(
	act(
		360,
		900,
		`qa.hermes.motionState === "idle" && Math.abs(qa.hermes.x - 360) <= 8`,
	),
);
const finalScale = hermesOf(backAtSpawn)?.scale;
expect(
	"REGRESSION scale-continuity: Hermes is the same size at spawn after a round trip",
	Math.abs(finalScale - spawnScale) < 0.005,
	{ before: spawnScale, after: finalScale },
);
screenshot("playtest-4-back-outside.png");

const failed = checks.filter((check) => !check.pass);
console.log(
	`\n${checks.length - failed.length}/${checks.length} checks passed`,
);
if (failed.length > 0) process.exit(1);
