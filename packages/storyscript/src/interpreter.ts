#!/usr/bin/env tsx

import { readFileSync } from "node:fs";
import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";
import {
	parseStoryScript,
	StoryRuntime,
	type StoryRuntimeSnapshot,
	type StoryVerb,
	validateStoryGraph,
} from "./runtime";

const VERBS = new Set(["LOOK", "TALK", "USE"]);

async function main(): Promise<void> {
	const filePath = process.argv[2];
	if (!filePath) {
		console.log("Usage: tsx src/interpreter.ts <story.story>");
		process.exit(1);
	}

	const graph = parseStoryScript(readFileSync(filePath, "utf8"));
	const diagnostics = validateStoryGraph(graph);
	for (const diagnostic of diagnostics)
		console.warn(`[Story warning] ${diagnostic}`);

	const runtime = new StoryRuntime(graph);
	let snapshot = runtime.start();
	printSnapshot(snapshot);

	const rl = createInterface({ input, output });
	while (!snapshot.ended) {
		const answer = (await rl.question("\n> ")).trim();
		const command = answer.toLowerCase();
		if (command === "q" || command === "quit" || command === "exit") break;
		if (command === "look" || command === "l") snapshot = runtime.look();
		else if (command === "inventory" || command === "i")
			printInventory(snapshot);
		else if (command === "hotspots" || command === "h") printHotspots(snapshot);
		else if (snapshot.choices.length > 0 && /^\d+$/.test(command)) {
			snapshot = runtime.choose(Number(command) - 1);
		} else {
			snapshot = handleAction(runtime, snapshot, answer);
		}
		printSnapshot(snapshot);
	}
	rl.close();
}

function handleAction(
	runtime: StoryRuntime,
	snapshot: StoryRuntimeSnapshot,
	answer: string,
): StoryRuntimeSnapshot {
	const [rawVerb, ...targetParts] = answer.trim().split(/\s+/);
	const verb = rawVerb?.toUpperCase();
	const target = targetParts.join(" ").toLowerCase();
	if (!VERBS.has(verb) || !target) {
		console.log(
			'Commands: look, hotspots, inventory, "look/talk/use <target>", choice number, quit',
		);
		return snapshot;
	}

	const hotspot = snapshot.scene?.hotspots.find((item) => {
		const name = item.name.toLowerCase();
		return (
			item.id.toLowerCase() === target ||
			name === target ||
			name.includes(target)
		);
	});
	if (!hotspot) {
		console.log(`I don't see "${target}" here.`);
		return snapshot;
	}
	return runtime.perform(hotspot.id, verb as StoryVerb);
}

function printSnapshot(snapshot: StoryRuntimeSnapshot): void {
	for (const line of snapshot.output) console.log(line);
	if (snapshot.choices.length > 0) {
		console.log("\nChoices:");
		for (const choice of snapshot.choices)
			console.log(`${choice.index + 1}. ${choice.text}`);
	}
}

function printInventory(snapshot: StoryRuntimeSnapshot): void {
	console.log(
		snapshot.state.inventory.length > 0
			? snapshot.state.inventory.join(", ")
			: "Inventory is empty.",
	);
}

function printHotspots(snapshot: StoryRuntimeSnapshot): void {
	for (const hotspot of snapshot.scene?.hotspots ?? []) {
		const verbs = Object.keys(hotspot.actions).map((verb) =>
			verb.toLowerCase(),
		);
		console.log(`${hotspot.name} [${verbs.join(", ")}]`);
	}
}

main().catch((error: unknown) => {
	console.error(error);
	process.exit(1);
});
