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
	it("finishes playback before judging, retries parse failures once, and continues judging", async () => {
		const player = createStoryMock(),
			judge = createStoryMock();
		const generate = judge.doGenerate;
		let attempts = 0;
		judge.doGenerate = async (options) => {
			expect(player.doGenerateCalls).toHaveLength(2);
			expect(options.maxOutputTokens).toBe(16384);
			attempts++;
			const result = await generate(options);
			// Both attempts at scene one fail; scene two succeeds; act fails once then succeeds.
			return [1, 2, 4].includes(attempts)
				? { ...result, content: [{ type: "text", text: "not JSON" }] }
				: result;
		};
		const twoScenes =
			source.replace("-> GAME_END", "-> next") +
			"\n" +
			source.replace("SCENE start", "SCENE next");
		const report = await playStory(
			twoScenes,
			createStoryAdapter(player, judge, "curious-explorer"),
		);
		expect(report).toMatchObject({
			reachedEnding: true,
			stopReason: "ending",
			unjudgedScenes: 1,
			modelCalls: 7,
			callsWithoutCost: 3,
		});
		expect(attempts).toBe(5);
		expect(report.scenes[1].verdict).toBeDefined();
		expect(report.actVerdict).toBeDefined();
		expect(report.evaluationErrors).toEqual(["scene_judge_error:start"]);
	});
	it("passes deterministic facts and incomplete-act instructions to the act judge", async () => {
		const judge = createStoryMock();
		const incomplete =
			source.replace("-> GAME_END", "-> missing") + "\nSCENE unseen\nEND";
		const report = await playStory(
			incomplete,
			createStoryAdapter(createStoryMock(), judge, "curious-explorer"),
			{ maxActions: 1 },
		);
		const call = judge.doGenerateCalls.at(-1)!;
		const user = call.prompt
			.filter((m) => m.role === "user")
			.flatMap((m) => m.content)
			.filter((c) => c.type === "text")
			.map((c) => c.text)
			.join("");
		expect(JSON.parse(user).facts).toEqual({
			reachedEnding: false,
			sceneCoverage: 0.5,
			stopReason: "max_actions_per_scene",
			stuck: false,
			invalidActions: 0,
			deadReferences: ['Unknown target "missing" in scene start'],
		});
		expect(JSON.stringify(call.prompt)).toContain(
			"An unfinished act cannot score as a finished one",
		);
		expect(report.reachedEnding).toBe(false);
	});
	it("always emits known cost with missing-call count and dead-reference names", async () => {
		const judge = createStoryMock(),
			player = createStoryMock();
		const generate = judge.doGenerate;
		let calls = 0;
		judge.doGenerate = async (options) => {
			const result = await generate(options);
			return {
				...result,
				providerMetadata:
					++calls === 1 ? {} : { openrouter: { usage: { cost: 0.25 } } },
			};
		};
		const report = await playStory(
			source + "\nDIALOGUE broken\n  -> grocery_store\nEND",
			createStoryAdapter(player, judge, "curious-explorer"),
		);
		const scores = storyScores(report);
		expect(report).toMatchObject({
			costUsd: 0.25,
			callsWithoutCost: 1,
			costComplete: false,
		});
		expect(scores.find((s) => s.name === "cost_usd")).toMatchObject({
			value: 0.25,
			dataType: "NUMERIC",
			comment: expect.stringContaining("1 calls lacked cost"),
		});
		expect(scores.find((s) => s.name === "dead_references")).toMatchObject({
			value: 1,
			dataType: "NUMERIC",
			comment: expect.stringContaining("grocery_store"),
		});
	});
	it("counts retry attempts against the hard total cap", async () => {
		const judge = createStoryMock();
		const generate = judge.doGenerate;
		judge.doGenerate = async (options) => ({
			...(await generate(options)),
			content: [{ type: "text", text: "bad JSON" }],
		});
		const report = await playStory(
			source,
			createStoryAdapter(createStoryMock(), judge, "curious-explorer"),
			{ maxModelCalls: 4 },
		);
		expect(report).toMatchObject({
			modelCalls: 4,
			reachedEnding: true,
			stopReason: "ending",
			unjudgedScenes: 1,
			callsWithoutCost: 3,
		});
		expect(report.actVerdict).toBeUndefined();
	});
});
