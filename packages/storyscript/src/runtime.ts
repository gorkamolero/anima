export type StoryValue = string | number | boolean;

export interface StoryState {
	scene: string;
	inventory: string[];
	flags: Record<string, StoryValue>;
}

export interface StoryHotspot {
	id: string;
	name: string;
	bounds?: { x: number; y: number; width: number; height: number };
	actions: Partial<Record<StoryVerb, string[]>>;
}

export type StoryVerb = "LOOK" | "TALK" | "USE";

export interface StoryScene {
	id: string;
	originalId: string;
	location: string;
	description: string[];
	onEnter: string[];
	hotspots: StoryHotspot[];
	order: number;
}

export interface StoryDialogue {
	id: string;
	originalId: string;
	lines: string[];
	order: number;
}

export interface StoryTrigger {
	id: string;
	originalId: string;
	requirements: string[];
	cutscene: string[];
	goto?: string;
	order: number;
}

export interface StoryGraph {
	scenes: StoryScene[];
	dialogues: StoryDialogue[];
	triggers: StoryTrigger[];
}

export interface StoryChoice {
	index: number;
	text: string;
}

export interface StoryRuntimeSnapshot {
	state: StoryState;
	scene?: StoryScene;
	output: string[];
	choices: StoryChoice[];
	ended: boolean;
	ending?: string;
}

type StoryBlock = StoryScene | StoryDialogue | StoryTrigger;

interface ChoiceContent {
	text: string;
	content: string[];
}

export function parseStoryScript(source: string): StoryGraph {
	const parser = new StoryScriptParser(source);
	return parser.parse();
}

export function validateStoryGraph(graph: StoryGraph): string[] {
	const diagnostics: string[] = [];
	const targets = new Set<string>();

	for (const scene of graph.scenes) targets.add(scene.originalId);
	for (const dialogue of graph.dialogues) targets.add(dialogue.originalId);
	for (const trigger of graph.triggers) targets.add(trigger.originalId);
	targets.add("END");
	targets.add("ACT_END");
	targets.add("GAME_END");
	targets.add("GAME_END_TOGETHER");

	for (const scene of graph.scenes) {
		for (const line of [
			...scene.onEnter,
			...scene.hotspots.flatMap((h) => Object.values(h.actions).flat()),
		]) {
			const target = getGotoTarget(line);
			if (target && !targets.has(target))
				diagnostics.push(
					`Unknown target "${target}" in scene ${scene.originalId}`,
				);
		}
	}

	for (const dialogue of graph.dialogues) {
		for (const line of dialogue.lines) {
			const target = getGotoTarget(line);
			if (target && !targets.has(target))
				diagnostics.push(
					`Unknown target "${target}" in dialogue ${dialogue.originalId}`,
				);
		}
	}

	for (const trigger of graph.triggers) {
		if (trigger.goto && !targets.has(trigger.goto))
			diagnostics.push(
				`Unknown target "${trigger.goto}" in trigger ${trigger.originalId}`,
			);
	}

	return diagnostics;
}

export class StoryRuntime {
	private graph: StoryGraph;
	private inventory = new Set<string>();
	private flags: Record<string, StoryValue> = {};
	private currentSceneId = "";
	private output: string[] = [];
	private choices: ChoiceContent[] = [];
	private choiceOriginOrder = 0;
	private ended = false;
	private ending?: string;

	constructor(graph: StoryGraph, initialState?: Partial<StoryState>) {
		this.graph = graph;
		this.currentSceneId = initialState?.scene ?? graph.scenes[0]?.id ?? "";
		this.inventory = new Set(initialState?.inventory ?? []);
		this.flags = { ...(initialState?.flags ?? {}) };
	}

	start(): StoryRuntimeSnapshot {
		this.output = [];
		this.choices = [];
		this.ended = false;
		this.ending = undefined;
		const scene = this.currentScene();
		if (scene) this.enterScene(scene.id);
		return this.snapshot();
	}

	look(): StoryRuntimeSnapshot {
		this.output = [];
		this.choices = [];
		const scene = this.currentScene();
		if (scene) this.describeScene(scene, false);
		return this.snapshot();
	}

	perform(hotspotId: string, verb: StoryVerb): StoryRuntimeSnapshot {
		this.output = [];
		this.choices = [];
		const scene = this.currentScene();
		const hotspot = scene?.hotspots.find((item) => item.id === hotspotId);
		const lines = hotspot?.actions[verb] ?? [];
		if (!hotspot || lines.length === 0) {
			this.output.push("Nothing happens.");
			return this.snapshot();
		}
		this.executeLines(lines, scene?.order ?? 0);
		return this.snapshot();
	}

	choose(index: number): StoryRuntimeSnapshot {
		this.output = [];
		const selected = this.choices[index];
		this.choices = [];
		if (!selected) {
			this.output.push("That choice is no longer available.");
			return this.snapshot();
		}
		this.executeLines(selected.content, this.choiceOriginOrder);
		return this.snapshot();
	}

	snapshot(): StoryRuntimeSnapshot {
		return {
			state: {
				scene: this.currentSceneId,
				inventory: Array.from(this.inventory),
				flags: { ...this.flags },
			},
			scene: this.currentScene(),
			output: [...this.output],
			choices: this.choices.map((choice, index) => ({
				index,
				text: choice.text,
			})),
			ended: this.ended,
			ending: this.ending,
		};
	}

	private currentScene(): StoryScene | undefined {
		return this.graph.scenes.find((scene) => scene.id === this.currentSceneId);
	}

	private enterScene(sceneId: string): void {
		const scene = this.graph.scenes.find((item) => item.id === sceneId);
		if (!scene) {
			this.output.push(`[Scene not found: ${sceneId}]`);
			return;
		}
		this.currentSceneId = scene.id;
		this.describeScene(scene, true);
	}

	private describeScene(scene: StoryScene, includeOnEnter: boolean): void {
		this.output.push(`## ${scene.location || scene.originalId}`);
		this.executeLines(scene.description, scene.order, true);
		if (includeOnEnter) this.executeLines(scene.onEnter, scene.order, true);
	}

	private executeLines(
		lines: string[],
		originOrder: number,
		allowPlain = false,
	): void {
		let index = 0;
		while (index < lines.length && this.choices.length === 0 && !this.ended) {
			const line = lines[index]?.trim() ?? "";

			if (line.startsWith("IF ")) {
				const result = this.executeIfBlock(
					lines,
					index,
					originOrder,
					allowPlain,
				);
				index = result;
				continue;
			}

			if (line === "CHOICE") {
				const { nextIndex, choices } = this.parseChoiceBlock(lines, index);
				this.choices = choices;
				this.choiceOriginOrder = originOrder;
				index = nextIndex;
				continue;
			}

			const target = getGotoTarget(line);
			if (target) {
				this.goto(target, originOrder);
				return;
			}

			const rendered = this.executeSingleLine(line, allowPlain);
			if (rendered) this.output.push(rendered);
			index++;
		}
	}

	private executeIfBlock(
		lines: string[],
		startIndex: number,
		originOrder: number,
		allowPlain: boolean,
	): number {
		const condition = lines[startIndex].trim().replace(/^IF\s+/, "");
		let index = startIndex + 1;
		let depth = 1;
		let elseIndex = -1;
		let endIndex = lines.length;

		while (index < lines.length && depth > 0) {
			const line = lines[index].trim();
			if (line.startsWith("IF ")) depth++;
			else if (line === "ELSE" && depth === 1) elseIndex = index;
			else if (line === "END") {
				depth--;
				if (depth === 0) endIndex = index;
			}
			index++;
		}

		if (this.evaluateCondition(condition)) {
			this.executeLines(
				lines.slice(startIndex + 1, elseIndex === -1 ? endIndex : elseIndex),
				originOrder,
				allowPlain,
			);
		} else if (elseIndex !== -1) {
			this.executeLines(
				lines.slice(elseIndex + 1, endIndex),
				originOrder,
				allowPlain,
			);
		}
		return endIndex + 1;
	}

	private parseChoiceBlock(
		lines: string[],
		startIndex: number,
	): { choices: ChoiceContent[]; nextIndex: number } {
		const choices: ChoiceContent[] = [];
		let index = startIndex + 1;
		let depth = 1;
		let endIndex = lines.length;

		while (index < lines.length && depth > 0) {
			const line = lines[index].trim();
			if (line === "CHOICE") {
				depth++;
				index++;
				continue;
			}
			if (line === "END") {
				depth--;
				if (depth === 0) {
					endIndex = index;
					break;
				}
				index++;
				continue;
			}
			if (line.startsWith("> ") && depth === 1) {
				const text = cleanChoiceText(line.slice(2).trim());
				const content: string[] = [];
				let cursor = index + 1;
				let innerDepth = 0;
				while (cursor < lines.length) {
					const next = lines[cursor].trim();
					if (next === "CHOICE") innerDepth++;
					if (next === "END") {
						if (innerDepth > 0) innerDepth--;
						else break;
					}
					if (next.startsWith("> ") && innerDepth === 0) break;
					content.push(next);
					cursor++;
				}
				choices.push({ text, content });
				index = cursor;
				continue;
			}
			index++;
		}
		return { choices, nextIndex: endIndex + 1 };
	}

	private executeSingleLine(line: string, allowPlain: boolean): string | null {
		if (!line || line.startsWith("#")) return null;
		if (
			/^(SCENE|DIALOGUE|TRIGGER|HOTSPOT|DESCRIPTION|ON_ENTER|LOOK|TALK|USE|CHOICE|IF|ELSE|END|REQUIRE|CUTSCENE|AFTER|GAME|ACT_END|STATE_CHECK|TRACK|EXAMINE)\b/.test(
				line,
			)
		)
			return null;
		if (
			/^(location|time|mood|tension|expected_duration|emotional_beat|key_moment|author|act|title|name|summary|next):/.test(
				line,
			)
		)
			return null;

		if (line.startsWith("GIVE ")) {
			const item = line.replace("GIVE ", "").trim();
			this.inventory.add(item);
			return `[Received: ${item}]`;
		}
		if (line.startsWith("SET ")) {
			const match = line.match(/SET\s+(\w+)\s*=\s*(.+)/);
			if (match) this.flags[match[1]] = parseValue(match[2]);
			return null;
		}

		const speakerLine = line.match(/^(\w+)(?:\s+\(([^)]+)\))?:\s*"(.+)"$/);
		if (speakerLine) {
			const [, speaker, mode, text] = speakerLine;
			return mode ? `${speaker} (${mode}): ${text}` : `${speaker}: ${text}`;
		}

		if (line.startsWith('"') && line.endsWith('"')) return line.slice(1, -1);
		if (allowPlain && !line.startsWith(">") && !line.startsWith("->"))
			return line;
		return null;
	}

	private goto(target: string, originOrder: number): void {
		if (target === "END") return;
		if (target === "ACT_END") {
			const nextScene = this.graph.scenes.find(
				(scene) => scene.order > originOrder,
			);
			if (nextScene) this.enterScene(nextScene.id);
			return;
		}
		if (target === "GAME_END" || target === "GAME_END_TOGETHER") {
			this.ended = true;
			this.ending = target;
			this.output.push(
				target === "GAME_END_TOGETHER" ? "The end. Together." : "The end.",
			);
			return;
		}

		const block = this.findTarget(target, originOrder);
		if (!block) {
			this.output.push(`[Unknown target: ${target}]`);
			return;
		}
		if (isScene(block)) this.enterScene(block.id);
		else if (isDialogue(block)) this.executeLines(block.lines, block.order);
		else this.runTrigger(block);
	}

	private runTrigger(trigger: StoryTrigger): void {
		for (const req of trigger.requirements) {
			if (!this.evaluateCondition(req)) {
				this.output.push(`[Requirement not met: ${req}]`);
				return;
			}
		}
		this.executeLines(trigger.cutscene, trigger.order, true);
		if (trigger.goto) this.goto(trigger.goto, trigger.order);
	}

	private findTarget(
		target: string,
		originOrder: number,
	): StoryBlock | undefined {
		const blocks: StoryBlock[] = [
			...this.graph.scenes,
			...this.graph.dialogues,
			...this.graph.triggers,
		].sort((a, b) => a.order - b.order);
		return (
			blocks.find(
				(block) => block.originalId === target && block.order >= originOrder,
			) ?? blocks.find((block) => block.originalId === target)
		);
	}

	private evaluateCondition(condition: string): boolean {
		const cond = condition.trim();
		const notHas = cond.match(/^NOT HAS\((\w+)\)$/);
		if (notHas) return !this.inventory.has(notHas[1]);
		const has = cond.match(/^HAS\((\w+)\)$/);
		if (has) return this.inventory.has(has[1]);

		const comp = cond.match(/^(\w+)\s*(>=|<=|!=|==|=|>|<)\s*(.+)$/);
		if (comp) {
			const left = this.flags[comp[1]];
			const right = parseValue(comp[3]);
			switch (comp[2]) {
				case "=":
				case "==":
					return left === right;
				case "!=":
					return left !== right;
				case ">":
					return Number(left) > Number(right);
				case "<":
					return Number(left) < Number(right);
				case ">=":
					return Number(left) >= Number(right);
				case "<=":
					return Number(left) <= Number(right);
			}
		}
		return Boolean(this.flags[cond]);
	}
}

class StoryScriptParser {
	private lines: string[];
	private order = 0;
	private idCounts = new Map<string, number>();

	constructor(source: string) {
		this.lines = source.split(/\r?\n/);
	}

	parse(): StoryGraph {
		const graph: StoryGraph = { scenes: [], dialogues: [], triggers: [] };
		let index = 0;
		while (index < this.lines.length) {
			const line = this.lines[index].trim();
			if (line.startsWith("SCENE ")) {
				const [scene, next] = this.parseScene(index);
				graph.scenes.push(scene);
				index = next;
			} else if (line.startsWith("DIALOGUE ")) {
				const [dialogue, next] = this.parseDialogue(index);
				graph.dialogues.push(dialogue);
				index = next;
			} else if (line.startsWith("TRIGGER ")) {
				const [trigger, next] = this.parseTrigger(index);
				graph.triggers.push(trigger);
				index = next;
			} else {
				index++;
			}
		}
		return graph;
	}

	private parseScene(start: number): [StoryScene, number] {
		const originalId = this.lines[start].trim().replace("SCENE ", "").trim();
		const scene: StoryScene = {
			id: this.uniqueId(originalId),
			originalId,
			location: "",
			description: [],
			onEnter: [],
			hotspots: [],
			order: this.order++,
		};
		let index = start + 1;
		while (index < this.lines.length) {
			const line = this.lines[index].trim();
			if (
				(line === "END" && indentOf(this.lines[index]) === 0) ||
				isTopLevelBlock(line)
			)
				return [scene, line === "END" ? index + 1 : index];
			if (line.startsWith("location:"))
				scene.location = stripQuotes(line.replace("location:", "").trim());
			else if (line === "DESCRIPTION") {
				const [content, next] = parseSimpleBlock(this.lines, index + 1);
				scene.description = content;
				index = next;
				continue;
			} else if (line === "ON_ENTER") {
				const [content, next] = parseSimpleBlock(this.lines, index + 1);
				scene.onEnter = content;
				index = next;
				continue;
			} else if (line.startsWith("HOTSPOT ")) {
				const [hotspot, next] = parseHotspot(this.lines, index);
				scene.hotspots.push(hotspot);
				index = next;
				continue;
			}
			index++;
		}
		return [scene, index];
	}

	private parseDialogue(start: number): [StoryDialogue, number] {
		const originalId = this.lines[start].trim().replace("DIALOGUE ", "").trim();
		const dialogue: StoryDialogue = {
			id: this.uniqueId(originalId),
			originalId,
			lines: [],
			order: this.order++,
		};
		let index = start + 1;
		while (index < this.lines.length) {
			const line = this.lines[index].trim();
			if (
				(line === "END" && indentOf(this.lines[index]) === 0) ||
				isTopLevelBlock(line)
			)
				return [dialogue, line === "END" ? index + 1 : index];
			if (line && !line.startsWith("#")) dialogue.lines.push(line);
			index++;
		}
		return [dialogue, index];
	}

	private parseTrigger(start: number): [StoryTrigger, number] {
		const originalId = this.lines[start].trim().replace("TRIGGER ", "").trim();
		const trigger: StoryTrigger = {
			id: this.uniqueId(originalId),
			originalId,
			requirements: [],
			cutscene: [],
			order: this.order++,
		};
		let index = start + 1;
		while (index < this.lines.length) {
			const line = this.lines[index].trim();
			if (
				(line === "END" && indentOf(this.lines[index]) === 0) ||
				isTopLevelBlock(line)
			)
				return [trigger, line === "END" ? index + 1 : index];
			if (line.startsWith("REQUIRE "))
				trigger.requirements.push(line.replace("REQUIRE ", "").trim());
			else if (line === "CUTSCENE") {
				const [content, next] = parseSimpleBlock(this.lines, index + 1);
				trigger.cutscene = content;
				index = next;
				continue;
			} else if (line.startsWith("-> "))
				trigger.goto = line.replace("-> ", "").trim();
			index++;
		}
		return [trigger, index];
	}

	private uniqueId(originalId: string): string {
		const count = this.idCounts.get(originalId) ?? 0;
		this.idCounts.set(originalId, count + 1);
		return count === 0 ? originalId : `${originalId}__${count + 1}`;
	}
}

function parseHotspot(lines: string[], start: number): [StoryHotspot, number] {
	const header = lines[start].trim();
	const match = header.match(
		/^HOTSPOT\s+(\w+)(?:\s+\[(\d+),\s*(\d+),\s*(\d+),\s*(\d+)\])?/,
	);
	const hotspot: StoryHotspot = {
		id: match?.[1] ?? "unknown",
		name: match?.[1] ?? "Unknown",
		actions: {},
	};
	if (match?.[2]) {
		hotspot.bounds = {
			x: Number(match[2]),
			y: Number(match[3]),
			width: Number(match[4]),
			height: Number(match[5]),
		};
	}
	const baseIndent = indentOf(lines[start]);
	let index = start + 1;
	while (index < lines.length) {
		const line = lines[index].trim();
		const indent = indentOf(lines[index]);
		if (line === "END" && indent <= baseIndent + 2) return [hotspot, index + 1];
		if (line.startsWith("name:"))
			hotspot.name = stripQuotes(line.replace("name:", "").trim());
		else if (line === "LOOK" || line === "TALK" || line === "USE") {
			const [content, next] = parseActionBlock(lines, index + 1, indent);
			hotspot.actions[line] = content;
			index = next;
			continue;
		}
		index++;
	}
	return [hotspot, index];
}

function parseSimpleBlock(lines: string[], start: number): [string[], number] {
	const content: string[] = [];
	let index = start;
	while (index < lines.length) {
		const line = lines[index].trim();
		if (line === "END") return [content, index + 1];
		if (line && !line.startsWith("#")) content.push(line);
		index++;
	}
	return [content, index];
}

function parseActionBlock(
	lines: string[],
	start: number,
	actionIndent: number,
): [string[], number] {
	const content: string[] = [];
	let index = start;
	while (index < lines.length) {
		const line = lines[index].trim();
		if (line === "END" && indentOf(lines[index]) === actionIndent)
			return [content, index + 1];
		if (line && !line.startsWith("#")) content.push(line);
		index++;
	}
	return [content, index];
}

function getGotoTarget(line: string): string | undefined {
	return line.trim().startsWith("-> ")
		? line.trim().replace("-> ", "").trim()
		: undefined;
}

function isTopLevelBlock(line: string): boolean {
	return (
		line.startsWith("SCENE ") ||
		line.startsWith("DIALOGUE ") ||
		line.startsWith("TRIGGER ")
	);
}

function indentOf(line: string): number {
	return line.match(/^(\s*)/)?.[1].length ?? 0;
}

function cleanChoiceText(text: string): string {
	if (text.startsWith("[") && text.includes("]"))
		return text.slice(1, text.indexOf("]"));
	if (text.startsWith('"') && text.includes('"', 1))
		return text.slice(1, text.lastIndexOf('"'));
	return text;
}

function parseValue(value: string): StoryValue {
	const trimmed = value.trim().replace(/^"|"$/g, "");
	if (trimmed === "true") return true;
	if (trimmed === "false") return false;
	if (/^-?\d+$/.test(trimmed)) return Number(trimmed);
	return trimmed;
}

function stripQuotes(value: string): string {
	return value.replace(/^"|"$/g, "");
}

function isScene(block: StoryBlock): block is StoryScene {
	return "hotspots" in block;
}

function isDialogue(block: StoryBlock): block is StoryDialogue {
	return "lines" in block;
}
