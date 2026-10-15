/** Write simulator corpora (plan.json + navigation.json) for places generated from
 * stored records, so new scenes can be walked untuned: generateWalkPlan only. */
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { generateWalkPlan } from "../../../packages/footfall/qa/plans.ts";
import { loadWalkRecords } from "./walk-records.mts";

const [out, ...pairs] = process.argv.slice(2); // out key=placeId ...
for (const pair of pairs) {
	const [key, location] = pair.split("=");
	const scene = loadWalkRecords(location);
	if (!scene) throw new Error(`No stored record for ${location}`);
	const plan = generateWalkPlan(scene);
	const dir = resolve(out, key);
	mkdirSync(dir, { recursive: true });
	writeFileSync(resolve(dir, "plan.json"), JSON.stringify(plan, null, 1));
	writeFileSync(resolve(dir, "navigation.json"), JSON.stringify({ location }));
	console.log(
		key,
		location,
		"beats",
		(plan as { beats: unknown[] }).beats.length,
	);
}
