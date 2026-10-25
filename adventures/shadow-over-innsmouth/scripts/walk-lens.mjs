#!/usr/bin/env node
/**
 * Walk lens: turn an in-game recording (`window.__anima.record`) into things a
 * person can actually judge.
 *
 *   node scripts/walk-lens.mjs <name> [--every N] [--slow 4]
 *
 * Reads tmp/recordings/<name>.webm + <name>.json and writes tmp/recordings/<name>/:
 *   frames/NNNN.png      every video frame at full resolution
 *   fixed-strip.png      fixed-camera crops of the walked region, every N frames
 *   stabilised-strip.png crops centred on the character, every N frames
 *   slowmo.mp4 / .gif    the walked region at 1/slow speed, 2x magnified
 *   realtime.mp4         the walked region at real speed
 *   report.txt           per-frame body motion, drawing holds, lateral sole slide
 *
 * --resume reuses complete frames and verified MP4s newer than the source.
 * --skip-gif omits the optional memory-heavy GIF.
 *
 * Requires ffmpeg and ImageMagick (magick) on PATH.
 */
import { execFileSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { resolve } from "node:path";

const args = process.argv.slice(2);
const name = args.find((a) => !a.startsWith("--"));
if (!name) {
	console.error("usage: walk-lens.mjs <recording-name> [--every N] [--slow S]");
	process.exit(1);
}
const flag = (key, fallback) => {
	const i = args.indexOf(`--${key}`);
	return i >= 0 && args[i + 1] ? Number(args[i + 1]) : fallback;
};
const every = flag("every", 3);
const slow = flag("slow", 4);

const root = resolve(import.meta.dirname, "../../..");
const dir = resolve(root, "tmp/recordings");
const video = ["webm", "mp4"]
	.map((e) => resolve(dir, `${name}.${e}`))
	.find(existsSync);
const telemetryPath = resolve(dir, `${name}.json`);
if (!video || !existsSync(telemetryPath)) {
	console.error(`Missing ${name}.webm/.mp4 or ${name}.json in ${dir}`);
	process.exit(1);
}
const out = resolve(dir, name);
const framesDir = resolve(out, "frames");
mkdirSync(framesDir, { recursive: true });

const FONT = [
	"/System/Library/Fonts/Supplemental/Arial.ttf",
	"/System/Library/Fonts/Helvetica.ttc",
	"/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
].find(existsSync);
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

// 1. Every frame, full resolution, with its presentation time.
const resume = args.includes("--resume");
const decode = () =>
	run("ffmpeg", [
		"-y",
		"-loglevel",
		"error",
		"-i",
		video,
		"-fps_mode",
		"passthrough",
		resolve(framesDir, "%04d.png"),
	]);
if (!resume) decode();
const pts = run("ffprobe", [
	"-v",
	"error",
	"-select_streams",
	"v:0",
	"-show_entries",
	"frame=pts_time",
	"-of",
	"csv=p=0",
	video,
])
	.trim()
	.split("\n")
	.map(Number)
	.filter((v) => Number.isFinite(v));
let frameFiles = readdirSync(framesDir)
	.filter((f) => f.endsWith(".png"))
	.sort();
if (
	resume &&
	(frameFiles.length !== pts.length ||
		frameFiles.some(
			(file, i) =>
				file !== `${String(i + 1).padStart(4, "0")}.png` ||
				statSync(resolve(framesDir, file)).mtimeMs < statSync(video).mtimeMs,
		))
) {
	decode();
	frameFiles = readdirSync(framesDir)
		.filter((f) => f.endsWith(".png"))
		.sort();
}
const reusableClip = (name, multiplier = 1) => {
	const file = resolve(out, name);
	if (
		!resume ||
		!existsSync(file) ||
		statSync(file).mtimeMs < statSync(video).mtimeMs
	)
		return false;
	try {
		const duration = Number(
			execFileSync(
				"ffprobe",
				[
					"-v",
					"error",
					"-show_entries",
					"format=duration",
					"-of",
					"default=noprint_wrappers=1:nokey=1",
					file,
				],
				{ encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
			),
		);
		return (
			Number.isFinite(duration) &&
			Math.abs(duration - (pts.at(-1) ?? 0) * multiplier) < 1
		);
	} catch {
		return false;
	}
};
const frames = frameFiles.length;

// 2. Telemetry aligned to video frames by time.
const telemetry = JSON.parse(readFileSync(telemetryPath, "utf8"));
const samples = telemetry.samples;
const sampleAt = (seconds) => {
	const t = seconds * 1000;
	let best = samples[0];
	for (const s of samples)
		if (Math.abs(s.t - t) < Math.abs(best.t - t)) best = s;
	return best;
};
const perFrame = frameFiles.map((file, i) => ({
	file,
	t: pts[i] ?? i / 60,
	s: sampleAt(pts[i] ?? i / 60),
}));

// 3. The walked region: union of character bounds, padded, clamped to the canvas.
const W = 1920,
	H = 1080;
let x0 = Infinity,
	y0 = Infinity,
	x1 = -Infinity,
	y1 = -Infinity;
for (const s of samples) {
	x0 = Math.min(x0, s.bounds.x);
	y0 = Math.min(y0, s.bounds.y);
	x1 = Math.max(x1, s.bounds.x + s.bounds.width);
	y1 = Math.max(y1, s.bounds.y + s.bounds.height);
}
const pad = 40;
const region = {
	x: Math.max(0, Math.floor(x0 - pad)),
	y: Math.max(0, Math.floor(y0 - pad)),
};
region.w = Math.min(W - region.x, Math.ceil(x1 + pad) - region.x);
region.h = Math.min(H - region.y, Math.ceil(y1 + pad) - region.y);
region.w -= region.w % 2;
region.h -= region.h % 2;
const crop = `crop=${region.w}:${region.h}:${region.x}:${region.y}`;

// 4. Clips: real time and slow motion, magnified 2x, from the actual recording.
const magnify = region.w * 2 <= 1920 ? 2 : 1;
if (!reusableClip("realtime.mp4"))
	run("ffmpeg", [
		"-y",
		"-loglevel",
		"error",
		"-i",
		video,
		"-vf",
		`${crop},scale=iw*${magnify}:ih*${magnify}:flags=neighbor`,
		"-c:v",
		"libx264",
		"-pix_fmt",
		"yuv420p",
		"-crf",
		"16",
		resolve(out, "realtime.mp4"),
	]);
if (!reusableClip("slowmo.mp4", slow))
	run("ffmpeg", [
		"-y",
		"-loglevel",
		"error",
		"-i",
		video,
		"-vf",
		`${crop},scale=iw*${magnify}:ih*${magnify}:flags=neighbor,setpts=${slow}*PTS`,
		"-c:v",
		"libx264",
		"-pix_fmt",
		"yuv420p",
		"-crf",
		"16",
		resolve(out, "slowmo.mp4"),
	]);
const gifWidth = Math.min(900, region.w * magnify);
if (!args.includes("--skip-gif"))
	run("ffmpeg", [
		"-y",
		"-loglevel",
		"error",
		"-i",
		video,
		"-vf",
		`${crop},setpts=${slow}*PTS,fps=30,scale=${gifWidth}:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=bayer`,
		resolve(out, "slowmo.gif"),
	]);

// 5. Strips. Fixed camera: the same region every time, so translation is visible.
//    Stabilised: centred on the character, so drawing changes are visible.
const label = (f, i) => {
	const s = f.s;
	const prev = perFrame[i - every]?.s;
	const dx = prev ? (s.x - prev.x).toFixed(1) : "";
	return `${String(i).padStart(4, "0")} ${s.texture.replace("hermes-", "").slice(0, 14)}#${s.frame}${dx ? ` dx ${dx}` : ""}`;
};
const strip = (fileName, cropFor) => {
	const tiles = [];
	for (let i = 0; i < perFrame.length; i += every) {
		const f = perFrame[i];
		const c = cropFor(f.s);
		const tile = resolve(out, `tile-${i}.png`);
		run("magick", [
			resolve(framesDir, f.file),
			"-crop",
			`${c.w}x${c.h}+${c.x}+${c.y}`,
			"+repage",
			"-resize",
			`${c.resize ?? 100}%`,
			...(FONT ? ["-font", FONT] : []),
			"-gravity",
			"North",
			"-background",
			"#111",
			"-fill",
			"#ff0",
			"-pointsize",
			"14",
			"-splice",
			"0x18",
			"-annotate",
			"+0+2",
			label(f, i),
			tile,
		]);
		tiles.push(tile);
	}
	run("magick", [
		"montage",
		...tiles,
		"-tile",
		"8x",
		"-geometry",
		"+2+2",
		"-background",
		"#222",
		resolve(out, fileName),
	]);
	for (const t of tiles) run("rm", [t]);
};
strip("fixed-strip.png", () => ({ ...region, resize: 25 }));
strip("stabilised-strip.png", (s) => {
	const w = Math.round(s.bounds.width * 1.6),
		h = Math.round(s.bounds.height * 1.15);
	return {
		w,
		h,
		x: Math.round(s.bounds.x + s.bounds.width / 2 - w / 2),
		y: Math.round(s.bounds.y + s.bounds.height - h),
	};
});

// 6. Numbers: body motion per video frame, drawing holds, planted-sole slide.
const lines = [];
lines.push(
	`recording ${name}: ${frames} video frames, ${samples.length} telemetry samples, ${(pts.at(-1) ?? 0).toFixed(2)} s`,
);
lines.push(`region x${region.x} y${region.y} ${region.w}x${region.h}`);
const steps = [];
let holds = [],
	hold = 1,
	slides = [];
for (let i = 1; i < perFrame.length; i++) {
	const a = perFrame[i - 1].s,
		b = perFrame[i].s;
	const d = Math.hypot(b.x - a.x, b.y - a.y);
	if (b.walking) steps.push(d);
	if (a.texture === b.texture && a.frame === b.frame) hold++;
	else {
		holds.push(hold);
		hold = 1;
		if (
			a.sole &&
			b.sole &&
			a.sole.foot === b.sole.foot &&
			a.texture === b.texture &&
			a.sole.lateral !== false
		)
			// Lateral sheets only, x only: a sheet cannot draw a planted sole
			// receding in depth, and a depth sheet's soles treadmill under the
			// body, so neither is a planting fault the motor could fix.
			slides.push(Math.abs(b.sole.x - a.sole.x));
	}
}
const stat = (arr) => {
	const s = [...arr].sort((p, q) => p - q);
	return s.length
		? `median ${s[s.length >> 1].toFixed(2)} p90 ${s[Math.floor(s.length * 0.9)].toFixed(2)} max ${s.at(-1).toFixed(2)} n ${s.length}`
		: "none";
};
const sampleSteps = samples.slice(1).flatMap((b, i) => {
	const a = samples[i];
	return a.walking && b.walking ? [Math.hypot(b.x - a.x, b.y - a.y)] : [];
});
const renderPairs = samples.slice(1).flatMap((b, i) => {
	const a = samples[i];
	return a.walking && b.walking ? [{ a, b }] : [];
});
const renderSlides = renderPairs
	.filter(
		({ a, b }) =>
			a.sole &&
			b.sole &&
			a.sole.foot === b.sole.foot &&
			a.texture === b.texture &&
			a.sole.lateral !== false &&
			a.frame !== b.frame,
	)
	.map(({ a, b }) => Math.abs(b.sole.x - a.sole.x));
const median = (values) =>
	values.length ? [...values].sort((a, b) => a - b)[values.length >> 1] : null;
writeFileSync(
	resolve(out, "metrics.json"),
	JSON.stringify(
		{
			videoFrames: frames,
			renderSamples: samples.length,
			movingRenderPairs: renderPairs.length,
			zeroBodyMotion: sampleSteps.filter((d) => d === 0).length,
			heldDrawingPairs: renderPairs.filter(
				({ a, b }) => a.texture === b.texture && a.frame === b.frame,
			).length,
			soleSlideMedian: median(renderSlides),
			soleSlidePairs: renderSlides.length,
			limitation:
				"Telemetry aligned to real canvas video; sole coordinates use sheet contacts, not independent pixel tracking. Slide is lateral (x) only.",
		},
		null,
		2,
	),
);

lines.push(
	`body px per video frame while walking: ${stat(steps)}; render samples with zero motion: ${sampleSteps.filter((d) => d === 0).length} of ${sampleSteps.length}`,
);
lines.push(`drawing holds (video frames per drawing): ${stat(holds)}`);
lines.push(
	`planted sole lateral slide per drawing change (lateral sheets): ${stat(slides)}`,
);
lines.push("");
lines.push(
	"frame  t(s)   x       y      scale  texture#frame          dx     dy",
);
for (let i = 0; i < perFrame.length; i++) {
	const s = perFrame[i].s,
		p = perFrame[i - 1]?.s;
	lines.push(
		`${String(i).padStart(5)}  ${perFrame[i].t.toFixed(3)}  ${s.x.toFixed(1).padStart(7)} ${s.y.toFixed(1).padStart(7)}  ${s.scale.toFixed(3)}  ${(s.texture.replace("hermes-", "") + "#" + s.frame).padEnd(22)} ${p ? (s.x - p.x).toFixed(2).padStart(6) : "".padStart(6)} ${p ? (s.y - p.y).toFixed(2).padStart(6) : ""}`,
	);
}
writeFileSync(resolve(out, "report.txt"), `${lines.join("\n")}\n`);
console.log(lines.slice(0, 5).join("\n"));
console.log(`wrote ${out}`);
