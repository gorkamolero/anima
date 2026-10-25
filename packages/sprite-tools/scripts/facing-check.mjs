#!/usr/bin/env node
// Records which way a side sheet's figure faces, by looking at it.
//   node scripts/facing-check.mjs <sheet-base>   (writes "facing": "left"|"right" into <sheet-base>.json)
// A video model does not reliably honour "profile facing left"; the game must
// not assume it. Uses Codex's vision on the first frame; the answer is one
// word and is stored next to the sheet, with the frame it judged.
import { spawnSync } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const base = process.argv[2];
if (!base) throw new Error("usage: facing-check.mjs <sheet-base>");
const json = `${base}.json`;
const meta = JSON.parse(readFileSync(json, "utf8"));
const frame = `${base}.frame0.png`;
const magick = spawnSync("magick", [
	`${base}.png`,
	"-crop",
	`${meta.frameWidth}x${meta.frameHeight}+0+0`,
	"+repage",
	"-background",
	"#777777",
	"-flatten",
	frame,
]);
if (magick.status) throw new Error(String(magick.stderr));
const prompt = `The attached image is one frame of a walking character seen from the side. Answer with exactly one word on the last line, "left" or "right": the direction the character's face and toes point. Do not modify any file.`;
const r = spawnSync(
	"codex",
	["exec", "--skip-git-repo-check", "--dangerously-bypass-approvals-and-sandbox", "-C", resolve(base, ".."), "-i", frame, "-"],
	{ input: prompt, encoding: "utf8", maxBuffer: 8 * 1024 * 1024 },
);
if (r.status) throw new Error(r.stderr || r.stdout);
const answer = r.stdout.trim().split("\n").reverse().find((l) => /\b(left|right)\b/i.test(l));
const facing = answer?.toLowerCase().includes("right") ? "right" : answer?.toLowerCase().includes("left") ? "left" : undefined;
if (!facing) throw new Error(`No facing answer: ${r.stdout.slice(-200)}`);
meta.facing = facing;
meta.facingCheck = { method: "codex vision, first frame", frame: `${meta.name}.frame0.png`, date: new Date().toISOString() };
writeFileSync(json, `${JSON.stringify(meta, null, "\t")}\n`);
console.log(`${meta.name}: facing ${facing}`);
