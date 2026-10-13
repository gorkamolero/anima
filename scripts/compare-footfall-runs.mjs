#!/usr/bin/env node
/** Strict comparison: no parsed-number tolerances, ignored fields or normalization. */
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const [before, after] = process.argv.slice(2);
assert(
	before && after,
	"Usage: node scripts/compare-footfall-runs.mjs BEFORE AFTER",
);
const files = (root) =>
	readdirSync(root, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.flatMap((scene) =>
			readdirSync(join(root, scene.name))
				.filter((name) => name.endsWith(".json"))
				.map((name) => join(scene.name, name)),
		)
		.sort();
const expected = files(before);
assert.deepEqual(files(after), expected, "Run file sets differ");
let walks = 0;
for (const file of expected) {
	const a = readFileSync(join(before, file));
	const b = readFileSync(join(after, file));
	assert(a.equals(b), `Bytes differ: ${file}`);
	const value = JSON.parse(a);
	if (Array.isArray(value) && value[0]?.contact) walks++;
}
const manifest = JSON.parse(readFileSync(join(before, "run.json"), "utf8"));
assert.equal(walks, manifest.walks, "Missing per-frame logs");
console.log(
	`BYTE IDENTICAL: ${walks} walks; ${expected.length} scene JSON files`,
);
