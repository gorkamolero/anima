#!/usr/bin/env node
// Uses the existing dev servers. No generation, TTS calls, or server lifecycle changes.
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "../../..");
const out = resolve(root, "tmp/overnight/reports");
mkdirSync(out, { recursive: true });
const session = "anima-act1";
const browser = (...args) => {
	const r = spawnSync("agent-browser", ["--session", session, ...args], {
		encoding: "utf8",
		maxBuffer: 16 * 1024 * 1024,
	});
	if (r.status) throw Error(r.stderr || r.stdout);
	return r.stdout.trim();
};
const evaluate = (code) => JSON.parse(browser("eval", code));
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function poll(code, timeout = 20000) {
	const start = Date.now();
	while (Date.now() - start < timeout) {
		const value = evaluate(code);
		if (value) return value;
		await pause(150);
	}
	throw Error(`Timed out: ${code}`);
}
const evidence = [];
const qa = () => evaluate("window.__anima.scene.getReviewQaSnapshot()");
async function capture(name) {
	const state = qa();
	evidence.push({
		name,
		story: state.story.state,
		dialogue: state.dialogue,
		hermes: state.hermes,
		location: state.location,
	});
	browser("screenshot", resolve(out, `act1-${name}.png`));
}
async function drain() {
	for (let i = 0; i < 400; i++) {
		const state = qa();
		if (state.dialogue?.choices.length || !state.dialogueLocked) return state;
		if (state.dialogue) {
			await pause(420);
			// Exercise the actual panel's click handler, including the beat-id guard.
			evaluate(
				'document.querySelector(".dialogue-panel__line")?.click(); true',
			);
		} else await pause(150);
	}
	throw Error("Dialogue never settled");
}
async function hotspot(id) {
	await poll("!window.__anima.scene.getReviewQaSnapshot().dialogueLocked");
	evaluate(
		`(() => {const a=window.__anima;const h=a.snapshot().hotspots.find(h=>h.id===${JSON.stringify(id)});if(!h)throw Error('Missing hotspot ${id}');a.click(h.bounds.x+h.bounds.width/2,h.bounds.y+h.bounds.height/2);return true})()`,
	);
	await pause(350);
	await evaluate(
		"window.__anima.waitUntil(() => window.__anima.scene.getReviewQaSnapshot().dialogueLocked || !window.__anima.scene.hermesMotor.walking, {timeoutMs:5000}).then(()=>true)",
	);
}
async function choose(index) {
	assert.ok(qa().dialogue?.choices[index]);
	evaluate(
		`document.querySelectorAll('.dialogue-panel__choices button')[${index}].click();true`,
	);
	await pause(100);
}
try {
	browser("open", "http://localhost:8080/?act=1&scene=inside&mute=1");
	await poll("!!window.__anima?.scene.getReviewQaSnapshot().dialogue");
	// Confirm one complete muted reading-time advance without a click.
	const first = qa().dialogue.id;
	await poll(
		`window.__anima.scene.getReviewQaSnapshot().dialogue?.id > ${first}`,
		10000,
	);
	await drain();
	evaluate(
		"window.__act1Recording = window.__anima.record({name:'act1-playthrough',ms:120000}); true",
	);
	await hotspot("schedule_board");
	await capture("schedule");
	await drain();
	await hotspot("ticket_window");
	await capture("clerk");
	const locked = qa().hermes;
	evaluate("window.__anima.click(1000,980);window.__anima.step(500);true");
	assert.equal(qa().hermes.x, locked.x, "dialogue must cancel walking");
	await drain();
	await choose(0);
	await drain();
	await choose(1);
	await drain();
	assert.ok(qa().story.state.inventory.includes("bus_ticket"));
	assert.equal(qa().story.state.flags.clerk_warned, true);
	await hotspot("bench");
	await capture("kat-bench");
	await drain();
	// Click ground after the dialogue closes; the motor must own this walk.
	const before = qa().hermes.x;
	evaluate("window.__anima.click(800,980);true");
	await pause(1800);
	assert.notEqual(
		qa().hermes.x,
		before,
		"walking should resume after dialogue",
	);
	await hotspot("exit");
	await poll(
		'window.__anima.scene.getReviewQaSnapshot().location === "outside"',
	);
	await capture("platform");
	await hotspot("exit");
	await poll(
		'window.__anima.scene.getReviewQaSnapshot().story.state.scene === "bus_interior"',
	);
	await poll("!!window.__anima.scene.getReviewQaSnapshot().dialogue");
	await capture("bus");
	await drain();
	await hotspot("rest");
	await capture("rest-gated");
	await drain();
	assert.equal(qa().story.state.scene, "bus_interior");
	await hotspot("kat");
	await drain();
	await capture("kat-choice");
	await choose(1);
	await drain();
	assert.equal(qa().story.state.flags.kat_revealed_family, true);
	await hotspot("rest");
	await poll(
		'window.__anima.scene.getReviewQaSnapshot().story.state.scene === "innsmouth_streets"',
	);
	await drain();
	await capture("arrival");
	assert.equal(qa().location, "place-d3fc732744430e25f7c1");
	evaluate(
		"window.__act1Recording.then(result => {window.__act1RecordingResult = result}); true",
	);
	await poll("window.__act1RecordingResult ?? false", 130000);
	const recording = evaluate("window.__act1RecordingResult");
	writeFileSync(
		resolve(out, "act1-playtest.json"),
		JSON.stringify({ passed: true, evidence, recording }, null, 2),
	);
	console.log(JSON.stringify({ passed: true, recording }, null, 2));
} catch (error) {
	await capture("failure");
	writeFileSync(
		resolve(out, "act1-playtest.json"),
		JSON.stringify({ passed: false, error: String(error), evidence }, null, 2),
	);
	throw error;
} finally {
	browser("close");
}
