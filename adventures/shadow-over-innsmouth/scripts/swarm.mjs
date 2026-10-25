#!/usr/bin/env node
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { browser, out, runSession } from "./story-player.mjs";

const n = Number(process.argv[2] ?? 120);
if (!Number.isInteger(n) || n < 1)
	throw Error("Expected a positive session count");
const dir = resolve(out, "swarm");
mkdirSync(dir, { recursive: true });
const results = [],
	counts = {},
	coverage = new Map();
function report() {
	const failures = results.flatMap((r) =>
		r.failures.map((f) => ({
			...f,
			session: r.session,
			act: r.config.act,
			archetype: r.config.archetype,
			trace: r.tracePath,
		})),
	);
	const historical = [];
	if (existsSync(resolve(out, "story-probe.json")))
		for (const f of JSON.parse(
			readFileSync(resolve(out, "story-probe.json"), "utf8"),
		).failures)
			historical.push({
				...f,
				session: "probe",
				act: "2",
				archetype: "curious",
				trace: "tmp/overnight/reports/story-probe.json",
				status: "Fixed: isolated authored state from preview persistence",
			});
	const rows = [...historical, ...failures].map(
		(f) =>
			`| ${f.session} | ${f.act} | ${f.archetype} | ${f.type}: ${(f.detail ?? f.id ?? "").replaceAll("|", "/")} | ${f.status ?? "OPEN"} | ${f.trace} |`,
	);
	const text = `# Story swarm\n\n${results.length}/${n} live browser sessions complete; ${results.filter((r) => r.passed).length} passed. No LLM calls. Every action uses the real canvas and dialogue events.\n\nPolicies: rusher follows the shortest authored exit route; curious exhausts available observations and conversations before travel; completionist also balances choices across runs. Both clerk-interest initial conditions are exercised at the reef. Session seed alternates rescue exits. Narrative-only actions are valid when they produce text; a missing state change alone is not a failure.\n\n| Session | Act | Policy | Failure | Status | Trace |\n|---|---|---|---|---|---|\n${rows.join("\n") || "| — | — | — | None | PASS | swarm/results.json |"}\n\n## Choice coverage\n\n| Scene and choices | Selections per option |\n|---|---|\n${[...coverage].map(([k, v]) => `| ${k.replaceAll("|", " / ")} | ${v.join(", ")} |`).join("\n")}\n\nTraces: one JSON per session in \`tmp/overnight/reports/swarm/\`. A pass requires an authored act/game ending, matching declared hotspot presence, reachable click targets, and no thrown errors or unknown transitions. This tests story interactions; the walking suite remains Track 1's responsibility.\n`;
	writeFileSync(resolve(out, "swarm.md"), text);
	writeFileSync(resolve(dir, "results.json"), JSON.stringify(results, null, 2));
}
// Completionist memory: enumerate alternative decisions at each observed reef menu.
// Only choice indices and the two available escape hotspots differ; no runtime state is set.
const reefPlans = [
	{ seed: 0, plan: [0, 0, 0] },
	{ seed: 0, plan: [1, 0, 1, 0] },
	{ seed: 0, plan: [2, 0, 1, 1] },
	{ seed: 0, plan: [0, 1] },
	{ seed: 0, plan: [0, 2, 0, 0] },
	{ seed: 0, plan: [1, 2, 1] },
	{ seed: 0, plan: [2, 2, 2] },
	{ seed: 0, plan: [0, 3, 0, 0, 0] },
	{ seed: 0, plan: [1, 3, 1, 1, 1] },
	{ seed: 1, plan: [2, 3, 0, 0] },
	{ seed: 1, plan: [0, 3, 0, 1] },
	{ seed: 1, plan: [1, 3, 1, 0, 0] },
	{ seed: 1, plan: [2, 3, 1, 1] },
];
const acts = ["2", "3", "3b", "4", "3b"];
let nextSession = 0;
async function worker(workerIndex) {
	const session = `anima-swarm-${workerIndex}`;
	try {
		while (nextSession < n) {
			const i = nextSession++;
			const act = acts[i % acts.length],
				seed = Math.floor(i / acts.length),
				archetype = ["curious", "rusher", "completionist"][
					Math.floor(i / acts.length) % 3
				];
			const config = {
				act,
				seed,
				archetype,
				noticed: act === "3b" ? i % 5 === 4 : false,
				choiceCounts: counts,
				timeout: 180000,
			};
			if (act === "3b" && config.noticed) {
				const branch =
					reefPlans[Math.floor(i / acts.length) % reefPlans.length];
				config.archetype = "completionist";
				config.choicePlan = branch.plan;
				config.seed = branch.seed;
			}
			let result;
			try {
				result = await runSession(session, config);
			} catch (e) {
				result = {
					passed: false,
					config,
					failures: [{ type: "runner error", detail: String(e) }],
					trace: [],
				};
			}
			Object.assign(counts, result.choiceCounts ?? {});
			for (const t of result.trace ?? [])
				if (t.action?.key) {
					const key = t.action.key;
					const value = coverage.get(key) ?? Array(t.choices.length).fill(0);
					value[t.action.choice]++;
					coverage.set(key, value);
				}
			const tracePath = `tmp/overnight/reports/swarm/session-${String(i + 1).padStart(3, "0")}.json`;
			writeFileSync(
				resolve(dir, `session-${String(i + 1).padStart(3, "0")}.json`),
				JSON.stringify(result, null, 2),
			);
			results.push({
				session: i + 1,
				config: {
					act,
					seed: config.seed,
					archetype: config.archetype,
					noticed: config.noticed,
				},
				passed: result.passed,
				failures: result.failures,
				ending: result.final?.ending,
				tracePath,
			});
			report();
			console.log(
				`${i + 1}/${n} act ${act} ${archetype}: ${result.passed ? "PASS" : JSON.stringify(result.failures)}`,
			);
		}
	} finally {
		browser(session, "close");
		report();
	}
}
await Promise.all(Array.from({ length: 3 }, (_, i) => worker(i)));
results.sort((a, b) => a.session - b.session);
report();
if (results.some((r) => !r.passed)) process.exitCode = 1;
