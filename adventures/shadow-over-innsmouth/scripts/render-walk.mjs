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
const width = Number(arg("width", "1920"));
if (width !== 1920)
	throw new Error("Footfall proof captures require 1920x1080");
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
const evaluate = (source, retryCapture = false) => {
	for (let attempt = 0; ; attempt++) {
		try {
			return JSON.parse(browser(["eval", "--stdin"], source));
		} catch (error) {
			if (
				!retryCapture ||
				attempt >= 4 ||
				!/Resource temporarily unavailable|daemon may be busy/.test(
					String(error),
				)
			)
				throw error;
			Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
		}
	}
};
const alphaAudit = process.argv.includes("--alpha-audit")
	? `const s=window.__anima.scene,h=s.hermesSprite;const histogram=async(sprite)=>{const rt=s.make.renderTexture({width:1920,height:1080,add:false});rt.draw(sprite);return await new Promise(resolve=>rt.snapshot(im=>{const c=document.createElement('canvas');c.width=1920;c.height=1080;const ctx=c.getContext('2d');ctx.drawImage(im,0,0);const data=ctx.getImageData(0,0,1920,1080).data,hist=Array(256).fill(0);for(let i=3;i<data.length;i+=4)hist[data[i]]++;rt.destroy();resolve(hist);}));};const normal=s.make.sprite({key:h.texture.key,frame:h.frame.name,x:h.x,y:h.y,add:false}).setOrigin(h.originX,h.originY).setFlipX(h.flipX).setScale(h.scaleX,h.scaleY).setAlpha(1);sample.alphaAudit={rendered:await histogram(h),normal:await histogram(normal)};normal.destroy();`
	: "";
const captureOne = (stepMs) =>
	`(async()=>{let sample;const png=await window.__anima.captureFrame({stepMs:${stepMs},width:${width},format:'png',onFrame:()=>{const s=window.__anima.scene,h=s.hermesSprite;sample={visible:h.visible,x:h.x,y:h.y,scale:h.scaleX,flip:h.flipX,texture:h.texture.key,frame:Number(h.frame.name),alpha:h.alpha,blend:s.hermesBlend?.visible?{texture:s.hermesBlend.texture.key,frame:Number(s.hermesBlend.frame.name),x:s.hermesBlend.x,y:s.hermesBlend.y,scale:s.hermesBlend.scaleX,flip:s.hermesBlend.flipX,alpha:s.hermesBlend.alpha}:null,walking:s.hermesMotor.walking,contact:s.hermesMotor.snapshot(),location:s.locationId(),ui:s.openWorldBusy,inputBlocked:s.inputBlocked,object:s.selectedInteractable?.name,occluders:s.objectLayers.map(l=>({id:l.data.id,depth:l.image.depth,baseline:l.data.baseline})),depth:h.depth};}});${alphaAudit}return {png,...sample};})()`;
const captureId = `${Date.now()}:${process.pid}`;
mkdirSync(out, { recursive: true });
if (!process.argv.includes("--reuse")) {
	browser(["open", `http://localhost:8080/?mute=1&walkqa=${Date.now()}`]);
	browser(["set", "viewport", "1920", "1080"]);
	browser(["wait", "--load", "networkidle"]);
	// A repeated proof must not accumulate narrative history and change cache keys.
	evaluate(
		`localStorage.setItem("anima.world.session",${JSON.stringify(`walkqa-${plan.place}-${Date.now()}-${process.pid}`)});location.reload();true`,
	);
	browser(["wait", "--load", "networkidle"]);
}
for (let i = 0; i < 600; i++) {
	const ready = evaluate(
		`(()=>{window.__anima?.step(100);return !!window.__anima && !window.__anima.scene.openWorldBusy && !!window.__anima.scene.world})()`,
	);
	if (ready) break;
	if (i === 599) throw new Error("World initialization timeout");
	await new Promise((r) => setTimeout(r, 100));
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
// Freeze RAF before choosing the initial pose, so a proof always starts on
// the requested idle frame rather than whichever frame a live RAF reached.
evaluate(
	`window.__anima.captureFrame({stepMs:0,width:${width},format:'png'}).then(()=>true)`,
);
if (plan.start)
	evaluate(
		`(()=>{const s=window.__anima.scene;s.hermesSprite.setTexture('hermes-matched-stand-side',0).setFlipX(false);s.hermesMotor.place({x:${plan.start[0]},y:${plan.start[1]}});return true})()`,
	);
if (!evaluate("window.__anima.scene.geometryReady"))
	throw new Error(
		"Scene object/floor geometry failed to load; refusing incomplete proof",
	);
const geometry = evaluate(
	`(()=>{const s=window.__anima.scene;return {area:s.walkArea,location:s.locationId(),exits:s.sceneExits,objects:s.objectLayers.map(l=>l.data)}})()`,
);
writeFileSync(resolve(out, "navigation.json"), JSON.stringify(geometry));
writeFileSync(
	resolve(out, "area.json"),
	JSON.stringify({
		...geometry,
		area: {
			...geometry.area,
			mask: geometry.area.rawMask ?? geometry.area.mask,
		},
	}),
);
const areas = {
	[geometry.location]: {
		...geometry.area,
		mask: geometry.area.rawMask ?? geometry.area.mask,
	},
};
const logs = [];
for (const beat of plan.beats) {
	// A crossing can itself enter an exit. Every proof beat belongs to its named scene.
	if (
		!beat.continueLocation &&
		evaluate("window.__anima.scene.locationId()") !== plan.place
	) {
		evaluate(
			`(()=>{window.__walkReady=false;window.__anima.scene.enterLocation(${JSON.stringify(plan.place)}).then(()=>window.__walkReady=true);return true})()`,
		);
		for (let i = 0; i < 600; i++) {
			if (
				evaluate("(()=>{window.__anima.step(100);return window.__walkReady})()")
			)
				break;
			if (i === 599) throw new Error("Proof scene restore timed out");
			await new Promise((r) => setTimeout(r, 100));
		}
	}
	const dir = resolve(out, `${beat.name}-frames`);
	rmSync(dir, { recursive: true, force: true });
	mkdirSync(dir, { recursive: true });
	if (beat.start)
		evaluate(
			`(()=>{const s=window.__anima.scene;s.hermesSprite.setTexture('hermes-matched-stand-side',0).setFlipX(false);if(${JSON.stringify(beat.facing ?? null)})s.hermesMotor.heading=${JSON.stringify(beat.facing ?? null)};s.hermesMotor.place({x:${beat.start[0]},y:${beat.start[1]}});return true})()`,
		);
	if (beat.object) {
		const point = evaluate(
			`(()=>{const s=window.__anima.scene;for(let y=60;y<950;y+=4)for(let x=0;x<1920;x+=4)if(s.findInteractableAtPoint(x,y)?.name.toLowerCase()===${JSON.stringify(beat.object.toLowerCase())})return [x,y];throw new Error('No object mask pixel');})()`,
		);
		beat.click = point;
	}
	if (beat.exit) {
		const point = evaluate(
			`(()=>{const s=window.__anima.scene,e=s.sceneExits.find(e=>e.id===${JSON.stringify(beat.exit)}||e.kind===${JSON.stringify(beat.exit)});if(!e)throw new Error('No exit');return [e.region.reduce((n,p)=>n+p.x,0)/e.region.length,e.region.reduce((n,p)=>n+p.y,0)/e.region.length]})()`,
		);
		beat.click = point;
	}
	const sourceLocation = evaluate("window.__anima.scene.locationId()");
	const expectedDestination = beat.exit
		? evaluate(
				`window.__anima.scene.sceneExits.find(e=>e.id===${JSON.stringify(beat.exit)}||e.kind===${JSON.stringify(beat.exit)})?.to??null`,
			)
		: null;
	const startFrame = beat.captureStart ? evaluate(captureOne(0)) : null;
	if (beat.heading)
		evaluate(
			`(()=>{void window.__anima.scene.hermesMotor.walk([{x:${beat.walk[0]},y:${beat.walk[1]}}],${JSON.stringify(beat.heading)});return true})()`,
		);
	else if (beat.walk)
		evaluate(
			`(()=>{void window.__anima.scene.walkGenerated(${beat.walk[0]},${beat.walk[1]});return true})()`,
		);
	if (beat.click)
		evaluate(
			`(()=>{window.__anima.click(${beat.click[0]},${beat.click[1]});return true})()`,
		);
	const log = [];
	if (startFrame) {
		const { png, ...sample } = startFrame;
		writeFileSync(
			resolve(dir, "000000.png"),
			Buffer.from(png.split(",")[1], "base64"),
		);
		log.push(sample);
		const { png: entryPng, ...entrySample } = evaluate(captureOne(0));
		writeFileSync(
			resolve(dir, "000001.png"),
			Buffer.from(entryPng.split(",")[1], "base64"),
		);
		log.push(entrySample);
	}
	let exitCompleted = !beat.exit;
	let walkCompleted = false;
	let idleFrames = 0;
	for (
		let first = 0;
		first < beat.frames ||
		((!exitCompleted || !walkCompleted) && first < beat.frames + 2400);
		first += 4
	) {
		const frames = evaluate(
			`(()=>{const token=${JSON.stringify(`${captureId}:${beat.name}:${first}`)};if(window.__walkBatch?.token===token)return window.__walkBatch.promise;const promise=(async()=>{const out=[];for(let i=0;i<${first < beat.frames ? Math.min(4, beat.frames - first) : 4};i++){out.push(await ${captureOne("1000/24")});}return out})();window.__walkBatch={token,promise};return promise})()`,
			true,
		);
		const currentGeometry = areas[frames.at(-1).location]
			? null
			: evaluate(
					`(()=>{const s=window.__anima.scene;return s.geometryReady && s.hermesSprite.visible && !${JSON.stringify(Object.keys(areas))}.includes(s.locationId()) ? {location:s.locationId(),area:s.walkArea} : null})()`,
				);
		if (currentGeometry)
			areas[currentGeometry.location] = {
				...currentGeometry.area,
				mask: currentGeometry.area.rawMask ?? currentGeometry.area.mask,
			};
		writeFileSync(
			resolve(out, "area.json"),
			JSON.stringify({ ...geometry, area: areas[geometry.location], areas }),
		);
		exitCompleted ||=
			(expectedDestination
				? frames.at(-1).location === expectedDestination
				: frames.at(-1).location !== sourceLocation) &&
			!frames.at(-1).ui &&
			!frames.at(-1).inputBlocked;
		for (let j = 0; j < frames.length; j++) {
			const { png, ...sample } = frames[j];
			writeFileSync(
				resolve(dir, `${String(log.length).padStart(6, "0")}.png`),
				Buffer.from(png.split(",")[1], "base64"),
			);
			log.push(sample);
			idleFrames = sample.walking ? 0 : idleFrames + 1;
			walkCompleted = idleFrames >= 4;
		}
		if (
			process.argv.includes("--retain-failures") &&
			!exitCompleted &&
			!frames.at(-1).ui &&
			frames.at(-1).location === sourceLocation &&
			idleFrames >= 48 &&
			first >= beat.frames
		)
			break;
		writeFileSync(
			resolve(out, `${beat.name}.partial.json`),
			JSON.stringify(log),
		);
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
		"-frames:v",
		String(log.length),
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
		`fps=6,scale=320:-1,tile=6x${Math.ceil(log.length / 24)}`,
		"-frames:v",
		"1",
		resolve(out, `${beat.name}-sheet.png`),
	]);
	if (!walkCompleted) throw new Error(`Walk ${beat.name} did not finish`);
	if (!exitCompleted && !process.argv.includes("--retain-failures"))
		throw new Error(`Exit ${beat.exit} did not finish and release input`);
	rmSync(resolve(out, `${beat.name}.partial.json`), { force: true });
	logs.push({
		name: beat.name,
		frames: log.length,
		exitCompleted,
		walkCompleted,
		requested: beat,
	});
	// Keep the full PNG sequence only on request. Videos and telemetry remain.
	if (!process.argv.includes("--keep-frames")) rmSync(dir, { recursive: true });
	console.log(beat.name, log.length);
	if (!exitCompleted) break;
}
writeFileSync(
	resolve(out, "render.json"),
	JSON.stringify(
		{ fps: 24, width, height: 1080, place: plan.place, logs },
		null,
		2,
	),
);
