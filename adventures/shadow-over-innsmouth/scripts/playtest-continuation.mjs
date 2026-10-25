#!/usr/bin/env node
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import {
	browser,
	evaluate,
	out,
	player,
	poll,
	runSession,
} from "./story-player.mjs";

const session = "anima-continuation";
const result = {};
try {
	result.reef = await runSession(session, {
		act: "3b",
		archetype: "completionist",
		noticed: true,
		seed: 0,
		choicePlan: [0, 3, 0, 0, 0],
		timeout: 600000,
	});
	assert.equal(result.reef.passed, true);
	assert.equal(result.reef.final.story.flags.surface_path, true);
	assert.equal(result.reef.final.story.flags.kat_left_note, true);
	await poll(
		session,
		`!!document.querySelector('[aria-label="Act complete"] button')`,
	);
	browser(session, "screenshot", resolve(out, "story-continue-button.png"));
	evaluate(
		session,
		`document.querySelector('[aria-label="Act complete"] button').click(); true`,
	);
	result.entry = await poll(
		session,
		`new URLSearchParams(location.search).get("act")==="4" && window.__anima?.scene.getReviewQaSnapshot().story?.state`,
		120000,
	);
	assert.equal(result.entry.flags.surface_path, true);
	assert.equal(result.entry.flags.kat_left_note, true);
	evaluate(
		session,
		`window.__storyResult=null; (${player.toString()})({act:"4",archetype:"rusher",seed:0}).then(r=>window.__storyResult=r); true`,
	);
	result.act4 = await poll(session, "window.__storyResult", 300000);
	assert.equal(result.act4.passed, true);
	assert.ok(
		result.act4.trace.some((t) =>
			t.output.some((line) => line.includes("You said you were sorry.")),
		),
	);
	result.passed = true;
	console.log(
		"PASS: reef rescue -> Continue -> Act 4 note dialogue -> credits",
	);
} catch (error) {
	result.passed = false;
	result.error = String(error);
	process.exitCode = 1;
	console.error(error);
} finally {
	writeFileSync(
		resolve(out, "story-continuation.json"),
		JSON.stringify(result, null, 2),
	);
	browser(session, "close");
}
