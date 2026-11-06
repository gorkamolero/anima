import { propagateAttributes } from "@langfuse/tracing";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import type {
	ExperimentItem,
	ExperimentItemResult,
	ExperimentParams,
	Evaluation,
} from "@langfuse/client";
import { parseStoryScript } from "../../../packages/storyscript/src/runtime.js";
import { DEFAULT_CAPS } from "../../../packages/storyscript/src/playtester.js";
import {
	aggregateStoryScores,
	PERSONAS,
	storyScores,
} from "./story-playtest.js";

export const DATASET_NAME = "innsmouth-story-acts";
export const ACT_IDS = [
	"act1",
	"act2",
	"act3",
	"act3b_devil_reef",
	"act4",
] as const;
export function parseOptions(args: string[]) {
	const allowed = [
		"variant",
		"acts",
		"player-model",
		"judge-model",
		"max-actions",
		"max-scenes",
		"max-model-calls",
		"run-name",
	];
	for (const arg of args)
		if (
			arg !== "--dry-run" &&
			!allowed.some((name) => arg.startsWith(`--${name}=`))
		)
			throw new Error(`Unknown option: ${arg.split("=")[0]}`);
	const get = (name: string) =>
		args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
	const variant = get("variant") ?? "curious-explorer";
	if (!(variant in PERSONAS)) throw new Error(`Unknown variant: ${variant}`);
	const acts = get("acts")?.split(",") ?? [...ACT_IDS];
	if (
		!acts.length ||
		acts.some((id) => !(ACT_IDS as readonly string[]).includes(id)) ||
		new Set(acts).size !== acts.length
	)
		throw new Error("Select unique supported act IDs");
	const cap = (name: string, fallback: number) => {
		const value = Number(get(name) ?? fallback);
		if (!Number.isSafeInteger(value) || value < 1)
			throw new Error(`--${name} must be a positive integer`);
		return value;
	};
	return {
		variant: variant as keyof typeof PERSONAS,
		acts,
		dryRun: args.includes("--dry-run"),
		playerModel: get("player-model") ?? "google/gemini-2.5-flash",
		judgeModel: get("judge-model") ?? "google/gemini-2.5-pro",
		runName: get("run-name") ?? `${variant}-${new Date().toISOString()}`,
		caps: {
			maxActions: cap("max-actions", DEFAULT_CAPS.maxActions),
			maxScenes: cap("max-scenes", DEFAULT_CAPS.maxScenes),
			maxModelCalls: cap("max-model-calls", DEFAULT_CAPS.maxModelCalls),
		},
	};
}
export async function buildStoryDataset(root: string) {
	return Promise.all(
		ACT_IDS.map(async (actId) => {
			const path = `adventures/shadow-over-innsmouth/story/${actId}.story`;
			const source = await readFile(resolve(root, path), "utf8");
			return {
				id: createHash("sha256")
					.update(`${DATASET_NAME}:${actId}`)
					.digest("hex"),
				input: { actId, path },
				metadata: {
					sceneCount: parseStoryScript(source).scenes.length,
					sourceSha256: createHash("sha256").update(source).digest("hex"),
				},
				source,
			};
		}),
	);
}
type DatasetEntry = Omit<
	Awaited<ReturnType<typeof buildStoryDataset>>[number],
	"source"
> & { datasetName: string };
export interface StoryExperimentClient {
	api: {
		datasets: {
			create(input: { name: string; description: string }): Promise<unknown>;
		};
		datasetItems: { create(input: DatasetEntry): Promise<unknown> };
	};
	dataset: { get(name: string): Promise<{ items: ExperimentItem[] }> };
	experiment: {
		run(config: ExperimentParams): Promise<{ format(): Promise<string> }>;
	};
}
export async function runStoryExperiment(
	client: StoryExperimentClient,
	items: Awaited<ReturnType<typeof buildStoryDataset>>,
	options: ReturnType<typeof parseOptions>,
	task: (
		source: string,
		input: { actId: string; path: string },
	) => Promise<unknown>,
) {
	await client.api.datasets.create({
		name: DATASET_NAME,
		description:
			"Independent Innsmouth acts evaluated from player-visible runtime transcripts.",
	});
	for (const { source: _, ...item } of items)
		await client.api.datasetItems.create({
			...item,
			datasetName: DATASET_NAME,
		});
	const dataset = await client.dataset.get(DATASET_NAME);
	const data = options.acts.map((id) => {
		const item = dataset.items.find(
			(item) => (item.input as { actId: string })?.actId === id,
		);
		if (!item) throw new Error(`Missing dataset act: ${id}`);
		return item;
	});
	return propagateAttributes({ traceName: "play-story-act" }, () =>
		client.experiment.run({
			name: "innsmouth-playtest",
			runName: options.runName,
			data,
			maxConcurrency: 1,
			metadata: {
				variant: options.variant,
				playerModel: options.playerModel,
				judgeModel: options.judgeModel,
				...options.caps,
				dryRun: options.dryRun,
			},
			task: async ({ input }) => {
				const item = items.find(
					(item) =>
						item.input.actId === input?.actId &&
						item.input.path === input?.path,
				);
				if (!item)
					throw new Error("Dataset input does not match local act manifest");
				return task(item.source, item.input);
			},
			evaluators: [async ({ output }) => storyScores(output)],
			runEvaluators: [
				async ({ itemResults }) => aggregateStoryScores(itemResults),
			],
		}),
	);
}
/** Offline transport runs the same task and evaluator callbacks without initializing Langfuse. */
export function createOfflineExperimentClient(): StoryExperimentClient {
	const entries = new Map<string, DatasetEntry>();
	return {
		api: {
			datasets: { create: async () => undefined },
			datasetItems: {
				create: async (entry) => {
					entries.set(entry.id, entry);
				},
			},
		},
		dataset: { get: async () => ({ items: [...entries.values()] }) },
		experiment: {
			run: async (config) => {
				const itemResults: ExperimentItemResult[] = [];
				for (const item of config.data as ExperimentItem[]) {
					const output = await config.task(item);
					const evaluations: Evaluation[] = [];
					for (const evaluate of config.evaluators ?? [])
						evaluations.push(
							...[
								await evaluate({
									input: item.input,
									output,
									metadata: item.metadata as
										| Record<string, unknown>
										| undefined,
								}),
							].flat(),
						);
					itemResults.push({ item, output, evaluations });
				}
				const runEvaluations: Evaluation[] = [];
				for (const evaluate of config.runEvaluators ?? [])
					runEvaluations.push(...[await evaluate({ itemResults })].flat());
				return {
					format: async () =>
						JSON.stringify(
							{
								mode: "offline-mock",
								name: config.name,
								runName: config.runName,
								itemResults,
								runEvaluations,
							},
							null,
							2,
						),
				};
			},
		},
	};
}
