/** Read-only adapter for the same local records served by the API. No API
 * imports that can initialize providers, migrate databases or derive assets. */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { classifyOccluder } from "@anima/footfall/core/occlusion/occlusion";
import { sceneFloor } from "@anima/footfall/core/walkarea/sceneFloor";
import {
	applySceneFootprints,
	sceneExitApproaches,
} from "@anima/footfall/core/walkarea/sceneGeometry";
import { deriveExits } from "@anima/footfall/derive/exits";
import { narrationCacheInput } from "../../../api/src/lib/narrationCacheInput.ts";

const require = createRequire(import.meta.url);
const { REVIEW_SCENES } = require("../src/game/scenes/standaloneScenes.ts");
const json = (p: string) => JSON.parse(readFileSync(p, "utf8"));
const stored = JSON.parse(
	execFileSync(
		"python3",
		[
			"-c",
			`import sqlite3,json
c=sqlite3.connect('file:api/data/world.db?mode=ro',uri=True)
print(json.dumps({'places':{r[0]:json.loads(r[1]) for r in c.execute('select id,data from places')},'connections':[json.loads(r[0]) for r in c.execute('select data from connections')],'narrations':{r[0]:json.loads(r[1]) for r in c.execute('select cache_key,data from narrations')}}))`,
		],
		{ encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
	),
);
const publicRoot = resolve("adventures/shadow-over-innsmouth/public");
const records = new Map();
export function loadWalkRecords(location: string) {
	if (records.has(location)) return records.get(location);
	const place = stored.places[location];
	const authored = REVIEW_SCENES[location];
	const background =
		place?.background ??
		(location === "outside"
			? "/backgrounds/bus-station-flat-v1.png"
			: "/backgrounds/arkham-bus-depot-flat-2d.png");
	const image = resolve(publicRoot, `.${background}`),
		stem = image.replace(/\.png$/, "");
	const ground =
		place?.ground ??
		(existsSync(`${stem}.ground.json`)
			? json(`${stem}.ground.json`)
			: undefined);
	let floor = ground?.floor;
	if (!floor) {
		const hash = createHash("sha256").update(readFileSync(image)).digest("hex");
		const names = readdirSync("api/data/perception")
			.filter((n) => n.startsWith(`${hash}-floor-v`) && n.endsWith(".json"))
			.sort(
				(a, b) =>
					Number(b.match(/-v(\d+)/)?.[1]) - Number(a.match(/-v(\d+)/)?.[1]),
			);
		floor = json(`api/data/perception/${names[0] ?? `${hash}.json`}`).mask;
	}
	const { area, visible } = sceneFloor(ground, authored, 1064);
	const perspective =
		ground?.walkArea?.perspective ??
		(ground
			? { horizonY: ground.horizonY, slope: ground.scaleSlope }
			: undefined);
	const objects = json(`${stem}.occluders.json`).map((o) =>
		perspective ? classifyOccluder(o, perspective) : o,
	);
	const alphaImages = JSON.parse(
		execFileSync(
			"tmp/walkqa/tools/venv/bin/python",
			[
				"-c",
				`import json,sys,base64
from PIL import Image
out=[]
for p in json.loads(sys.argv[1]):
 im=Image.open(p).convert('RGBA');out.append({'width':im.width,'height':im.height,'alpha':base64.b64encode(im.getchannel('A').tobytes()).decode()})
print(json.dumps(out))`,
				JSON.stringify(objects.map((o) => resolve(dirname(image), o.png))),
			],
			{ encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
		),
	);
	const layers = objects.map((data, i) => {
		const im = alphaImages[i],
			alpha = Buffer.from(im.alpha, "base64");
		return {
			data,
			alpha: (x: number, y: number) => {
				const cx = Math.floor(((x - data.bbox.x) * im.width) / data.bbox.w),
					cy = Math.floor(((y - data.bbox.y) * im.height) / data.bbox.h);
				return (
					cx >= 0 &&
					cy >= 0 &&
					cx < im.width &&
					cy < im.height &&
					alpha[cy * im.width + cx] > 127
				);
			},
		};
	});
	const kat = authored?.characters.kat;
	const seated =
		kat?.visible !== false && kat?.state?.startsWith("seated")
			? { ...kat, scaleX: kat.scale, scaleY: kat.scale, visible: true }
			: undefined;
	applySceneFootprints(
		area,
		visible,
		!place && location !== "outside" ? floor : undefined,
		layers,
		1064,
		seated,
	);
	const payload = json(`${stem}.interactables.json`);
	const interactables = Array.isArray(payload)
		? payload
		: payload.interactables;
	const exits =
		!place && ground
			? json(`${stem}.exits.json`)
			: deriveExits(
					floor,
					interactables,
					ground?.horizonY ?? json(`${stem}.landmarks.json`).horizonY,
					{
						allowFar: (place?.template ?? "interior") !== "interior",
						allowEdges: (place?.template ?? "interior") !== "interior",
					},
				);
	const final = sceneExitApproaches(
		exits,
		stored.connections.filter((c) => c.scene === location),
		area,
		authored?.hotspots,
		1064,
	);
	const result = {
		layers,
		visible: area.rawMask,
		connections: stored.connections.filter((c) => c.scene === location),
		description: place?.description ?? authored.description,
		location,
		area,
		exits: final.exits,
		objects,
		interactables,
		background,
		image,
		kat: seated,
	};
	records.set(location, result);
	return result;
}

export function storedOptions(location: string, object: string) {
	const record = loadWalkRecords(location);
	const visual = {
		timeOfDay: "day",
		weather: "salt fog",
		damage: "intact",
		npcsPresent: [],
	};
	const world = {
		location,
		flags: {},
		inventory: [],
		npcMemory: {},
		visual: { outside: visual, inside: visual, [location]: visual },
		history: [],
	};
	const { cacheKey } = narrationCacheInput(
		{
			scene: location,
			sceneDescription: record.description,
			object,
			flags: {},
			mode: "options",
		},
		world,
	);
	const value = stored.narrations[cacheKey];
	if (!value?.options)
		throw new Error(`Uncached narration options: ${location}/${object}`);
	return value.options;
}
