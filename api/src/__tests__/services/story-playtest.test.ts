import { resolve } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
	createStoryAdapter,
	playStory,
	storyScores,
	aggregateStoryScores,
	SCORE_NAMES,
	RUN_SCORE_NAMES,
	decisionSchema,
	verdictSchema,
} from "../../lib/story-playtest.js";
import { createStoryMock } from "../../lib/story-playtest-mock.js";
import {
	ACT_IDS,
	buildStoryDataset,
	createOfflineExperimentClient,
	parseOptions,
	runStoryExperiment,
} from "../../lib/story-playtest-experiment.js";
const source = `SCENE start
  DESCRIPTION
    Find the exit.
  END
  HOTSPOT exit
    USE
      -> GAME_END
    END
  END
END`;
describe("AI story experiment offline", () => {
	it("uses AI SDK mock structured output and fixed typed scores", async () => {
		const network = vi
			.spyOn(globalThis, "fetch")
			.mockRejectedValue(new Error("Network prohibited"));
		try {
			const player = createStoryMock(),
				judge = createStoryMock();
			const report = await playStory(
				source,
				createStoryAdapter(player, judge, "curious-explorer"),
			);
			expect(report).toMatchObject({
				reachedEnding: true,
				modelCalls: 3,
				costUsd: 0,
				sceneCoverage: 1,
			});
			expect(player.doGenerateCalls).toHaveLength(1);
			expect(judge.doGenerateCalls).toHaveLength(2);
			const scores = storyScores(report);
			expect(scores.map((s) => s.name)).toEqual(SCORE_NAMES);
			expect(
				scores.every(
					(s) => s.dataType === "NUMERIC" || s.dataType === "BOOLEAN",
				),
			).toBe(true);
			expect(scores.find((s) => s.name === "act_overall")?.value).toBe(7);
			expect(
				aggregateStoryScores([{ evaluations: scores }]).map((s) => s.name),
			).toEqual(RUN_SCORE_NAMES);
			expect(
				aggregateStoryScores([{ evaluations: scores }]).map((s) => s.value),
			).toEqual([7, 1, 1]);
			expect(network).not.toHaveBeenCalled();
		} finally {
			network.mockRestore();
		}
	});
	it("upserts exactly five stable items and runs selected acts with all evaluators", async () => {
		const items = await buildStoryDataset(resolve(process.cwd()));
		expect(items.map((i) => i.input.actId)).toEqual(ACT_IDS);
		expect(items.every((i) => i.metadata.sceneCount > 0)).toBe(true);
		const client = createOfflineExperimentClient();
		const options = parseOptions([
			"--dry-run",
			"--acts=act1,act4",
			"--variant=impatient-player",
			"--max-actions=2",
		]);
		const task = vi.fn(async () =>
			playStory(
				source,
				createStoryAdapter(
					createStoryMock(),
					createStoryMock(),
					options.variant,
				),
			),
		);
		for (let i = 0; i < 2; i++) {
			const result = await runStoryExperiment(client, items, options, task);
			const output = JSON.parse(await result.format());
			expect(output.itemResults).toHaveLength(2);
			expect(
				output.runEvaluations.map((e: { name: string }) => e.name),
			).toEqual(RUN_SCORE_NAMES);
		}
		expect(
			(await client.dataset.get("innsmouth-story-acts")).items,
		).toHaveLength(5);
		expect(task).toHaveBeenCalledTimes(4);
	});
	it("validates CLI values and schemas before any network work", () => {
		expect(() => parseOptions(["--acts=full_game"])).toThrow();
		expect(() => parseOptions(["--max-actions=0"])).toThrow();
		expect(() => parseOptions(["--variant=unknown"])).toThrow();
		expect(
			decisionSchema.safeParse({ kind: "choose", reason: "Missing index" })
				.success,
		).toBe(false);
		expect(verdictSchema.safeParse({ pacing: 11 }).success).toBe(false);
	});
});
