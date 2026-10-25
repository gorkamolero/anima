#!/usr/bin/env node
/**
 * Interpolate a sprite sheet to a higher drawing rate.
 *
 *   node scripts/interpolate-sheet.mjs <sheet-name> [--factor 4] [--resize 50] [--cols 12]
 *
 * Reads public/assets/sprites/hermes/<name>.{png,json} and writes <name>-<factor>x.{png,json}.
 * Frames are interpolated with ffmpeg's motion-compensated minterpolate. Colour
 * (premultiplied on black) and alpha are stacked into one image so they share
 * motion vectors; the loop wraps by appending the first frames. Contacts and
 * frame durations are interpolated linearly; switch and passing frames scale.
 * Frames are stored reduced (`--resize`) and the sheet records `pixelScale`.
 *
 * Requires ffmpeg and ImageMagick (magick) on PATH.
 */
import { execFileSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { basename, dirname, resolve } from "node:path";

const args = process.argv.slice(2);
const name = args.find((a) => !a.startsWith("--"));
if (!name) {
	console.error(
		"usage: interpolate-sheet.mjs <sheet-name> [--factor 4] [--resize 50] [--cols 12]",
	);
	process.exit(1);
}
const flag = (key, fallback) => {
	const i = args.indexOf(`--${key}`);
	return i >= 0 && args[i + 1] ? Number(args[i + 1]) : fallback;
};
const factor = flag("factor", 4);
const resize = flag("resize", 50);
const cols = flag("cols", 12);

// A bare name means the Hermes folder; a path with a slash names the sheet's own folder.
const spritesDir = name.includes("/")
	? dirname(resolve(name))
	: resolve(import.meta.dirname, "../public/assets/sprites/hermes");
const sheetName = basename(name);
const root = resolve(import.meta.dirname, "../../..");
const meta = JSON.parse(
	readFileSync(resolve(spritesDir, `${sheetName}.json`), "utf8"),
);
const image = resolve(spritesDir, meta.image ?? `${sheetName}.png`);
if (!existsSync(image)) throw new Error(`Missing ${image}`);
const { frameWidth: fw, frameHeight: fh, frameCount: n } = meta;
const srcCols = meta.cols ?? Math.floor(4096 / fw);
const fps = meta.fps;
const durations =
	meta.frameDurationsMs ?? Array.from({ length: n }, () => 1000 / fps);

const work = resolve(root, "tmp/interp", `${sheetName}-${factor}x`);
rmSync(work, { recursive: true, force: true });
for (const d of ["src", "stack", "out", "frames"])
	mkdirSync(resolve(work, d), { recursive: true });
const run = (cmd, argv) => {
	try {
		return execFileSync(cmd, argv, {
			stdio: ["ignore", "pipe", "pipe"],
		}).toString();
	} catch (error) {
		console.error(
			`${cmd} ${argv.join(" ")}\n${error.stderr?.toString() ?? error.message}`,
		);
		process.exit(1);
	}
};
const pad = (i) => String(i).padStart(3, "0");

// 1. Explode the sheet into its real frames, then stack colour over alpha.
for (let i = 0; i < n; i++) {
	const x = (i % srcCols) * fw;
	const y = Math.floor(i / srcCols) * fh;
	const src = resolve(work, "src", `f${pad(i)}.png`);
	run("magick", [image, "-crop", `${fw}x${fh}+${x}+${y}`, "+repage", src]);
}
// Optional registration for an unregistered source: shift every frame so the
// top of the figure sits on one row, and move that frame's contacts to match.
// Sources are registered by the sprite factory (`sprite-factory.py register`);
// `--stabilise` is only for an unregistered sheet handed in ad hoc.
const stabilise = args.includes("--stabilise");
const shifts = [];
if (stabilise) {
	const tops = [];
	for (let i = 0; i < n; i++) {
		const src = resolve(work, "src", `f${pad(i)}.png`);
		const page = run("magick", [
			src,
			"-alpha",
			"extract",
			"-threshold",
			"15%",
			"-format",
			"%@",
			"info:",
		]).trim();
		const m = /^(\d+)x(\d+)\+(\d+)\+(\d+)$/.exec(page);
		tops.push(m ? Number(m[4]) : 0);
	}
	const target = Math.round(tops.reduce((a, b) => a + b, 0) / tops.length);
	for (let i = 0; i < n; i++) {
		const dy = target - tops[i];
		shifts.push(dy);
		if (!dy) continue;
		const src = resolve(work, "src", `f${pad(i)}.png`);
		// Move the figure by dy without wrapping: pad one edge, trim the other.
		run("magick", [
			src,
			"-background",
			"none",
			...(dy > 0
				? [
						"-gravity",
						"north",
						"-splice",
						`0x${dy}`,
						"-gravity",
						"south",
						"-chop",
						`0x${dy}`,
					]
				: [
						"-gravity",
						"south",
						"-splice",
						`0x${-dy}`,
						"-gravity",
						"north",
						"-chop",
						`0x${-dy}`,
					]),
			"+repage",
			src,
		]);
	}
	console.log(
		`stabilised: head row ${Math.min(...tops)}..${Math.max(...tops)} -> ${target}; shifts ${shifts.join(",")}`,
	);
}

// Wrap: the interpolator needs frames after the last one to finish the loop.
const wrap = 3;
for (let i = 0; i < wrap; i++) {
	run("cp", [
		resolve(work, "src", `f${pad(i)}.png`),
		resolve(work, "src", `f${pad(n + i)}.png`),
	]);
}
for (let i = 0; i < n + wrap; i++) {
	const src = resolve(work, "src", `f${pad(i)}.png`);
	run("magick", [
		src,
		"(",
		"+clone",
		"-background",
		"black",
		"-alpha",
		"remove",
		"-alpha",
		"off",
		")",
		"(",
		"-clone",
		"0",
		"-alpha",
		"extract",
		")",
		"-delete",
		"0",
		"-append",
		resolve(work, "stack", `f${pad(i)}.png`),
	]);
}

// 2. Motion-compensated interpolation of the stacked frames at a nominal 30 fps.
run("ffmpeg", [
	"-y",
	"-loglevel",
	"error",
	"-framerate",
	"30",
	"-i",
	resolve(work, "stack", "f%03d.png"),
	"-vf",
	`format=rgb24,minterpolate=fps=${30 * factor}:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1`,
	"-pix_fmt",
	"rgb24",
	resolve(work, "out", "s%04d.png"),
]);

// 3. Split colour and alpha back, reduce, and tile.
const total = n * factor;
const tiles = [];
for (let k = 0; k < total; k++) {
	const stacked = resolve(
		work,
		"out",
		`s${String(k + 1).padStart(4, "0")}.png`,
	);
	if (!existsSync(stacked))
		throw new Error(`Interpolator stopped early at frame ${k}`);
	const frame = resolve(work, "frames", `k${String(k).padStart(4, "0")}.png`);
	run("magick", [
		stacked,
		"(",
		"-clone",
		"0",
		"-crop",
		`${fw}x${fh}+0+0`,
		"+repage",
		")",
		"(",
		"-clone",
		"0",
		"-crop",
		`${fw}x${fh}+0+${fh}`,
		"+repage",
		"-colorspace",
		"gray",
		")",
		"-delete",
		"0",
		"-alpha",
		"off",
		"-compose",
		"CopyOpacity",
		"-composite",
		// Interpolated frames come back with softer alpha edges than the source
		// drawings; firm them up so the silhouette does not pulse every nth frame.
		...(k % factor === 0
			? []
			: ["-channel", "A", "-sigmoidal-contrast", "7x50%", "+channel"]),
		"-resize",
		`${resize}%`,
		frame,
	]);
	tiles.push(frame);
}
// Measure the drawn body on the output frames: alignment data must describe
// the pixels that ship, not the source before registration and reduction.
const boxes = tiles
	.map((tile) => {
		const page = run("magick", [
			tile,
			"-alpha",
			"extract",
			"-threshold",
			"15%",
			"-format",
			"%@",
			"info:",
		]).trim();
		const m = /^(\d+)x(\d+)\+(\d+)\+(\d+)$/.exec(page);
		return m
			? { w: Number(m[1]), h: Number(m[2]), x: Number(m[3]), y: Number(m[4]) }
			: null;
	})
	.filter(Boolean);
const mean = (f) => boxes.reduce((a, b) => a + f(b), 0) / boxes.length;
const bodyCentreX = Math.round(mean((b) => b.x + b.w / 2) * 10) / 10;
const bodyCentreY = Math.round(mean((b) => b.y + b.h / 2) * 10) / 10;
const drawnHeight = Math.round(mean((b) => b.h) * 10) / 10;
// Bottom row of the drawn figure per frame: where the drawing puts the feet.
const soleRows = boxes.map((b) => b.y + b.h);
const pixelScale = resize / 100;
const outW = Math.round(fw * pixelScale);
const outH = Math.round(fh * pixelScale);
const rows = Math.ceil(total / cols);
const outName = `${sheetName}-${factor}x`;
run("magick", [
	"montage",
	...tiles,
	"-tile",
	`${cols}x${rows}`,
	"-geometry",
	`${outW}x${outH}+0+0`,
	"-background",
	"none",
	resolve(spritesDir, `${outName}.png`),
]);

// 4. Metadata: contacts and durations interpolated, frame indices scaled.
const contacts = [];
const frameDurationsMs = [];
for (let k = 0; k < total; k++) {
	const i = Math.floor(k / factor);
	const t = (k % factor) / factor;
	const shifted = (index) => {
		const c = meta.contacts[index];
		const dy = shifts[index] ?? 0;
		return {
			planted: c.planted,
			L: { x: c.L.x, y: c.L.y + dy },
			R: { x: c.R.x, y: c.R.y + dy },
		};
	};
	const a = shifted(i);
	const b = shifted((i + 1) % n);
	const lerp = (p, q) => ({
		x: Math.round((p.x * (1 - t) + q.x * t) * pixelScale * 100) / 100,
		y: Math.round((p.y * (1 - t) + q.y * t) * pixelScale * 100) / 100,
	});
	// Across a support switch the outgoing planted foot stays where it was
	// planted; only the incoming foot is in flight. Interpolating both would
	// slide the planted sole and inflate that stance's travel.
	const outgoing = a.planted !== b.planted ? a.planted : null;
	contacts.push({
		planted: a.planted,
		L: outgoing === "L" ? lerp(a.L, a.L) : lerp(a.L, b.L),
		R: outgoing === "R" ? lerp(a.R, a.R) : lerp(a.R, b.R),
	});
	frameDurationsMs.push(durations[i] / factor);
}
const scaleFrames = (list) => (list ?? []).map((f) => f * factor);
const out = {
	name: outName,
	image: `${outName}.png`,
	source: sheetName,
	interpolation: `ffmpeg minterpolate mci/aobmc/bidir, ${factor}x, colour and alpha stacked; frames stored at ${resize}%`,
	frameWidth: outW,
	frameHeight: outH,
	frameCount: total,
	cols,
	rows,
	fps: fps * factor,
	frameDurationsMs,
	contacts,
	switchFrames: scaleFrames(meta.switchFrames),
	passingFrames: scaleFrames(meta.passingFrames),
	...(meta.settleFrames
		? { settleFrames: scaleFrames(meta.settleFrames) }
		: {}),
	...(meta.matchedCut
		? {
				matchedCut: {
					standing: meta.matchedCut.standing,
					headings: meta.matchedCut.headings,
					exitFrames: scaleFrames(meta.matchedCut.exitFrames),
					entryFrames: scaleFrames(meta.matchedCut.entryFrames),
				},
			}
		: {}),
	bodyCentreX,
	bodyCentreY,
	drawnHeight,
	soleRows,
	pixelScale,
	...(stabilise ? { stabilisedShiftY: shifts } : {}),
};
writeFileSync(
	resolve(spritesDir, `${outName}.json`),
	`${JSON.stringify(out, null, "\t")}\n`,
);
console.log(
	`${outName}: ${total} frames ${outW}x${outH}, ${cols}x${rows} sheet, fps ${out.fps}`,
);
