// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
	load: vi.fn(), build: vi.fn(), judge: vi.fn(), shutdown: vi.fn(),
	createDataset: vi.fn(), createDatasetItem: vi.fn(), get: vi.fn(), run: vi.fn(), client: vi.fn(),
	mkdir: vi.fn(async () => "/tmp/test-judge"), write: vi.fn(), rm: vi.fn(),
}));
vi.mock("../../startup.js", () => ({ loadStartupEnvironment: mocks.load }));
vi.mock("node:fs/promises", () => ({ mkdtemp: mocks.mkdir, writeFile: mocks.write, rm: mocks.rm }));
vi.mock("../../lib/langfuse.js", () => ({ langfuse: mocks.client, shutdownLangfuse: mocks.shutdown, verdictScores: () => [{ name: "floor_pass", value: 1, dataType: "BOOLEAN" }] }));
vi.mock("../../lib/judge-dataset.js", () => ({ buildJudgeDataset: mocks.build, DATASET_NAME: "anima-floor-places", agreement: () => [], aggregateFloorScores: () => [] }));
vi.mock("../../services/floor-judge.js", () => ({ asymmetricFloorJudge: mocks.judge, FALSE_WALKABLE_THRESHOLD: 0.6 }));
const originalArgv = process.argv;
beforeEach(() => {
	vi.resetModules(); vi.clearAllMocks();
	vi.spyOn(console, "log").mockImplementation(() => {});
	process.argv = ["node", "script"];
	mocks.client.mockReturnValue(undefined);
});
afterEach(() => { process.argv = originalArgv; vi.restoreAllMocks(); });
it("does nothing without Langfuse keys after reusing startup loading", async () => {
	await import("../../../scripts/langfuse-judge-experiment.js");
	expect(mocks.load).toHaveBeenCalledOnce();
	expect(mocks.build).not.toHaveBeenCalled(); expect(mocks.judge).not.toHaveBeenCalled();
});
it("runs the default two hosted items, variant configuration, evaluations and cleanup", async () => {
	process.argv.push("--variant=test-variant", "--model=test/model", "--prompt=Check the silhouette");
	const items = ["a", "b", "c"].map((id) => ({ id, datasetId: "hosted-dataset", input: { image: "eA==", overlay: "eA==", objects: [], outlines: [], ground: {} } }));
	mocks.build.mockResolvedValue(items);
	mocks.get.mockResolvedValue({ items: [...items].reverse().map((item) => ({ ...item, input: { snapshotId: item.id } })) });
	mocks.judge.mockResolvedValue({ pass: true, why: "safe" });
	mocks.client.mockReturnValue({ api: { datasets: { create: mocks.createDataset }, datasetItems: { create: mocks.createDatasetItem } }, dataset: { get: mocks.get }, experiment: { run: mocks.run } });
	mocks.run.mockImplementation(async (config) => {
		expect(config.data.map((item: { id: string }) => item.id)).toEqual(["a", "b"]);
		expect(config.runName).toMatch(/^test-variant-/);
		expect(config.maxConcurrency).toBe(1);
		for (const item of config.data) await config.task(item);
		expect(await config.evaluators[0]({ output: { pass: true } })).toEqual([expect.objectContaining({ name: "floor_pass" })]);
		await config.runEvaluators[0]({ itemResults: [] });
		return { format: async () => "done" };
	});
	await import("../../../scripts/langfuse-judge-experiment.js");
	expect(mocks.createDataset).toHaveBeenCalledWith(expect.objectContaining({ name: "anima-floor-places" }));
	expect(mocks.createDatasetItem).toHaveBeenCalledTimes(3);
	expect(mocks.judge).toHaveBeenCalledTimes(2);
	expect(mocks.judge.mock.calls[0][4]).toMatchObject({ model: "test/model", prompt: "Check the silhouette", fresh: true, frozenLabels: true, recordScores: false });
	expect(mocks.rm).toHaveBeenCalledTimes(2); expect(mocks.shutdown).toHaveBeenCalledOnce();
});
it("snapshot-only never loads keys or initializes a client", async () => {
	process.argv.push("--snapshot-only"); mocks.build.mockResolvedValue([]);
	await import("../../../scripts/langfuse-judge-experiment.js");
	expect(mocks.load).not.toHaveBeenCalled(); expect(mocks.client).not.toHaveBeenCalled(); expect(mocks.judge).not.toHaveBeenCalled();
});
