#!/usr/bin/env node
/** Lossless game-frame capture, followed by exact 24 fps encoding.
 * --plan=path.json: {place, start:[x,y], beats:[{name,click:[x,y],frames}]}
 * --out=tmp/walkqa/road --session=walkqa. Always muted.
 * captureFrame advances the virtual clock itself: never step twice per frame.
 */
import { spawnSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const arg = (name, fallback) =>
	process.argv
		.find((v) => v.startsWith(`--${name}=`))
		?.slice(name.length + 3) ?? fallback;
const plan = JSON.parse(
	readFileSync(arg("plan", "tmp/walkqa/plan.json"), "utf8"),
);
const out = resolve(arg("out", `tmp/walkqa/${plan.place}`));
const session = arg("session", "walkqa");
function run(command, args, input) {
	const r = spawnSync(command, args, {
		input,
		encoding: "utf8",
		maxBuffer: 128 * 1024 * 1024,
	});
	if (r.status !== 0) throw new Error(r.stderr || r.stdout);
	return r.stdout.trim();
}
const browser = (args, input) =>
	run("agent-browser", ["--session", session, ...args], input);
const evaluate = (source) => JSON.parse(browser(["eval", "--stdin"], source));
mkdirSync(out, { recursive: true });
if (!process.argv.includes("--reuse")) {
	browser(["open", "http://localhost:8080/?mute=1"]);
	browser(["set", "viewport", "1920", "1080"]);
	browser(["wait", "--load", "networkidle"]);
}
evaluate(
	`(async()=>{while(!window.__anima) await new Promise(r=>setTimeout(r,100)); const a=window.__anima,s=a.scene; if(!new URLSearchParams(location.search).has('mute')) throw new Error('Mute required'); s.setPlacementDebugEnabled(false); window.__walkReady=false; s.enterLocation(${JSON.stringify(plan.place)}).then(()=>window.__walkReady=true);return true;})()`,
);
for (let i = 0; i < 600; i++) {
	const ready = evaluate(
		`(()=>{window.__anima.step(100);return window.__walkReady})()`,
	);
	if (ready) break;
	if (i === 599) throw new Error("Place load timeout");
	await new Promise((r) => setTimeout(r, 100));
}
if (plan.start)
	evaluate(
		`(()=>{const s=window.__anima.scene;s.hermesMotor.place({x:${plan.start[0]},y:${plan.start[1]}});return true})()`,
	);
// First capture freezes RAF before any walk is started.
evaluate(
	`window.__anima.captureFrame({stepMs:0,width:1920,format:'png'}).then(()=>true)`,
);
const logs = [];
for (const beat of plan.beats) {
	const dir = resolve(out, `${beat.name}-frames`);
	mkdirSync(dir, { recursive: true });
	if (beat.start)
		evaluate(
			`(()=>{const s=window.__anima.scene;s.hermesMotor.place({x:${beat.start[0]},y:${beat.start[1]}});return true})()`,
		);
	if (beat.click)
		evaluate(
			`(()=>{window.__anima.click(${beat.click[0]},${beat.click[1]});return true})()`,
		);
	const log = [];
	for (let first = 0; first < beat.frames; first += 12) {
		const frames = evaluate(
			`(async()=>{const out=[];for(let i=0;i<${Math.min(12, beat.frames - first)};i++){const png=await window.__anima.captureFrame({stepMs:1000/24,width:1920,format:'png'});const s=window.__anima.scene,h=s.hermesSprite;out.push({png,x:h.x,y:h.y,scale:h.scaleX,flip:h.flipX,texture:h.texture.key,frame:Number(h.frame.name),walking:s.hermesMotor.walking,location:s.locationId(),occluders:s.objectLayers.map(l=>({id:l.data.id,depth:l.image.depth,baseline:l.data.baseline})),depth:h.depth});}return out})()`,
		);
		for (let j = 0; j < frames.length; j++) {
			const { png, ...sample } = frames[j];
			writeFileSync(
				resolve(dir, `${String(first + j).padStart(6, "0")}.png`),
				Buffer.from(png.split(",")[1], "base64"),
			);
			log.push(sample);
		}
	}
	writeFileSync(resolve(out, `${beat.name}.json`), JSON.stringify(log));
	run("ffmpeg", [
		"-y",
		"-v",
		"error",
		"-framerate",
		"24",
		"-i",
		`${dir}/%06d.png`,
		"-c:v",
		"libx264",
		"-crf",
		"16",
		"-pix_fmt",
		"yuv420p",
		resolve(out, `${beat.name}.mp4`),
	]);
	run("ffmpeg", [
		"-y",
		"-v",
		"error",
		"-i",
		resolve(out, `${beat.name}.mp4`),
		"-vf",
		`fps=6,scale=320:-1,tile=6x${Math.ceil(beat.frames / 24)}`,
		"-frames:v",
		"1",
		resolve(out, `${beat.name}-sheet.png`),
	]);
	logs.push({ name: beat.name, frames: log.length });
	// Keep the full PNG sequence only on request. Videos and telemetry remain.
	if (!process.argv.includes("--keep-frames")) rmSync(dir, { recursive: true });
	console.log(beat.name, log.length);
}
writeFileSync(
	resolve(out, "render.json"),
	JSON.stringify({ fps: 24, place: plan.place, logs }, null, 2),
);
