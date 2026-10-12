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
		"(()=>{window.__anima?.step(6000);return window.__anima?.scene?.getReviewQaSnapshot()??null})()",
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
const callLedger = resolve(
	process.argv.find((x) => x.startsWith("--ledger="))?.slice(9) ??
		resolve(root, "api/data/calls.jsonl"),
);
const ledger = () =>
	existsSync(callLedger)
		? readFileSync(callLedger, "utf8")
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
	const data = evaluate('window.__anima.captureFrame({format:"png"})');
	const name = `${String(++index).padStart(2, "0")}-run${run}-${step}.png`;
	writeFileSync(resolve(out, name), Buffer.from(data.split(",")[1], "base64"));
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
	// Exercise the same pixel hit test and walk-to interaction as a player.
	evaluate(
		`(()=>{const s=window.__anima.scene;for(let y=60;y<950;y+=4)for(let x=0;x<1920;x+=4)if(s.findInteractableAtPoint(x,y)?.name===${JSON.stringify(object.name)}){window.__anima.click(x,y);return true;}throw new Error('No clickable pixel for object');})()`,
	);
	const options = await poll(
		"options",
		() =>
			evaluate(
				'(()=>{window.__anima.step(6000);return [...document.querySelectorAll(".open-world-prompt__options button")].map(b=>b.textContent)})()',
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
		g =
			before.generatedPlace?.ground ??
			(before.location === "outside"
				? JSON.parse(
						readFileSync(
							resolve(
								root,
								"adventures/shadow-over-innsmouth/public/backgrounds/bus-station-flat-v1.ground.json",
							),
							"utf8",
						),
					)
				: { ground: "authored", groundLine: { points: before.groundLine } });
	if (g?.ground !== "derived" && before.location !== "inside")
		throw new Error(`${step} ground is ${g?.ground}`);
	const line = g.groundLine.points;
	const floor = evaluate("window.__anima.scene.walkArea.mask");
	const interior = (p) =>
		[-16, 0, 16].every((dx) =>
			[-16, 0, 16].every((dy) => {
				const x = Math.floor(((p.x + dx) * floor.width) / 1920),
					y = Math.floor(((p.y + dy) * floor.height) / 1080);
				return (
					x >= 0 &&
					y >= 0 &&
					x < floor.width &&
					y < floor.height &&
					floor.data[y * floor.width + x]
				);
			}),
		);
	const hotspots = evaluate("window.__anima.snapshot().hotspots");
	const exits = evaluate("window.__anima.scene.sceneExits").map((e) => ({
		x: e.region.reduce((s, p) => s + p.x, 0) / e.region.length,
		y: e.region.reduce((s, p) => s + p.y, 0) / e.region.length,
	}));
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
				interior(p) &&
				p.x >= 100 &&
				p.x <= 1820 &&
				p.y < 948 &&
				exits.every((e) => Math.hypot(e.x - p.x, e.y - p.y) > 90) &&
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
	for (const [label, desired] of [
		["left", nearestCell(line[0])],
		["right", nearestCell(line.at(-1))],
		["far", far],
		["near", near],
	]) {
		// Ordinary floor walks must not intentionally cross a travel region.
		// Exits have their own assertions below; check the entire route, not
		// just its destination, now that travel triggers on entry.
		const candidates = [...allCells].sort(
			(a, b) =>
				Math.hypot(a.x - desired.x, a.y - desired.y) -
				Math.hypot(b.x - desired.x, b.y - desired.y),
		);
		const p = evaluate(`(()=>{const s=window.__anima.scene,h=s.hermesSprite;
			for(const p of ${JSON.stringify(candidates)}) {
				if(Math.hypot(p.x-h.x,p.y-h.y)<20)continue;
				const path=[{x:h.x,y:h.y},...s.previewWalk(p.x,p.y)];
				if(path.length<2)continue;
				let crosses=false;
				for(let i=1;i<path.length;i++) {
					const a=path[i-1],b=path[i],n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.y-a.y)/4));
					for(let j=1;j<=n;j++) {
						const x=a.x+(b.x-a.x)*j/n,y=a.y+(b.y-a.y)*j/n;
						if(s.sceneExits.some(e=>x>=Math.min(...e.region.map(p=>p.x))&&x<=Math.max(...e.region.map(p=>p.x))&&y>=Math.min(...e.region.map(p=>p.y))&&y<=Math.max(...e.region.map(p=>p.y))))crosses=true;
					}
				}
				if(!crosses)return p;
			}return null;})()`);
		if (!p)
			throw new Error(`${label}: no floor-only route without crossing an exit`);
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
			180000,
		);
		const h = s.hermes;
		const i =
			Math.floor((h.y / 1080) * floor.height) * floor.width +
			Math.floor((h.x / 1920) * floor.width);
		if (!floor.data[i]) throw new Error(`${label}: feet outside floor mask`);
		const { arrival, position } = evaluate(
			"(()=>{const s=window.__anima.scene;return {arrival:s.hermesMotor.snapshot().arrival,position:{x:s.hermesSprite.x,y:s.hermesSprite.y}}})()",
		);
		if (
			!arrival ||
			Math.hypot(arrival.target.x - expected.x, arrival.target.y - expected.y) >
				1.5 ||
			Math.hypot(position.x - arrival.target.x, position.y - arrival.target.y) >
				arrival.halfStride + 1e-6
		)
			throw new Error(`${label}: did not stop within half a drawn stride`);
		const atSwitch = evaluate(
			"(()=>{const s=window.__anima.scene,h=s.hermesSprite,m=s.cache.json.get(h.texture.key+'-meta');return m.switchFrames.includes(Number(h.frame.name));})()",
		);
		if (!atSwitch)
			throw new Error(`${label}: arrival did not hold a switch frame`);
		states.push({ label, ...h });
		await frame(`${step}-${label}`, { hermes: h });
	}
	if (states[3].scale <= states[2].scale)
		throw new Error("Scale did not grow toward camera");
	const art = await evaluate(
		`window.__anima.verifyArt(${JSON.stringify(before.generatedPlace ? `http://localhost:4317${before.generatedPlace.background.replace(".png", ".landmarks.json")}` : `backgrounds/${before.location === "outside" ? "bus-station-flat-v1" : "arkham-bus-depot-flat-2d"}.landmarks.json`)},{referenceCharacterId:'hermes'})`,
	);
	writeFileSync(resolve(out, `${step}-art.json`), JSON.stringify(art, null, 2));
	if (!art.pass) throw new Error("Art verification failed");
}
async function depotChecks() {
	const result = evaluate(`(()=>{
		const s=window.__anima.scene,k=s.katSeatedSprite,a=s.walkArea;
		const hotspots=s.getReviewQaSnapshot().hotspots;
		const expected=[['bus','van'],['waiting_bench','bench']];
		for(const [id,label] of expected){
			const h=hotspots.find(h=>h.id===id)?.bounds,o=s.objectLayers.find(l=>l.data.label===label)?.data.bbox;
			if(!h||!o||Math.abs(h.x-o.x)>2||Math.abs(h.y-o.y)>2||Math.abs(h.width-o.w)>2||Math.abs(h.height-o.h)>2)throw Error('Depot hotspot mismatch: '+id);
		}
		const door=hotspots.find(h=>h.id==='depot_doors').bounds;
		const label=s.interactables.find(o=>/depot door/i.test(o.name));
		if(!label||Math.abs(door.x-label.bounds[0]*1920)>2)throw Error('Door hotspot mismatch');
		const bench=s.objectLayers.find(l=>l.data.label==='bench').data;
		const baseline=Math.max(...bench.baseline.map(p=>p.y));
		const expectedScale=a.baseScale*a.perspective.slope*(baseline-a.perspective.horizonY);
		if(!k.visible||Math.abs(k.scaleX/expectedScale-1)>.03||Math.abs(k.depth-(10+k.y/20))>.01)throw Error('Kat placement/depth mismatch');
		return {kat:{x:k.x,y:k.y,scale:k.scaleX,depth:k.depth},hotspots};
	})()`);
	await frame("depot-hotspots-and-kat", result);
}
async function replayExit(id, destination, label) {
	const from = qa().location;
	evaluate(
		`(()=>{const s=window.__anima.scene,e=s.sceneExits.find(e=>e.id===${JSON.stringify(id)});if(!e||!e.to)throw Error('Missing saved exit');window.__anima.click(e.region.reduce((n,p)=>n+p.x,0)/e.region.length,e.region.reduce((n,p)=>n+p.y,0)/e.region.length);return true})()`,
	);
	await poll(
		label,
		qa,
		(x) =>
			x.location !== from &&
			!x.openWorld.busy &&
			x.hermes.motionState === "idle" &&
			x.interactables.length,
		180000,
	);
	if (destination && qa().location !== destination)
		throw Error(label + ": wrong destination");
	await frame(label);
}
async function replayTown() {
	// Replay persisted town connections, retaining the narrative/edit journey below
	// as the default creation test. This mode cannot create a substitute town.
	await depotChecks();
	await walkPlace("depot");
	await replayExit("edge-left", null, "road-arrival");
	const road = qa().location;
	await walkPlace("road");
	await replayExit("far", null, "alley-arrival");
	await walkPlace("alley");
	const parentExit = evaluate(
		`window.__anima.scene.sceneExits.find(e=>e.to===${JSON.stringify(road)})?.id`,
	);
	await replayExit(parentExit, road, "road-return");
	const depotExit = evaluate(
		"window.__anima.scene.sceneExits.find(e=>e.to==='outside')?.id",
	);
	await replayExit(depotExit, "outside", "depot-return");
	await replayExit("depot_doors", "inside", "inside-arrival");
	await walkPlace("inside");
	await replayExit("bus_platform", "outside", "depot-final");
	await depotChecks();
	const uncached = ledger()
		.slice(baseline)
		.filter((c) => !c.cached);
	if (uncached.length)
		throw Error("Town replay made " + uncached.length + " uncached calls");
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
	if (process.argv.includes("--replay")) {
		await replayTown();
		report();
		console.log("PASS saved town replay: 0 uncached calls");
		process.exit(0);
	}
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
		const sourceLocation = qa().location;
		evaluate(
			"(()=>{const s=window.__anima.scene,e=s.sceneExits.find(e=>e.to===s.generatedPlace?.parent);if(!e)throw new Error('Missing return exit');const x=e.region.reduce((s,p)=>s+p.x,0)/e.region.length,y=e.region.reduce((s,p)=>s+p.y,0)/e.region.length;window.__anima.click(x,y);return true})()",
		);
		await poll(
			"parent",
			qa,
			(x) =>
				x.location !== sourceLocation &&
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
