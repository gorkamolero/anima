import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { loadStartupEnvironment } from "../src/startup.js";
import { langfuse, shutdownLangfuse, verdictScores } from "../src/lib/langfuse.js";
import { aggregateFloorScores, agreement, buildJudgeDataset, DATASET_NAME, type ExpectedFloor } from "../src/lib/judge-dataset.js";
import { asymmetricFloorJudge, FALSE_WALKABLE_THRESHOLD } from "../src/services/floor-judge.js";

const arg = (name: string) => process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
const count = Number(arg("n") ?? 2);
if (!Number.isInteger(count) || count < 1) throw new Error("--n must be a positive integer");
const snapshotOnly = process.argv.includes("--snapshot-only");
// Offline snapshot mode deliberately does not load credentials or initialize telemetry.
if (!snapshotOnly) loadStartupEnvironment();
try {
	const client = snapshotOnly ? undefined : langfuse();
	if (!snapshotOnly && !client) {
		// No keys: no API/model calls and no local changes.
	} else {
		const items = await buildJudgeDataset();
		if (snapshotOnly) {
			console.log(`Frozen ${items.length} cached inputs (${items.filter((item) => item.expectedOutput).length} reviewed) for ${DATASET_NAME}. No network calls.`);
		} else if (client) {
			if (items.length < count) throw new Error(`Only ${items.length} cached inputs available; requested ${count}`);
			const model = arg("model");
			const prompt = arg("prompt");
			const variant = arg("variant") ?? (model || prompt ? "vision-variant" : "baseline");
			await client.createDataset({ name: DATASET_NAME, description: "Frozen cached floor inputs; expected outputs only from explicit reviewer approvals." });
			for (const item of items) await client.createDatasetItem({
				datasetName: DATASET_NAME, id: item.id,
				input: { snapshotId: item.id, place: item.input.place, background: item.input.background },
				expectedOutput: item.expectedOutput,
				metadata: { snapshot: "api/data/langfuse-floor-places/items.json", encoding: "local-content-addressed-snapshot-v1" },
			});
			const dataset = await client.dataset.get(DATASET_NAME);
			const selected = items.slice(0, count).map((item) => {
				const hosted = dataset.items.find((entry) => entry.id === item.id);
				if (!hosted) throw new Error(`Dataset item missing: ${item.id}`);
				return hosted;
			});
			const result = await client.experiment.run({
				name: variant,
				runName: `${variant}-${new Date().toISOString()}`,
				data: selected,
				metadata: { variant, model: model ?? (prompt ? "google/gemini-2.5-flash" : "openai/gpt-6-luna-decisions"), fallbackModel: model ?? "google/gemini-2.5-flash", prompt: prompt ?? null, threshold: FALSE_WALKABLE_THRESHOLD, n: count },
				maxConcurrency: 1,
				task: async ({ input }) => {
					const snapshotId = (input as { snapshotId: string }).snapshotId;
					const frozen = items.find((item) => item.id === snapshotId)?.input;
					if (!frozen) throw new Error(`Unknown frozen snapshot: ${snapshotId}`);
					const temporary = await mkdtemp(resolve(tmpdir(), "anima-judge-"));
					try {
						const overlay = resolve(temporary, "overlay.png");
						const referencePath = resolve(temporary, "reference.png");
						await writeFile(overlay, Buffer.from(frozen.overlay, "base64"));
						await writeFile(referencePath, Buffer.from(frozen.image, "base64"));
						return await asymmetricFloorJudge(overlay, frozen.objects, frozen.ground, undefined, { model, prompt, variant, place: frozen.place, background: frozen.background, fresh: true, recordScores: false, outlines: frozen.outlines, referencePath, frozenLabels: true });
					} finally { await rm(temporary, { recursive: true, force: true }); }
				},
				evaluators: [async ({ output, expectedOutput }) => [
					...verdictScores(output, FALSE_WALKABLE_THRESHOLD),
					...agreement(output, expectedOutput as ExpectedFloor | undefined),
				]],
				runEvaluators: [async ({ itemResults }) => aggregateFloorScores(itemResults)],
			});
			console.log(await result.format());
		}
	}
} finally { await shutdownLangfuse(); }
