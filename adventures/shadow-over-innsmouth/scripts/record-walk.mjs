#!/usr/bin/env node
// Records one Hermes walk in a scene in real time, optionally with planted sole placement.
//   node scripts/record-walk.mjs <recording-name> <scene-id> <x0> <y0> <x1> <y1> [uniform|planted]
import { spawnSync } from "node:child_process";
const [name, scene, x0, y0, x1, y1, mode = "uniform"] = process.argv.slice(2);
const session = `anima-walk-${process.pid}`;
const browser = (...args) => {
	const r = spawnSync("agent-browser", ["--session", session, ...args], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
	if (r.status) throw Error(r.stderr || r.stdout);
	return r.stdout.trim();
};
const evaluate = (code) => JSON.parse(browser("eval", code));
const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function poll(code, timeout = 90000) {
	const start = Date.now();
	while (Date.now() - start < timeout) {
		const value = evaluate(code);
		if (value) return value;
		await pause(250);
	}
	throw Error(`Timed out: ${code}`);
}
try {
	browser("open", `http://localhost:8080/?scene=${scene}&mute=1`);
	await poll("!!window.__anima?.scene?.hermesMotor && window.__anima.scene.geometryReady");
	await pause(1000);
	evaluate(`window.__recDone = undefined; (() => { const m = window.__anima.scene.hermesMotor; m.solePlacement = ${JSON.stringify(mode)}; m.place({x:${x0},y:${y0}}); })(); window.__anima.record({name:${JSON.stringify(name)}, ms:7000, action: async () => {
		await new Promise(r => setTimeout(r, 400));
		await window.__anima.scene.hermesMotor.walk([{x:${x1},y:${y1}}]);
	}}).then(r => { window.__recDone = r.samples ?? r; }); true`);
	console.log(`recorded ${name}: ${await poll("window.__recDone ?? null", 30000)} samples (${mode})`);
} finally {
	browser("close");
}
