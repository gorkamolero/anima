import { fileURLToPath } from "node:url";
import {
	buildStoryDataset,
	createOfflineExperimentClient,
	parseOptions,
	runStoryExperiment,
} from "../src/lib/story-playtest-experiment.js";
import {
	createStoryAdapter,
	playStory,
	traceStory,
} from "../src/lib/story-playtest.js";

const options = parseOptions(process.argv.slice(2));
const root = fileURLToPath(new URL("../../", import.meta.url));
const items = await buildStoryDataset(root);
let shutdown = async () => {};
try {
	let client;
	let player;
	let judge;
	if (options.dryRun) {
		const { createStoryMock } = await import(
			"../src/lib/story-playtest-mock.js"
		);
		client = createOfflineExperimentClient();
		player = createStoryMock();
		judge = createStoryMock();
	} else {
		const { loadStartupEnvironment } = await import("../src/startup.js");
		loadStartupEnvironment();
		const { langfuse, shutdownLangfuse } = await import(
			"../src/lib/langfuse.js"
		);
		const { getModel } = await import("../src/lib/model.js");
		shutdown = shutdownLangfuse;
		client = langfuse();
		if (!client) throw new Error("Langfuse is not configured");
		player = getModel(options.playerModel);
		judge = getModel(options.judgeModel);
	}
	const adapter = createStoryAdapter(
		player,
		judge,
		options.variant,
		!options.dryRun,
	);
	const result = await runStoryExperiment(
		client,
		items,
		options,
		(source, input) =>
			traceStory(
				{ ...input, ...options },
				() => playStory(source, adapter, options.caps),
				!options.dryRun,
			),
	);
	console.log(await result.format());
} finally {
	await shutdown();
}
