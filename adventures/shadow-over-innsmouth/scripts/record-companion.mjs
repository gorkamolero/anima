#!/usr/bin/env node
// Records Hermes and a companion walking the depot in real time, for the lens.
// Uses the running dev servers through agent-browser; no generation calls.
import { spawnSync } from "node:child_process";

const session = "anima-companion";
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
async function poll(code, timeout = 30000) {
	const start = Date.now();
	while (Date.now() - start < timeout) {
		const value = evaluate(code);
		if (value) return value;
		await pause(200);
	}
	throw Error(`Timed out: ${code}`);
}
const name = process.argv[2] ?? "companion-depot";
const companion = process.argv[3] ?? "kat";
try {
	browser("open", `http://localhost:8080/?scene=inside&mute=1&companion=${companion}`);
	await poll("!!window.__anima?.scene?.companion?.loaded && !!window.__anima.scene.hermesMotor && window.__anima.scene.geometryReady", 90000);
	await pause(1500);
	evaluate(
		`window.__recDone = undefined; window.__anima.record({name:${JSON.stringify(name)}, ms:14000, action: async () => {
			const m = window.__anima.scene.hermesMotor;
			m.place({x:600,y:960});
			await new Promise(r => setTimeout(r, 600));
			await m.walk([{x:1450,y:985}]);
			await new Promise(r => setTimeout(r, 900));
			await m.walk([{x:520,y:900}]);
		}}).then(r => { window.__recDone = r.samples ?? r; }); true`,
	);
	const samples = await poll("window.__recDone ?? null", 40000);
	console.log(`recorded ${name}: ${samples} samples`);
} finally {
	browser("close");
}
