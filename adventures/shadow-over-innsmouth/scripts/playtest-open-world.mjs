#!/usr/bin/env node
/**
 * Open-world MVP journey through the live game and API.
 *
 * Usage:
 *   node scripts/playtest-open-world.mjs [url] [--object="vending machine"]
 *
 * The default deliberately enforces the brief's vending-machine journey. A
 * different visible object may be supplied to diagnose the pipeline when the
 * scene art does not contain a vending machine.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const repoRoot = resolve(packageRoot, "..", "..");
const outputDir = resolve(repoRoot, "tmp", "open-world-mvp");
const url =
	process.argv.find((argument) => argument.startsWith("http")) ??
	"http://localhost:8080/";
const requestedObject =
	process.argv
		.find((argument) => argument.startsWith("--object="))
		?.slice("--object=".length) ?? "vending machine";
const exactChoice =
	process.argv
		.find((argument) => argument.startsWith("--choice="))
		?.slice("--choice=".length) ??
	"I pour the lamp oil from my satchel over it and set it ablaze";
const session = "anima-open-world";
const socketDir = resolve(outputDir, "browser-sockets");

mkdirSync(outputDir, { recursive: true });
mkdirSync(socketDir, { recursive: true });

function runAgentBrowser(args, options = {}) {
	const result = spawnSync("agent-browser", ["--session", session, ...args], {
		cwd: repoRoot,
		encoding: "utf8",
		env: { ...process.env, AGENT_BROWSER_SOCKET_DIR: socketDir },
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

function writeFrame(filename, dataUrl) {
	const pngPath = resolve(outputDir, filename);
	const jpegPath = `${pngPath}.source.jpg`;
	writeFileSync(jpegPath, Buffer.from(dataUrl.split(",")[1], "base64"));
	const conversion = spawnSync("magick", [jpegPath, pngPath], {
		cwd: repoRoot,
		encoding: "utf8",
	});
	rmSync(jpegPath, { force: true });
	if (conversion.status !== 0) {
		throw new Error(`Frame conversion failed: ${conversion.stderr}`);
	}
}

async function poll(label, read, predicate, timeoutMs) {
	const startedAt = Date.now();
	let value;
	while (Date.now() - startedAt < timeoutMs) {
		value = read();
		if (predicate(value)) return value;
		await new Promise((resolvePromise) => setTimeout(resolvePromise, 500));
	}
	throw new Error(`${label} timed out: ${JSON.stringify(value)}`);
}

runAgentBrowser(["set", "viewport", "1920", "1080"]);
runAgentBrowser([
	"open",
	`${url}${url.includes("?") ? "&" : "?"}v=${Date.now()}`,
]);
runAgentBrowser(["wait", "--load", "networkidle"]);

const boot = await poll(
	"game boot and interactable detection",
	() =>
		evalInBrowser(`
(() => {
	const anima = window.__anima;
	if (!anima?.scene?.getReviewQaSnapshot) return null;
	anima.scene.setPlacementDebugEnabled?.(false);
	anima.step(100);
	return anima.scene.getReviewQaSnapshot();
})()
`),
	(snapshot) => Boolean(snapshot?.interactables?.length),
	60_000,
);

const target = boot.interactables.find((interactable) =>
	interactable.name.toLowerCase().includes(requestedObject.toLowerCase()),
);
if (!target) {
	throw new Error(
		`Required object "${requestedObject}" is absent. Detected: ${boot.interactables
			.map((interactable) => interactable.name)
			.join(", ")}`,
	);
}

const [x0, y0, x1, y1] = target.bounds;
const clickX = Math.round(((x0 + x1) / 2) * 1920);
const clickY = Math.round(((y0 + y1) / 2) * 1080);
const beforeFrame = evalInBrowser(`window.__anima.captureFrame()`);
writeFrame("before.png", beforeFrame);

evalInBrowser(`
(() => {
	window.__anima.click(${clickX}, ${clickY});
	return window.__anima.scene.getReviewQaSnapshot();
})()
`);

await poll(
	"narrator choices",
	() =>
		evalInBrowser(`
(() => ({
	buttons: [...document.querySelectorAll(".open-world-prompt__options button")].map((button) => button.textContent),
	snapshot: window.__anima.scene.getReviewQaSnapshot(),
}))()
`),
	(value) => value.buttons.length === 3,
	60_000,
);

evalInBrowser(`
(() => {
	const input = document.querySelector("#open-world-free-text");
	if (!(input instanceof HTMLInputElement)) throw new Error("Free-text input unavailable");
	const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
	valueSetter?.call(input, ${JSON.stringify(exactChoice)});
	input.dispatchEvent(new Event("input", { bubbles: true }));
	return input.value;
})()
`);

await poll(
	"free-text input",
	() =>
		evalInBrowser(`
(() => ({
	value: document.querySelector("#open-world-free-text")?.value,
	disabled: document.querySelector('.open-world-prompt__free-text button[type="submit"]')?.disabled,
}))()
`),
	(value) => value.value === exactChoice && value.disabled === false,
	5_000,
);
evalInBrowser(`
(() => {
	const form = document.querySelector(".open-world-prompt__free-text");
	if (!(form instanceof HTMLFormElement)) throw new Error("Free-text form unavailable");
	form.requestSubmit();
	return true;
})()
`);

const resolved = await poll(
	"narrator resolution and background edit",
	() =>
		evalInBrowser(`
(() => {
	window.__anima.step(100);
	return window.__anima.scene.getReviewQaSnapshot();
})()
`),
	(snapshot) =>
		Boolean(snapshot.openWorld.caption) &&
		snapshot.backgroundTextureKey !== boot.backgroundTextureKey,
	180_000,
);

const afterFrame = evalInBrowser(`window.__anima.captureFrame()`);
writeFrame("after.png", afterFrame);

const walkTarget = evalInBrowser(`
(() => {
	const qa = window.__anima.scene.getReviewQaSnapshot();
	const candidates = [300, 520, 760, 1040, 1320, 1600];
	const y = 930;
	const x = candidates.find((candidate) => !qa.interactables.some(({ bounds }) => {
		const nx = candidate / 1920;
		const ny = y / 1080;
		return nx >= bounds[0] && nx <= bounds[2] && ny >= bounds[1] && ny <= bounds[3];
	}));
	if (!x) throw new Error("No free walking point outside interactable boxes");
	return { x, y };
})()
`);
const walk = evalInBrowser(`
(async () => {
	const anima = window.__anima;
	const beforeX = anima.scene.getReviewQaSnapshot().hermes.x;
	anima.click(${walkTarget.x}, ${walkTarget.y});
	await anima.waitUntil(() => {
		const hermes = anima.scene.getReviewQaSnapshot().hermes;
		return hermes.motionState === "idle" && Math.abs(hermes.x - beforeX) > 20;
	}, { timeoutMs: 20_000 });
	return { beforeX, after: anima.scene.getReviewQaSnapshot() };
})()
`);

if (!resolved.openWorld.caption)
	throw new Error("Resolution caption was empty");
if (resolved.backgroundTextureKey === boot.backgroundTextureKey) {
	throw new Error("Background texture key did not change");
}
if (Math.abs(walk.after.hermes.x - walk.beforeX) <= 20) {
	throw new Error("Hermes did not remain freely walkable after the edit");
}

const result = {
	url,
	requestedObject,
	detectedObject: target.name,
	exactChoice,
	click: { x: clickX, y: clickY },
	caption: resolved.openWorld.caption,
	imagePrompt: resolved.openWorld.imagePrompt,
	imageEditMs: resolved.openWorld.imageEditMs,
	backgroundBefore: boot.backgroundTextureKey,
	backgroundAfter: resolved.backgroundTextureKey,
	hermesWalk: { beforeX: walk.beforeX, afterX: walk.after.hermes.x },
	frames: {
		before: resolve(outputDir, "before.png"),
		after: resolve(outputDir, "after.png"),
	},
};
writeFileSync(
	resolve(outputDir, "playtest-result.json"),
	`${JSON.stringify(result, null, 2)}\n`,
);
console.log(JSON.stringify(result, null, 2));
