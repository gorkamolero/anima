#!/usr/bin/env tsx
/** Read-only Innsmouth adapter for the reusable Footfall runner. */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { simulateWalks } from "@anima/footfall/sim/runner";
import { loadWalkRecords, storedOptions } from "./walk-records.mts";

const { hermesFootAnimation } = createRequire(import.meta.url)(
	"../src/game/scenes/hermesFootAnimation.ts",
) as typeof import("../src/game/scenes/hermesFootAnimation.ts");
// Phaser's actual camera clock has no DOM dependency. Keep its completion and
// floating-point timing identical while supplying only its event interface.
const Fade = createRequire(import.meta.url)(
	"phaser/src/cameras/2d/effects/Fade.js",
);
const arg = (name: string, fallback: string) =>
	process.argv
		.find((a) => a.startsWith(`--${name}=`))
		?.slice(name.length + 3) ?? fallback;
const corpus = arg("corpus", "tmp/walkqa/harness-24");
const out = resolve("tmp/walkqa/sim", arg("run", "26-current"));
const scenes = arg(
	"scenes",
	"outside,inside,road,alley,pier,stepped-street,church,lobby,grocery,square",
).split(",");
const selected = arg("walks", "").split(",").filter(Boolean);
const json = (path: string) => JSON.parse(readFileSync(path, "utf8"));
const save = (path: string, value: unknown) => {
	mkdirSync(dirname(path), { recursive: true });
	writeFileSync(path, JSON.stringify(value));
};
const assets = resolve(
	"adventures/shadow-over-innsmouth/public/assets/sprites/hermes",
);
const report = await simulateWalks({
	out,
	selected,
	scenes: Object.fromEntries(
		scenes.map((scene) => [
			scene,
			{
				location: json(`${corpus}/${scene}/navigation.json`).location,
				plan: json(`${corpus}/${scene}/plan.json`),
			},
		]),
	),
	sheets: (name) => json(`${assets}/${name}.json`),
	animation: hermesFootAnimation,
	initialTexture: "hermes-passing-stand-side",
	loadWalkRecords,
	storedOptions,
	Fade,
	save,
	immediateLocations: ["outside", "inside"],
	extraOccluders: (geometry) => {
		const kat = geometry.kat;
		return kat
			? [
					{
						id: "kat-seated-talk-loop",
						depth: 10 + kat.y / 20,
						baseline: [
							{ x: kat.x - 410 * kat.scale, y: kat.y },
							{ x: kat.x + 410 * kat.scale, y: kat.y },
						],
						bounds: {
							x: kat.x - 410 * kat.scale,
							y: kat.y - 880 * kat.scale,
							width: 820 * kat.scale,
							height: 880 * kat.scale,
						},
						sprite: {
							texture: "kat-seated-talk-loop",
							cutX: 0,
							cutY: 0,
							width: 820,
							height: 880,
							flip: kat.flipX ?? false,
						},
					},
				]
			: [];
	},
});
console.log(
	JSON.stringify({ out, walks: report.walks, elapsedMs: report.elapsedMs }),
);
