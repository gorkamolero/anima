#!/usr/bin/env node
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../../", import.meta.url));
const out = resolve(root, "tmp/open-world-demo");
mkdirSync(out, { recursive: true });
const demoUrl = new URL(
	process.argv.find((x) => x.startsWith("http")) ?? "http://localhost:8080/",
);
demoUrl.searchParams.set("mute", "1");
const url = demoUrl.href;
const run = Number(
	process.argv.find((x) => x.startsWith("--run="))?.split("=")[1] ?? 1,
);
const session = "anima-town";
function browser(args, input) {
	const r = spawnSync("agent-browser", ["--session", session, ...args], {
		input,
		encoding: "utf8",
		maxBuffer: 64 * 1024 * 1024,
	});
	if (r.status !== 0) throw new Error(r.stderr || r.stdout);
	return r.stdout.trim();
}
function evaluate(source) {
	return JSON.parse(browser(["eval", "--stdin"], source));
}
const qa = () =>
	evaluate(
		"(()=>{window.__anima?.step(600);return window.__anima?.scene?.getReviewQaSnapshot()??null})()",
	);
async function poll(label, fn, predicate, timeout = 240000) {
	const start = Date.now();
	while (Date.now() - start < timeout) {
		const value = fn();
		if (value?.openWorld && !value.openWorld.muted)
			throw new Error("Development run is not muted");
		if (predicate(value)) return value;
		const error = evaluate(
			'document.querySelector(".open-world-prompt__error")?.textContent??null',
		);
		if (error) throw new Error(`${label}: ${error}`);
		await new Promise((r) => setTimeout(r, 300));
	}
	throw new Error(`${label} timed out`);
}
const records = [];
let index = 0;
const ledger = () =>
	existsSync(resolve(root, "api/data/calls.jsonl"))
		? readFileSync(resolve(root, "api/data/calls.jsonl"), "utf8")
				.trim()
				.split("\n")
				.filter(Boolean)
				.map((x) => JSON.parse(x))
		: [];
const baseline = ledger().length;
function report(error) {
	const calls = ledger().slice(baseline);
	const record = { run, muted: true, records, calls, error };
	writeFileSync(
		resolve(out, `run-${run}.json`),
		JSON.stringify(record, null, 2),
	);
	const paths = [1, 2]
		.map((n) => resolve(out, `run-${n}.json`))
		.filter(existsSync);
	const runs = paths.map((p) => JSON.parse(readFileSync(p, "utf8")));
	let md =
		"# Open-world journey\n\nVoice muted with ?mute=1 for development: no TTS fetching or audio playback. Voice is on by default for players. Calls below are wall-clock timings; attempt rows reserve budget, not extra completed calls. Run 1 can reuse caches from interrupted development.\n\n";
	for (const r of runs) {
		md += `## Run ${r.run}\n\n${r.error ?? "PASS"}\n\n`;
		for (const step of r.records)
			md += `### ${step.step} (${step.ms} ms)\n\nAction: ${step.choice ?? "walk / observe"}\n\n${step.caption ?? ""}\n\nDelta: ${step.delta ?? "—"}; travel: ${JSON.stringify(step.travel ?? null)}\n\nFrame: ${step.frame}\n\n`;
		md +=
			"Calls:\n\n" +
			r.calls
				.map((c) => `- ${c.kind}: ${c.ms} ms${c.cached ? " (cache hit)" : ""}`)
				.join("\n") +
			"\n\n";
		const cacheable = r.calls.filter((c) =>
			[
				"image",
				"perception",
				"narrate-options",
				"narrate-resolve",
				"place",
				"interactables",
			].includes(c.kind),
		);
		md += `Cache hit rate: ${cacheable.filter((c) => c.cached).length}/${cacheable.length} (${((100 * cacheable.filter((c) => c.cached).length) / Math.max(1, cacheable.length)).toFixed(1)}%). Denominator: narrator, interactables, image, perception and place cache lookups recorded by the pipeline; budget reservations and judge calls are excluded.\n\n`;
		const places = new Map(
			r.records.filter((s) => s.place).map((s) => [s.place.id, s.place]),
		);
		for (const p of places.values())
			md += `Place ${p.id}: ${p.ground}; judges ${p.verdicts.map((v) => (v.pass ? "PASS" : "FAIL")).join(", ")}.\n\n${p.verdicts.map((v) => `- ${v.why}`).join("\n")}\n\n`;
	}
	const all = ledger();
	md += `Task totals: image-edit attempts ${all.filter((c) => c.kind === "image-attempt").length}/50; perception attempts ${all.filter((c) => c.kind === "perception-attempt").length}/200.\n`;
	writeFileSync(resolve(out, "journey.md"), md);
}
async function frame(step, extra = {}) {
	const data = evaluate("window.__anima.captureFrame()");
	const name = `${String(++index).padStart(2, "0")}-run${run}-${step}.png`;
	const r = spawnSync("magick", ["jpeg:-", resolve(out, name)], {
		input: Buffer.from(data.split(",")[1], "base64"),
	});
	if (r.status !== 0) throw new Error("Frame conversion failed");
	records.push({ step, frame: name, ms: 0, ...extra });
	report();
	console.log(step, extra.caption ?? "");
}
function target(snapshot) {
	const byArea = [...snapshot.interactables].sort(
		(a, b) =>
			(b.bounds[2] - b.bounds[0]) * (b.bounds[3] - b.bounds[1]) -
			(a.bounds[2] - a.bounds[0]) * (a.bounds[3] - a.bounds[1]),
	);
	return (
		byArea.find((x) =>
			/bench|sign|board|door|crate|barrel|lamp/i.test(x.name),
		) ?? byArea[0]
	);
}
async function action(step, choice, pick = false) {
	const start = Date.now();
	const before = qa();
	const object =
		(step === "alley"
			? before.interactables.find((x) => /house|building/i.test(x.name))
			: undefined) ?? target(before);
	if (!object) throw new Error("No clickable objects");
	// Use the scene API through __anima, with the actual returned object, so large floor boxes do not intercept a debug click.
	evaluate(
		`void window.__anima.scene.requestNarrationOptions(${JSON.stringify(object)});true`,
	);
	const options = await poll(
		"options",
		() =>
			evaluate(
				'[...document.querySelectorAll(".open-world-prompt__options button")].map(b=>b.textContent)',
			),
		(x) => x.length === 3,
		90000,
	);
	if (pick) choice = options[0];
	evaluate(
		`window.dispatchEvent(new CustomEvent('anima:open-world-choice',{detail:{choice:${JSON.stringify(choice)}}}));true`,
	);
	const after = await poll(
		step,
		qa,
		(x) =>
			x &&
			!x.openWorld.busy &&
			x.openWorld.resolution?.caption &&
			x.openWorld.resolution !== null &&
			x.openWorld.world.history.at(-1)?.choice === choice,
		360000,
	);
	const r = after.openWorld.resolution;
	await frame(step, {
		choice,
		object: object.name,
		caption: r.caption,
		delta: r.visual.delta,
		travel: r.travel,
		place: after.generatedPlace
			? {
					id: after.generatedPlace.id,
					ground: after.generatedPlace.ground.ground,
					verdicts: after.generatedPlace.ground.verdicts,
				}
			: undefined,
		ms: Date.now() - start,
	});
	return after;
}
async function walkPlace(step) {
	const before = qa(),
		g = before.generatedPlace?.ground;
	if (g?.ground !== "derived")
		throw new Error(`${step} ground is ${g?.ground}`);
	const line = g.groundLine.points;
	const floor = g.floor;
	const hotspots = evaluate("window.__anima.snapshot().hotspots");
	const allCells = floor.data
		.map((v, i) =>
			v
				? {
						x: (((i % floor.width) + 0.5) * 1920) / floor.width,
						y: ((Math.floor(i / floor.width) + 0.5) * 1080) / floor.height,
					}
				: null,
		)
		.filter(Boolean)
		.filter(
			(p) =>
				p.x >= 35 &&
				p.y < 964 &&
				!before.interactables.some(
					(o) =>
						p.x >= o.bounds[0] * 1920 &&
						p.x <= o.bounds[2] * 1920 &&
						p.y >= o.bounds[1] * 1080 &&
						p.y <= o.bounds[3] * 1080,
				) &&
				!hotspots.some(
					(o) =>
						p.x >= o.bounds.x &&
						p.x <= o.bounds.x + o.bounds.width &&
						p.y >= o.bounds.y &&
						p.y <= o.bounds.y + o.bounds.height,
				),
		);
	// The scene clips the floor above the caption panel; aim line ends at the nearest walkable cell.
	const nearestCell = (p) =>
		allCells.reduce((a, b) =>
			Math.hypot(b.x - p.x, b.y - p.y) < Math.hypot(a.x - p.x, a.y - p.y)
				? b
				: a,
		);
	const cells = allCells.filter((p) => p.x > 300 && p.x < 1500 && p.y < 990);
	cells.sort((a, b) => a.y - b.y);
	const far = cells[Math.floor(cells.length * 0.15)],
		near = cells[Math.floor(cells.length * 0.85)];
	const states = [];
	for (const [label, p] of [
		["left", nearestCell(line[0])],
		["right", nearestCell(line.at(-1))],
		["far", far],
		["near", near],
	]) {
		const expected = evaluate(
			`window.__anima.scene.previewWalk(${p.x},${p.y}).at(-1)`,
		);
		if (!expected) throw new Error(`${label}: no reachable floor`);
		evaluate(`window.__anima.click(${p.x},${p.y});true`);
		const s = await poll(
			"walk",
			qa,
			(x) =>
				x?.hermes.motionState === "idle" &&
				!evaluate("window.__anima.snapshot().inputBlocked"),
			60000,
		);
		const h = s.hermes;
		const i =
			Math.floor((h.y / 1080) * floor.height) * floor.width +
			Math.floor((h.x / 1920) * floor.width);
		if (!floor.data[i]) throw new Error(`${label}: feet outside floor mask`);
		if (Math.hypot(h.x - expected.x, h.y - expected.y) > 2)
			throw new Error(`${label}: did not reach requested walk point`);
		states.push({ label, ...h });
		await frame(`${step}-${label}`, { hermes: h });
	}
	if (states[3].scale <= states[2].scale)
		throw new Error("Scale did not grow toward camera");
	const art = await evaluate(
		`window.__anima.verifyArt(${JSON.stringify(`http://localhost:4317${before.generatedPlace.background.replace(".png", ".landmarks.json")}`)},{referenceCharacterId:'hermes'})`,
	);
	writeFileSync(resolve(out, `${step}-art.json`), JSON.stringify(art, null, 2));
	if (!art.pass) throw new Error("Art verification failed");
}
try {
	browser(["set", "viewport", "1920", "1080"]);
	browser(["open", url]);
	browser(["wait", "--load", "networkidle"]);
	await poll(
		"boot",
		qa,
		(x) => x?.interactables.length && !x.openWorld.busy,
		90000,
	);
	const sessionId = `town-demo-${run}-${Date.now()}`;
	evaluate(
		`localStorage.setItem("anima.world.session",${JSON.stringify(sessionId)});location.reload();true`,
	);
	browser(["wait", "--load", "networkidle"]);
	await poll(
		"fresh world",
		qa,
		(x) =>
			x?.interactables.length &&
			!x.openWorld.busy &&
			x.openWorld.sessionId === sessionId,
		90000,
	);
	browser(["click", "button.review-panel__toggle"]);
	browser(["click", "button.review-panel__toggle"]);
	evaluate("window.__anima.scene.setPlacementDebugEnabled(false);true");
	await frame("start");
	const originalDepotImage = qa().backgroundTextureKey;
	const changed = await action(
		"changed-depot",
		"I paint a large red spiral on this object, clearly visible from across the platform.",
	);
	if (
		changed.openWorld.resolution.visual.delta !== "new" ||
		changed.backgroundTextureKey === originalDepotImage
	)
		throw new Error("No visible depot change");
	const depotImage = changed.backgroundTextureKey;
	const place1 = await action(
		"road",
		"I follow the road out of town toward Innsmouth.",
	);
	if (!place1.generatedPlace || place1.backgroundTextureKey === depotImage)
		throw new Error("Travel failed");
	await walkPlace("road");
	const place2 = await action("alley", "I go down the alley beside this road.");
	if (place2.location === place1.location)
		throw new Error("Second place missing");
	await walkPlace("alley");
	await action("chosen-option", "", true);
	const originalAlleyImage = qa().backgroundTextureKey;
	const changedAlley = await action(
		"changed-alley",
		"I use red paint to draw a large permanent spiral across this object. I am painting now, not repeating my previous action; the red mark is plainly visible.",
	);
	if (
		changedAlley.openWorld.resolution.visual.delta !== "new" ||
		changedAlley.backgroundTextureKey === originalAlleyImage
	)
		throw new Error("No visible alley change");
	const imageCount = ledger().filter((c) => c.kind === "image-attempt").length;
	for (let i = 0; i < 3 && qa().location !== "outside"; i++) {
		evaluate("window.__anima.click(10,930);true");
		await poll(
			"parent",
			qa,
			(x) =>
				!x.openWorld.busy &&
				x.hermes.motionState === "idle" &&
				x.interactables.length,
			90000,
		);
		await frame(`return-${i}`);
	}
	const returned = qa();
	if (
		returned.location !== "outside" ||
		returned.backgroundTextureKey !== depotImage
	)
		throw new Error("Depot change was not restored");
	if (ledger().filter((c) => c.kind === "image-attempt").length !== imageCount)
		throw new Error("Return generated an image");
	evaluate("location.reload();true");
	await poll(
		"reload",
		qa,
		(x) => x && !x.openWorld.busy && x.interactables.length,
		90000,
	);
	if (
		qa().location !== "outside" ||
		qa().openWorld.sessionId !== sessionId ||
		JSON.stringify(qa().openWorld.world.visual) !==
			JSON.stringify(returned.openWorld.world.visual) ||
		qa().backgroundTextureKey !== depotImage
	)
		throw new Error("Reload lost image");
	await frame("reload");
	await action(
		"inside",
		"I walk through the depot doors into the depot interior.",
	);
	if (qa().location !== "inside") throw new Error("Did not enter inside");
	await action("inside-option", "", true);
	await frame("finish");
	const speechRequests = evaluate(
		'performance.getEntriesByType("resource").filter(r => /\\/tts(?:[?\\/]|$)|elevenlabs/i.test(r.name)).length',
	);
	if (
		speechRequests ||
		ledger()
			.slice(baseline)
			.some((c) => c.kind === "tts")
	)
		throw new Error("Muted demo made speech requests");
	report();
	const frames = records.map((r) => resolve(out, r.frame));
	const args = ["-y", "-filter_complex_threads", "1"];
	for (const path of frames) args.push("-loop", "1", "-t", "2.5", "-i", path);
	let filter = "";
	for (let i = 0; i < frames.length; i++)
		filter += `[${i}:v]scale=1280:720,fps=30,format=yuv420p,settb=AVTB[v${i}];`;
	let previous = "v0";
	for (let i = 1; i < frames.length; i++) {
		filter += `[${previous}][v${i}]xfade=transition=fade:duration=0.35:offset=${(i * 2.15).toFixed(2)}[f${i}];`;
		previous = `f${i}`;
	}
	args.push(
		"-filter_complex",
		filter.slice(0, -1),
		"-map",
		`[${previous}]`,
		"-c:v",
		"libx264",
		"-threads",
		"2",
		"-pix_fmt",
		"yuv420p",
		resolve(out, "journey.mp4"),
	);
	const video = spawnSync("ffmpeg", args, {
		encoding: "utf8",
		maxBuffer: 1024 * 1024 * 16,
	});
	if (video.status !== 0) throw new Error(video.stderr.slice(-2000));
	console.log("PASS", resolve(out, "journey.md"));
} catch (error) {
	report(error.message);
	console.error(error);
	process.exitCode = 1;
}
