import {
	parseStoryScript,
	StoryRuntime,
	validateStoryGraph,
	type StoryRuntimeSnapshot,
	type StoryVerb,
} from "./runtime.js";

export const DEFAULT_CAPS = {
	maxActions: 12,
	maxScenes: 20,
	maxModelCalls: 120,
};
export type Decision = {
	kind: "perform" | "choose";
	hotspotId?: string;
	verb?: StoryVerb;
	index?: number;
	reason: string;
};
export type Verdict = {
	pacing: number;
	engagement: number;
	clarity: number;
	overall: number;
	reasons: string;
	suggestions: string[];
	emotionalArc: string;
};
export type PlayerView = ReturnType<typeof playerView>;
export type SceneRecord = {
	sceneId: string;
	text: string[];
	steps: Array<{
		before: PlayerView;
		decision: Decision;
		valid: boolean;
		output: string[];
	}>;
	verdict?: Verdict;
};
export interface ModelResult<T> {
	value: T;
	costUsd: number | null;
}
export interface ActFacts {
	reachedEnding: boolean;
	sceneCoverage: number;
	stopReason: string;
	stuck: boolean;
	invalidActions: number;
	deadReferences: string[];
}
export interface PlaytestAdapter {
	retryableJudgeError?(error: unknown): boolean;
	decide(input: {
		snapshot: PlayerView;
		transcript: SceneRecord[];
	}): Promise<ModelResult<Decision>>;
	judgeScene(scene: SceneRecord): Promise<ModelResult<Verdict>>;
	judgeAct(input: {
		scenes: SceneRecord[];
		facts: ActFacts;
	}): Promise<ModelResult<Verdict>>;
	scene?<T>(scene: SceneRecord, task: () => Promise<T>): Promise<T>;
}
export function playerView(snapshot: StoryRuntimeSnapshot) {
	return {
		sceneId: snapshot.state.scene,
		location: snapshot.scene?.location,
		text: snapshot.output,
		inventory: snapshot.state.inventory,
		hotspots: snapshot.choices.length
			? []
			: (snapshot.scene?.hotspots ?? []).map((h) => ({
					id: h.id,
					name: h.name,
					verbs: (Object.keys(h.actions) as StoryVerb[]).filter(
						(v) => h.actions[v]?.length,
					),
				})),
		choices: snapshot.choices,
		ended: snapshot.ended,
		ending: snapshot.ending,
	};
}
export async function playStory(
	source: string,
	adapter: PlaytestAdapter,
	options: Partial<typeof DEFAULT_CAPS> = {},
) {
	const caps = { ...DEFAULT_CAPS, ...options };
	for (const [key, value] of Object.entries(caps))
		if (!Number.isSafeInteger(value) || value < 1)
			throw new Error(`${key} must be a positive integer`);
	const graph = parseStoryScript(source);
	const runtime = new StoryRuntime(graph, undefined, [], {
		maxSceneVisits: caps.maxScenes,
	});
	const scenes: SceneRecord[] = [];
	let modelCalls = 0,
		knownCostUsd = 0,
		callsWithoutCost = 0,
		invalidActions = 0;
	let stopReason = "";
	let actVerdict: Verdict | undefined;
	const evaluationErrors: string[] = [];
	const actions = new Map<string, number>();
	const account = <T>(result: ModelResult<T>) => {
		if (result.costUsd === null) callsWithoutCost++;
		else knownCostUsd += result.costUsd;
		return result.value;
	};
	const ingest = (snapshot: StoryRuntimeSnapshot) => {
		const visits = snapshot.visits ?? [];
		for (const [i, visit] of visits.entries())
			scenes.push({
				sceneId: visit.scene.id,
				text: snapshot.output.slice(
					visit.outputStart,
					visits[i + 1]?.outputStart,
				),
				steps: [],
			});
	};
	let snapshot = runtime.start();
	ingest(snapshot);
	if (!scenes.length) stopReason = "no_start_scene";
	stopReason ||= snapshot.halted ?? "";
	for (let cursor = 0; cursor < scenes.length; cursor++) {
		const record = scenes[cursor];
		const task = async () => {
			while (!stopReason && !snapshot.ended && cursor === scenes.length - 1) {
				const view = playerView(snapshot);
				if (
					!view.choices.length &&
					!view.hotspots.some((h) => h.verbs.length)
				) {
					stopReason = "stuck";
					break;
				}
				if ((actions.get(record.sceneId) ?? 0) >= caps.maxActions) {
					stopReason = "max_actions_per_scene";
					break;
				}
				// Reserve two evaluation calls; all judgments and retries run after playback.
				if (modelCalls >= caps.maxModelCalls - 2) {
					stopReason = "max_model_calls";
					break;
				}
				modelCalls++;
				let decision: Decision;
				try {
					decision = account(
						await adapter.decide({ snapshot: view, transcript: scenes }),
					);
				} catch {
					callsWithoutCost++;
					stopReason = "player_error";
					break;
				}
				actions.set(record.sceneId, (actions.get(record.sceneId) ?? 0) + 1);
				const valid =
					decision.kind === "choose"
						? view.choices.some((c) => c.index === decision.index)
						: !view.choices.length &&
							view.hotspots.some(
								(h) =>
									h.id === decision.hotspotId &&
									h.verbs.includes(decision.verb!),
							);
				if (!valid) invalidActions++;
				// Reject invalid decisions without erasing live dialogue choices in the runtime.
				const next = valid
					? decision.kind === "choose"
						? runtime.choose(decision.index!)
						: runtime.perform(decision.hotspotId!, decision.verb!)
					: {
							...snapshot,
							output: ["Invalid action; choose from the available actions."],
							visits: [],
						};
				record.steps.push({
					before: view,
					decision,
					valid,
					output: next.output,
				});
				snapshot = next;
				stopReason ||= snapshot.halted ?? "";
				ingest(snapshot);
			}
		};
		if (adapter.scene) await adapter.scene(record, task);
		else await task();
		if (cursor + 1 >= caps.maxScenes) {
			stopReason ||= "max_scenes";
			break;
		}
	}
	stopReason = snapshot.ended ? "ending" : stopReason || "max_model_calls";
	const facts: ActFacts = {
		reachedEnding: snapshot.ended,
		stopReason,
		sceneCoverage: graph.scenes.length
			? new Set(scenes.map((s) => s.sceneId)).size / graph.scenes.length
			: 0,
		stuck:
			!snapshot.ended &&
			!snapshot.choices.length &&
			!playerView(snapshot).hotspots.some((h) => h.verbs.length),
		invalidActions,
		deadReferences: validateStoryGraph(graph),
	};
	// Playback is complete. Judge failures cannot affect runtime or stopReason.
	const judge = async (
		task: () => Promise<ModelResult<Verdict>>,
		label: string,
		reserve: number,
	) => {
		for (
			let attempt = 0;
			attempt < 2 && modelCalls < caps.maxModelCalls - reserve;
			attempt++
		) {
			modelCalls++;
			try {
				return account(await task());
			} catch (error) {
				callsWithoutCost++;
				if (
					attempt === 0 &&
					adapter.retryableJudgeError?.(error) &&
					modelCalls < caps.maxModelCalls - reserve
				)
					continue;
				evaluationErrors.push(label);
				return undefined;
			}
		}
		evaluationErrors.push(`${label}:max_model_calls`);
		return undefined;
	};
	for (const scene of scenes)
		scene.verdict = await judge(
			() => adapter.judgeScene(scene),
			`scene_judge_error:${scene.sceneId}`,
			1,
		);
	actVerdict = await judge(
		() => adapter.judgeAct({ scenes, facts }),
		"act_judge_error",
		0,
	);

	return {
		scenes,
		actVerdict,
		stopReason,
		evaluationErrors,
		reachedEnding: snapshot.ended,
		ending: snapshot.ending,
		stuck:
			!snapshot.ended &&
			!snapshot.choices.length &&
			!playerView(snapshot).hotspots.some((h) => h.verbs.length),
		scenesVisited: new Set(scenes.map((s) => s.sceneId)).size,
		scenesInAct: graph.scenes.length,
		sceneCoverage: graph.scenes.length
			? new Set(scenes.map((s) => s.sceneId)).size / graph.scenes.length
			: 0,
		invalidActions,
		deadReferences: validateStoryGraph(graph),
		modelCalls,
		costUsd: knownCostUsd,
		knownCostUsd,
		costComplete: callsWithoutCost === 0,
		callsWithoutCost,
		unjudgedScenes: scenes.filter((s) => !s.verdict).length,
	};
}
export type PlaytestReport = Awaited<ReturnType<typeof playStory>>;
