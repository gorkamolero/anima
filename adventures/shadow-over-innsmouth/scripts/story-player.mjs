import { spawnSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
export const root = resolve(import.meta.dirname, "../../..");
export const out = resolve(root, "tmp/overnight/reports");
mkdirSync(out, { recursive: true });
export const pause = (ms) => new Promise((r) => setTimeout(r, ms));
export function browser(session, ...args) {
	const r = spawnSync("agent-browser", ["--session", session, ...args], {
		encoding: "utf8",
		maxBuffer: 32 * 1024 * 1024,
	});
	if (r.status) throw Error(r.stderr || r.stdout);
	return r.stdout.trim();
}
export const evaluate = (session, code) =>
	JSON.parse(browser(session, "eval", code));
export async function poll(session, code, timeout = 30000) {
	const start = Date.now();
	while (Date.now() - start < timeout) {
		const value = evaluate(session, code);
		if (value) return value;
		await pause(200);
	}
	throw Error(`Timed out: ${code}`);
}
// Runs in the actual game tab. No runtime methods, teleports, model calls or state injection.
export async function player(config) {
	const a = window.__anima,
		trace = [],
		failures = [],
		seen = new Set(),
		choiceCounts = config.choiceCounts ?? {};
	window.__storyTrace = trace;
	const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
	const qa = () => a.scene.getReviewQaSnapshot();
	const state = () => ({
		story: qa().story.state,
		scene: qa().story.scene?.originalId,
		ended: qa().story.ended,
		ending: qa().story.ending,
		visits: qa().story.visits?.map((v) => v.scene.originalId),
		output: qa().story.output,
		location: qa().location,
		hotspots: a.snapshot().hotspots,
		choices: qa().dialogue?.choices ?? [],
	});
	let choiceDepth = 0;
	const log = (action) => trace.push({ time: Date.now(), action, ...state() });
	const events = [];
	const onError = (e) => events.push(e.message ?? String(e.reason));
	window.addEventListener("error", onError);
	window.addEventListener("unhandledrejection", onError);
	async function settle() {
		for (let n = 0; n < 20000; n++) {
			const q = qa();
			if (q.dialogue?.text.startsWith("[Scene transition failed:"))
				throw Error(q.dialogue.text);
			if (q.dialogue?.choices.length || !q.dialogueLocked) return;
			if (q.dialogue) {
				if (config.lineDelay) await sleep(config.lineDelay);
				window.dispatchEvent(
					new CustomEvent("anima:dialogue-advance", {
						detail: { id: q.dialogue.id },
					}),
				);
			} else await sleep(20);
		}
		throw Error("Transition/dialogue failed to settle");
	}
	function route(q) {
		const f = q.story.state.flags,
			s = q.story.scene.originalId;
		return {
			hotel_room: "door",
			town_square: !f.talked_to_zadok ? "harbor_road" : "hotel_direction",
			harbor: !f.talked_to_zadok ? "old_drunk" : "town_direction",
			hotel_lobby_evening: "front_door",
			grocery_store: "door",
			library: "window",
			chase_begins: "town_direction",
			street_chase: "alley",
			church_exterior: "church_door",
			church_interior: "kat_altar",
			church_escape: config.reef ? "harbor_boat" : "road",
			escape_road: "truck",
			devil_reef_approach: "rowboat",
			devil_reef: "path_down",
			rescue_escape: config.seed % 2 ? "path_right" : "path_left",
			one_year_later: "bed",
			the_dream: "kat_dream",
			one_year_later_morning: "door",
			the_beach: "kat_beach",
			the_end: "kat_walking",
			epilogue: "end",
		}[s];
	}
	try {
		await settle();
		log("start");
		for (let step = 0; step < 200; step++) {
			const q = qa(),
				s = q.story.scene.originalId;
			for (const line of q.story.output)
				if (/^\[(Unknown target|Scene not found)/.test(line)) throw Error(line);
			if (q.story.ended) {
				log("end");
				break;
			}
			if (q.dialogue?.choices.length) {
				const choices = q.dialogue.choices;
				const key = s + "|" + choices.map((c) => c.text).join("|");
				const counts = choiceCounts[key] ?? Array(choices.length).fill(0);
				const index =
					config.choicePlan?.[choiceDepth++] ??
					(config.archetype === "rusher"
						? 0
						: counts.indexOf(Math.min(...counts)));
				counts[index]++;
				choiceCounts[key] = counts;
				log({ choice: index, text: choices[index].text, key });
				window.dispatchEvent(
					new CustomEvent("anima:dialogue-choice", {
						detail: { id: q.dialogue.id, index },
					}),
				);
				await settle();
				if (
					JSON.stringify(qa().story.state) === JSON.stringify(q.story.state) &&
					!qa().story.ended &&
					qa().story.choices.length === 0 &&
					qa().story.output.length === 0
				)
					failures.push({ type: "choice does nothing", scene: s, index });
				continue;
			}
			const hotspots = a.snapshot().hotspots;
			const expected = q.story.scene.hotspots;
			for (const h of expected)
				if (!hotspots.some((x) => x.id === h.id))
					failures.push({ type: "unreachable hotspot", scene: s, id: h.id });
			let action;
			if (config.archetype !== "rusher") {
				// Exhaust observations, conversations, and non-travel uses before leaving.
				const options = hotspots
					.flatMap((h) => h.verbs.map((verb) => ({ h, verb })))
					.sort(
						(a, b) =>
							({ look: 0, use: 1, talk: 2 })[a.verb] -
							{ look: 0, use: 1, talk: 2 }[b.verb],
					);
				action = options.find(
					({ h, verb }) =>
						!seen.has(s + ":" + h.id + ":" + verb) &&
						(verb === "look" ||
							verb === "talk" ||
							!(
								expected.find((x) => x.id === h.id)?.actions[
									verb.toUpperCase()
								] ?? []
							).some((l) => l.startsWith("-> "))),
				);
				if (!action && s === "town_square") {
					const id = !seen.has("town_square:grocery:use")
						? "grocery"
						: q.story.state.flags.knows_library_entrance &&
								!seen.has("library:window:use")
							? "library_direction"
							: undefined;
					if (id)
						action = { h: hotspots.find((h) => h.id === id), verb: "use" };
				}
			}
			if (!action) {
				const h = hotspots.find((h) => h.id === route(q));
				if (h)
					action = {
						h,
						verb: h.verbs.includes("talk")
							? "talk"
							: h.verbs.includes("use")
								? "use"
								: "look",
					};
			}
			if (!action?.h)
				throw Error(`Dead end: no hotspot advances the story at ${s}`);
			const { h, verb } = action,
				b = h.bounds;
			seen.add(s + ":" + h.id + ":" + verb);
			log({ hotspot: h.id, verb });
			const x = b.x + b.width / 2,
				y = b.y + b.height / 2;
			if (!(x >= 0 && x < 1920 && y > 100 && y < 1064))
				throw Error(`Unreachable hotspot ${s}/${h.id}: ${x},${y}`);
			// Same L/T/U keyboard selectors used by a human, followed by a real canvas click.
			window.dispatchEvent(
				new KeyboardEvent("keydown", {
					key: verb[0],
					code: "Key" + verb[0].toUpperCase(),
					keyCode: verb.toUpperCase().charCodeAt(0),
					bubbles: true,
				}),
			);
			a.click(x, y);
			await sleep(40);
			await a.waitUntil(
				() => qa().dialogueLocked || !a.scene.hermesMotor.walking,
				{ timeoutMs: 5000 },
			);
			await settle();
			if (qa().story === q.story)
				throw Error(`Unreachable hotspot: click ${s}/${h.id} did not dispatch`);
		}
		if (!qa().story.ended)
			failures.push({
				type: "dead end",
				scene: qa().story.state.scene,
				detail: "200 action budget exceeded",
			});
	} catch (error) {
		failures.push({
			type: "session failure",
			detail: String(error),
			scene: qa().story?.state.scene,
		});
		log("failure");
	} finally {
		window.removeEventListener("error", onError);
		window.removeEventListener("unhandledrejection", onError);
	}
	for (const detail of events) failures.push({ type: "error thrown", detail });
	return {
		passed: !failures.length,
		config,
		trace,
		failures,
		choiceCounts,
		final: state(),
	};
}
export async function runSession(session, config) {
	browser(
		session,
		"open",
		`http://localhost:8080/?act=${config.act}&mute=1&noticed=${config.noticed ? 1 : 0}`,
	);
	await poll(
		session,
		"!!window.__anima?.scene.getReviewQaSnapshot().story && !!window.__anima?.scene.getReviewQaSnapshot().dialogue",
	);
	evaluate(
		session,
		`window.__storyResult=null; (${player.toString()})(${JSON.stringify(config)}).then(r=>window.__storyResult=r).catch(e=>window.__storyResult={passed:false,failures:[{detail:String(e)}]}); true`,
	);
	return await poll(session, "window.__storyResult", config.timeout ?? 300000);
}
export async function playtest(act) {
	const session = `anima-act${act}`,
		name = `act${act}-playthrough`;
	try {
		browser(session, "open", `http://localhost:8080/?act=${act}&mute=1`);
		await poll(
			session,
			"!!window.__anima?.scene.getReviewQaSnapshot().dialogue",
		);
		evaluate(
			session,
			`window.__recordResult=null; window.__anima.record({name:${JSON.stringify(name)},ms:${act === "2" || act === "3b" ? 180000 : 120000}}).then(r=>window.__recordResult=r); true`,
		);
		evaluate(
			session,
			`window.__storyResult=null; (${player.toString()})(${JSON.stringify({ act, archetype: "curious", seed: 0, lineDelay: 300 })}).then(r=>window.__storyResult=r); true`,
		);
		const result = await poll(session, "window.__storyResult", 240000);
		result.recording = await poll(session, "window.__recordResult", 130000);
		browser(session, "screenshot", resolve(out, `act${act}-end.png`));
		writeFileSync(
			resolve(out, `act${act}-playtest.json`),
			JSON.stringify(result, null, 2),
		);
		console.log(
			JSON.stringify({
				act,
				passed: result.passed,
				failures: result.failures,
				recording: result.recording,
			}),
		);
		if (!result.passed) throw Error(`Act ${act} failed`);
	} finally {
		browser(session, "close");
	}
}
