#!/usr/bin/env node
// Screenshot Hermes standing at a given floor point in a scene, for a scale check by eye.
//   node scripts/scale-still.mjs <scene-id> <x> <y> <out.png>
import { spawnSync } from "node:child_process";
const [scene, x, y, out] = process.argv.slice(2);
const session = `anima-still-${process.pid}`;
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
		if (evaluate(code)) return;
		await pause(250);
	}
	throw Error(`Timed out: ${code}`);
}
try {
	browser("open", `http://localhost:8080/?scene=${scene}&mute=1`);
	await poll("!!window.__anima?.scene?.hermesMotor && window.__anima.scene.geometryReady");
	await pause(800);
	evaluate(`(() => { const m = window.__anima.scene.hermesMotor; m.place({x:${x},y:${y}}); m.face("toward"); return true; })()`);
	await pause(300);
	evaluate("window.__anima.step(100); true");
	browser("screenshot", out);
	console.log(evaluate("JSON.stringify((() => { const s = window.__anima.scene.hermesSprite; return {x: s.x, y: s.y, height: s.displayHeight, scale: s.scale}; })())"));
} finally {
	browser("close");
}
