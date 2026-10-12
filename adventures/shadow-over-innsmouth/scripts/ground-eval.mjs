#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
// Run with pnpm --filter @anima/api exec tsx ../adventures/shadow-over-innsmouth/scripts/ground-eval.mjs
import { deriveGround } from "../../../api/src/services/ground.ts";
import scenes from "../src/game/scenes/standaloneScenes.ts";

const { REVIEW_SCENES } = scenes;
const root = fileURLToPath(new URL("../../../", import.meta.url));
const output = [];
for (const [id, template, image] of [
	["outside", "exterior", "bus-station-flat-v1"],
	["inside", "interior", "arkham-bus-depot-flat-2d"],
]) {
	try {
		const data = await deriveGround(`/backgrounds/${image}.png`, template);
		const points = data.groundLine.points;
		const errors = REVIEW_SCENES[id].groundLine.points.map((p) => {
			const right = points.findIndex((q) => q.x >= p.x);
			const a = points[Math.max(0, right - 1)];
			const b = points[right < 0 ? points.length - 1 : right];
			const t =
				a.x === b.x ? 0 : Math.max(0, Math.min(1, (p.x - a.x) / (b.x - a.x)));
			return {
				line: Math.abs(a.y + (b.y - a.y) * t - p.y),
				scale: Math.abs(
					(a.scaleFactor + (b.scaleFactor - a.scaleFactor) * t) /
						p.scaleFactor -
						1,
				),
			};
		});
		output.push({
			id,
			horizonY: data.horizonY,
			referenceHorizonY: id === "outside" ? 470 : null,
			meanLinePx: errors.reduce((s, e) => s + e.line, 0) / errors.length,
			maxLinePx: Math.max(...errors.map((e) => e.line)),
			meanScaleRatioError:
				errors.reduce((s, e) => s + e.scale, 0) / errors.length,
			maxScaleRatioError: Math.max(...errors.map((e) => e.scale)),
			data,
		});
	} catch (e) {
		output.push({ id, error: e.message });
	}
}
await mkdir(resolve(root, "tmp/open-world-demo"), { recursive: true });
await writeFile(
	resolve(root, "tmp/open-world-demo/ground-eval.json"),
	JSON.stringify(output, null, 2),
);
console.log(
	JSON.stringify(
		output.map(({ data, ...rest }) => rest),
		null,
		2,
	),
);
