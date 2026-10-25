#!/usr/bin/env node
/**
 * One image in, a walking character out.
 *
 *   node scripts/make-character.mjs <spec.json> [--stage keyframes|videos|sheets|standing|all]
 *                                   [--model flux|veo|seedance] [--only side,away,...]
 *
 * spec.json:
 *   {
 *     "name": "kat",
 *     "concept": "...",            // optional: draw the source image from this text when it is missing
 *     "styleRefs": ["docs/art/@hermes.jpeg"],
 *     "source": "sources/innsmouth/kat-neutral-source-candidate.png",   // approved standing image
 *     "refs": ["docs/art/@kat.jpeg"],                                   // extra identity references
 *     "description": "slim young woman, short messy black hair, ...",   // what must stay identical
 *     "pronoun": "she",
 *     "carried": "the backpack stays on her back",                      // or ""
 *     "out": "output/characters/kat",
 *     "sprites": "../../adventures/shadow-over-innsmouth/public/assets/sprites/kat"
 *   }
 *
 * Stages (each skips work whose output already exists):
 *   source     draw the approved image from `concept` when none exists (house style refs)
 *   keyframes  direction stills from the source via fal-ai/nano-banana-2/edit
 *   videos     in-place walk clips per direction via scripts/video-generate.ts
 *   sheets     scripts/walk-sheet.sh per direction: matte, gait cut, audits, contacts, 4x
 *   standing   one standing sheet per direction from the stride's feet-together frame
 * Every sheet must pass audit-drift and audit-steps; the stage fails loudly if one does not.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync, copyFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const tools = resolve(here, "..");
const args = process.argv.slice(2);
const specPath = args.find((a) => !a.startsWith("--"));
if (!specPath) throw new Error("usage: make-character.mjs <spec.json> [--stage ...] [--model ...] [--only ...]");
const flag = (k, d) => { const i = args.indexOf(`--${k}`); return i >= 0 && args[i + 1] ? args[i + 1] : d; };
const stage = flag("stage", "all");
const model = flag("model", "flux");
const only = flag("only", "").split(",").filter(Boolean);
const spec = JSON.parse(readFileSync(specPath, "utf8"));
const out = resolve(tools, spec.out);
const sprites = resolve(tools, spec.sprites);
mkdirSync(out, { recursive: true });
mkdirSync(sprites, { recursive: true });
const he = spec.pronoun ?? "he";
const him = he === "she" ? "her" : he === "they" ? "them" : "him";
const his = he === "she" ? "her" : he === "they" ? "their" : "his";

/** Drawn directions. `facing` is the side the front foot is on in the drawing. */
const DIRECTIONS = {
	side: {
		keyframe: null, // the source image itself
		view: "pure side view, profile facing left",
		motion: `walks steadily to the left, ${"pure side view throughout, profile facing left"}. Camera tracks sideways with ${him} at exactly the same speed`,
		facing: "left",
	},
	away: {
		keyframe: "Perfectly straight BACK VIEW, looking directly away from camera, back of head visible, NO face visible.",
		motion: `walks steadily directly away from the camera, pure back view throughout. Camera dollies forward with ${him} at exactly the same speed`,
		facing: "left",
	},
	toward: {
		keyframe: "Perfectly straight FRONT VIEW, facing directly toward camera, both eyes visible symmetrically, neutral expression.",
		motion: `walks steadily directly toward the camera, pure front view throughout. Camera dollies backward with ${him} at exactly the same speed`,
		facing: "left",
	},
	awayDiagonal: {
		keyframe: "THREE-QUARTER BACK VIEW, body turned 45 degrees away from camera toward the right, back and right side visible, face mostly hidden.",
		motion: `walks steadily away from the camera and to the right, a three-quarter back view at a 45 degree angle, held throughout. Camera tracks with ${him} at exactly the same speed`,
		facing: "right",
	},
	towardDiagonal: {
		keyframe: "THREE-QUARTER FRONT VIEW, body turned 45 degrees toward the camera and to the right, face and right side visible.",
		motion: `walks steadily toward the camera and to the right, a three-quarter front view at a 45 degree angle, held throughout. Camera tracks with ${him} at exactly the same speed`,
		facing: "right",
	},
};
const wanted = Object.keys(DIRECTIONS).filter((d) => !only.length || only.includes(d));
const log = (m) => console.log(`[${spec.name}] ${m}`);
const run = (cmd, argv, opts = {}) => {
	const r = spawnSync(cmd, argv, { cwd: tools, stdio: "inherit", ...opts });
	if (r.status !== 0) throw new Error(`${cmd} ${argv.join(" ")} failed (${r.status})`);
};

// ------------------------------------------------------------------- source
/** No approved image yet: draw the character from `concept` in the house style,
 * using the style references, as a neutral full-body standing still. */
async function source() {
	const target = resolve(tools, spec.source);
	if (existsSync(target)) { log("source: reusing"); return; }
	if (!spec.concept) throw new Error("spec needs a `concept` to draw a source image");
	const { fal } = await import("@fal-ai/client");
	fal.config({ credentials: process.env.FAL_KEY });
	const refFiles = (spec.styleRefs ?? []).map((p) => resolve(tools, p));
	const urls = await Promise.all(refFiles.map(async (p) => fal.storage.upload(new Blob([readFileSync(p)], { type: p.endsWith(".jpeg") || p.endsWith(".jpg") ? "image/jpeg" : "image/png" }))));
	const prompt = `Create exactly ONE full-body character still of a NEW character in the same art style as the reference images: clean hand-inked painterly cartoon rendering, fine fabric texture, muted colours. The character: ${spec.concept} Standing relaxed upright, three-quarter view facing slightly left, arms down, feet slightly apart, neutral expression. Full body and all shoes visible. Centered figure occupies 82 percent of portrait image height, generous empty margin. Plain uniform #828282 gray background, no floor, no shadows, no text, no extra figures.`;
	mkdirSync(dirname(target), { recursive: true });
	log("source: fal-ai/nano-banana-2/edit (new character in house style)");
	const r = await fal.subscribe("fal-ai/nano-banana-2/edit", { input: { prompt, image_urls: urls, aspect_ratio: "9:16", num_images: 1, output_format: "png", limit_generations: true } });
	const res = await fetch(r.data.images[0].url);
	writeFileSync(target, new Uint8Array(await res.arrayBuffer()));
	writeFileSync(`${target}.manifest.json`, JSON.stringify({ model: "fal-ai/nano-banana-2/edit", requestId: r.requestId, styleReferences: refFiles, prompt }, null, 2));
}

// ---------------------------------------------------------------- keyframes
async function keyframes() {
	const { fal } = await import("@fal-ai/client");
	fal.config({ credentials: process.env.FAL_KEY });
	const dir = resolve(out, "keyframes");
	mkdirSync(dir, { recursive: true });
	const refFiles = [spec.source, ...(spec.refs ?? [])].map((p) => resolve(tools, p));
	let urls;
	for (const d of wanted) {
		const target = resolve(dir, `${d}.png`);
		if (existsSync(target)) { log(`keyframe ${d}: reusing`); continue; }
		if (!DIRECTIONS[d].keyframe) { copyFileSync(resolve(tools, spec.source), target); log(`keyframe ${d}: source image`); continue; }
		urls ??= await Promise.all(refFiles.map(async (p) => fal.storage.upload(new Blob([readFileSync(p)], { type: p.endsWith(".jpeg") || p.endsWith(".jpg") ? "image/jpeg" : "image/png" }))));
		const prompt = `Create exactly ONE full-body character turnaround still of this character from these references. The first image is the authoritative in-game character: match ${his} proportions exactly. ${spec.description} Same clean hand-inked painterly cartoon rendering, same colors, no redesign. ${DIRECTIONS[d].keyframe} Standing relaxed upright, arms down, feet slightly apart. Full body and all shoes visible. Centered figure occupies 82 percent of portrait image height, generous empty margin. Plain uniform #828282 gray background, no floor, no shadows, no text, no extra figures.`;
		log(`keyframe ${d}: fal-ai/nano-banana-2/edit`);
		const r = await fal.subscribe("fal-ai/nano-banana-2/edit", { input: { prompt, image_urls: urls, aspect_ratio: "9:16", num_images: 1, output_format: "png", limit_generations: true } });
		const res = await fetch(r.data.images[0].url);
		writeFileSync(target, new Uint8Array(await res.arrayBuffer()));
		writeFileSync(`${target}.manifest.json`, JSON.stringify({ model: "fal-ai/nano-banana-2/edit", requestId: r.requestId, references: refFiles, prompt }, null, 2));
	}
}

// ------------------------------------------------------------------- videos
function videos() {
	for (const d of wanted) {
		const dir = resolve(out, "videos", d);
		mkdirSync(dir, { recursive: true });
		const raw = resolve(dir, "raw.mp4");
		if (existsSync(raw)) { log(`video ${d}: reusing`); continue; }
		const prompt = `This exact character ${DIRECTIONS[d].motion}: ${he} stays centered and the SAME SIZE in frame throughout, no shrinking, no enlargement, no drift. Walking IN PLACE for a looping game sprite. Full body visible, shoes always in frame. Natural, even, symmetrical heel-to-toe walking gait, both steps identical in length and timing, arms swing in opposition, subtle body bob${spec.carried ? `, ${spec.carried}` : ""}. Start walking immediately and continue steadily for the whole clip. Preserve identical face, hair, outfit and proportions. Never turn or rotate. Flat uniform gray background, no floor line, no shadows, no props, no scene. No audio.`;
		writeFileSync(resolve(dir, "prompt.txt"), prompt);
		log(`video ${d}: ${model}`);
		run("npx", ["tsx", "scripts/video-generate.ts", "--model", model, "--image", resolve(out, "keyframes", `${d}.png`), "--prompt", prompt, "--aspect", "9:16", "--duration", "8", "--resolution", "720p", "--output", raw]);
	}
}

// ------------------------------------------------------------------- sheets
function sheets() {
	for (const d of wanted) {
		const base = resolve(sprites, `${spec.name}-walk-${d}`);
		if (existsSync(`${base}-4x.json`)) { log(`sheet ${d}: reusing`); continue; }
		log(`sheet ${d}: walk-sheet.sh`);
		run("bash", ["scripts/walk-sheet.sh", resolve(out, "videos", d, "raw.mp4"), base, DIRECTIONS[d].facing, "24", "36"]);
	}
}

// ----------------------------------------------------------------- standing
function standing() {
	for (const d of wanted) {
		const base = resolve(sprites, `${spec.name}-walk-${d}`);
		const target = resolve(sprites, `${spec.name}-stand-${d}`);
		if (existsSync(`${target}.json`)) { log(`standing ${d}: reusing`); continue; }
		const meta = JSON.parse(readFileSync(`${base}.json`, "utf8"));
		// Feet together: the frame where the two soles are closest.
		let best = 0, bestSpread = Infinity;
		meta.contacts.forEach((c, i) => { const s = Math.abs(c.L.x - c.R.x); if (s < bestSpread) { bestSpread = s; best = i; } });
		const { frameWidth: w, frameHeight: h, cols } = meta;
		const x = (best % cols) * w, y = Math.floor(best / cols) * h;
		execFileSync("magick", [resolve(sprites, meta.image), "-crop", `${w}x${h}+${x}+${y}`, "+repage", `${target}.png`]);
		// Measure the drawn figure of that frame: the feet row and body centre come
		// from the pixels, never from a tracked contact.
		const page = execFileSync("magick", [`${target}.png`, "-alpha", "extract", "-threshold", "15%", "-format", "%@", "info:"]).toString().trim();
		const mm = /^(\d+)x(\d+)\+(\d+)\+(\d+)$/.exec(page);
		const box = mm ? { w: +mm[1], h: +mm[2], x: +mm[3], y: +mm[4] } : { w, h, x: 0, y: 0 };
		const soleY = box.y + box.h;
		const cx = box.x + box.w / 2;
		writeFileSync(`${target}.json`, `${JSON.stringify({
			name: `${spec.name}-stand-${d}`, image: `${spec.name}-stand-${d}.png`, frameWidth: w, frameHeight: h, frameCount: 1, cols: 1, rows: 1, fps: 1,
			contacts: [{ planted: "L", L: { x: cx - box.w * 0.08, y: soleY }, R: { x: cx + box.w * 0.08, y: soleY } }], switchFrames: [0],
			source: { sheet: meta.name, frame: best, frameCount: meta.frameCount, method: "feet-together frame of the stride; feet row and body centre measured from pixels" },
			bodyCentreX: cx, bodyCentreY: box.y + box.h / 2, drawnHeight: box.h, pixelScale: meta.pixelScale ?? 1,
		}, null, "\t")}\n`);
		log(`standing ${d}: frame ${best} (spread ${bestSpread.toFixed(0)} px)`);
	}
}

const stages = { source, keyframes, videos, sheets, standing };
const order = stage === "all" ? Object.keys(stages) : [stage];
for (const s of order) await stages[s]();
const map = Object.fromEntries(wanted.map((d) => [d, { walk: `${spec.name}-walk-${d}-4x`, stand: `${spec.name}-stand-${d}` }]));
writeFileSync(resolve(out, "sheets.json"), `${JSON.stringify(map, null, 2)}\n`);
log(`done: ${resolve(out, "sheets.json")}`);
