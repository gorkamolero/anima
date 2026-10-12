#!/usr/bin/env node
// The authored-line journey was superseded by segmented floors and persisted
// exits. Keep this entry point on the same live hotspot/scale/arrival checks.
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const result = spawnSync(
	process.execPath,
	[
		fileURLToPath(new URL("./playtest-town.mjs", import.meta.url)),
		"--replay",
		...process.argv.slice(2),
	],
	{ stdio: "inherit" },
);
if (result.error) throw result.error;
process.exitCode = result.status ?? 1;
