#!/usr/bin/env node
/**
 * Record an mp4 of the playable scene: the full player journey, filmed
 * frame-by-frame through window.__anima.captureFrame (deterministic
 * virtual clock — works headless, no screen recording involved).
 *
 * Usage:  node scripts/record-journey.mjs [url] [--debug]
 *         --debug keeps the placement overlay visible in the video
 * Needs:  dev server running (pnpm dev), agent-browser and ffmpeg on PATH.
 * Output: tmp/anima-journey.mp4 (30fps, 960px wide)
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(packageRoot, "..", "..");
const framesDir = resolve(repoRoot, "tmp", "record-frames");
const outputPath = resolve(repoRoot, "tmp", "anima-journey.mp4");
const url = process.argv[2]?.startsWith("http")
	? process.argv[2]
	: "http://localhost:8080/";
const keepDebugOverlay = process.argv.includes("--debug");

const FPS = 30;

function runAgentBrowser(args, options = {}) {
	const result = spawnSync("agent-browser", ["--session", "anima", ...args], {
		cwd: repoRoot,
		encoding: "utf8",
		input: options.input,
		maxBuffer: 64 * 1024 * 1024,
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

// The journey: each beat optionally clicks, then films N seconds.
// Coordinates match the playtest journey (landmark-derived hotspot bounds).
const BEATS = [
	{ label: "establishing shot", seconds: 1.2 },
	{ label: "walk to Kat + talk", click: [1000, 550], seconds: 4.5 },
	{ label: "walk back across the dock", click: [420, 900], seconds: 3.0 },
	{
		label: "depot doors: exit behind the bus",
		click: [1550, 450],
		seconds: 9.5,
	},
	{ label: "inside: talk to the clerk", click: [600, 500], seconds: 5.0 },
	{ label: "back to the platform", click: [1550, 500], seconds: 6.0 },
	{ label: "outside again", seconds: 1.5 },
];

runAgentBrowser(["set", "viewport", "1920", "1080"]);
// Two opens: the first lets us clear storage on the right origin, the
// second is the actual fresh boot. No location.reload() from inside an
// eval - reload races the following evals across page contexts.
// Cache-bust so a long-lived browser can't serve stale modules and film
// old code (it happened - the footage was bit-identical across a change).
const bustedUrl = `${url}${url.includes("?") ? "&" : "?"}v=${Date.now()}`;
runAgentBrowser(["open", bustedUrl]);
runAgentBrowser(["wait", "--load", "networkidle"]);
evalInBrowser(`(() => { localStorage.clear(); return true; })()`);
runAgentBrowser(["open", `${bustedUrl}1`]);
runAgentBrowser(["wait", "--load", "networkidle"]);

const setup = evalInBrowser(`
(async () => {
	for (let i = 0; i < 100; i++) {
		if (window.__anima) break;
		await new Promise((r) => setTimeout(r, 100));
	}
	if (!window.__anima) throw new Error("window.__anima never appeared");
	window.__anima.scene.setPlacementDebugEnabled?.(${keepDebugOverlay});
	window.__anima.step(500);
	return { ready: true };
})()
`);
if (!setup.ready) throw new Error("game not ready");

rmSync(framesDir, { recursive: true, force: true });
mkdirSync(framesDir, { recursive: true });

// Each eval is self-contained: capture up to CHUNK frames and return them
// directly. No shared window state to leak between runs, and evals stay
// short enough to never hit agent-browser's eval timeout.
const CHUNK = 45;
let frameIndex = 0;
for (const beat of BEATS) {
	const total = Math.round(beat.seconds * FPS);
	let clickLine = beat.click
		? `window.__anima.click(${beat.click[0]}, ${beat.click[1]});`
		: "";
	let done = 0;
	while (done < total) {
		const count = Math.min(CHUNK, total - done);
		const frames = evalInBrowser(`
(async () => {
	${clickLine}
	const out = [];
	for (let i = 0; i < ${count}; i++) {
		out.push(await window.__anima.captureFrame());
	}
	return out;
})()
`);
		clickLine = "";
		if (frames.length !== count) {
			throw new Error(
				`beat "${beat.label}": expected ${count} frames, got ${frames.length}`,
			);
		}
		for (const dataUrl of frames) {
			writeFileSync(
				resolve(framesDir, `frame-${String(frameIndex).padStart(5, "0")}.jpg`),
				Buffer.from(dataUrl.split(",")[1], "base64"),
			);
			frameIndex++;
		}
		done += count;
	}
	console.log(`filmed: ${beat.label} (${total} frames, ${frameIndex} total)`);
}
const totalFrames = frameIndex;

const ffmpeg = spawnSync(
	"ffmpeg",
	[
		"-y",
		"-framerate",
		String(FPS),
		"-i",
		resolve(framesDir, "frame-%05d.jpg"),
		"-c:v",
		"libx264",
		"-pix_fmt",
		"yuv420p",
		"-crf",
		"20",
		outputPath,
	],
	{ encoding: "utf8" },
);
if (ffmpeg.status !== 0) {
	throw new Error(`ffmpeg failed:\n${ffmpeg.stderr}`);
}

console.log(`\nrecorded ${totalFrames} frames -> ${outputPath}`);
