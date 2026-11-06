import { describe, expect, it } from "vitest";
import {
	playStory,
	type Decision,
	type PlaytestAdapter,
	type Verdict,
} from "./playtester.js";
const verdict: Verdict = {
	pacing: 7,
	engagement: 8,
	clarity: 9,
	overall: 8,
	reasons: "Clear progress.",
	suggestions: [],
	emotionalArc: "Discovery.",
};
const story = `SCENE room
  DESCRIPTION
    A door.
  END
  HOTSPOT door
    TALK
      CHOICE
        > Leave
          -> outside
      END
    END
  END
END
SCENE outside
  DESCRIPTION
    Daylight.
  END
  HOTSPOT exit
    USE
      -> GAME_END
    END
  END
END`;
function adapter(decisions: Decision[]): PlaytestAdapter {
	return {
		decide: async () => ({
			value: decisions.shift() ?? {
				kind: "perform",
				hotspotId: "door",
				verb: "TALK",
				reason: "Explore",
			},
			costUsd: 0.01,
		}),
		judgeScene: async () => ({ value: verdict, costUsd: 0.02 }),
		judgeAct: async () => ({ value: verdict, costUsd: 0.03 }),
	};
}
const route: Decision[] = [
	{ kind: "perform", hotspotId: "door", verb: "TALK", reason: "Talk" },
	{ kind: "choose", index: 0, reason: "Leave" },
	{ kind: "perform", hotspotId: "exit", verb: "USE", reason: "Finish" },
];
describe("story playtester", () => {
	it("plays the real runtime through dialogue to an ending and computes facts", async () => {
		const report = await playStory(story, adapter([...route]));
		expect(report).toMatchObject({
			reachedEnding: true,
			scenesVisited: 2,
			scenesInAct: 2,
			sceneCoverage: 1,
			stuck: false,
			invalidActions: 0,
			deadReferences: [],
			modelCalls: 6,
			stopReason: "ending",
		});
		expect(report.costUsd).toBeCloseTo(0.1);
		expect(report.scenes[0].steps[0].before.hotspots[0]).toEqual({
			id: "door",
			name: "door",
			verbs: ["TALK"],
		});
		expect(JSON.stringify(report.scenes[0].steps[0].before)).not.toContain(
			"GAME_END",
		);
	});
	it("rejects invalid actions without losing dialogue choices", async () => {
		const report = await playStory(
			story,
			adapter([
				route[0],
				{ kind: "choose", index: 99, reason: "Mistake" },
				...route.slice(1),
			]),
		);
		expect(report.invalidActions).toBe(1);
		expect(report.reachedEnding).toBe(true);
	});
	it.each([
		[{ maxActions: 1 }, "max_actions_per_scene"],
		[{ maxScenes: 1 }, "max_scenes"],
		[{ maxModelCalls: 2 }, "max_model_calls"],
	])("stops at cap %j", async (caps, reason) => {
		const report = await playStory(story, adapter([...route]), caps);
		expect(report.stopReason).toBe(reason);
		expect(report.reachedEnding).toBe(false);
		expect(report.modelCalls).toBeLessThanOrEqual(caps.maxModelCalls ?? 120);
	});
	it("detects stuck and dead references independently", async () => {
		const report = await playStory(
			"SCENE empty\nEND\nDIALOGUE broken\n  -> missing\nEND",
			adapter([]),
		);
		expect(report.stuck).toBe(true);
		expect(report.deadReferences).toHaveLength(1);
		expect(report.reachedEnding).toBe(false);
	});
	it("counts automatic scene visits and records their visible text", async () => {
		const report = await playStory(
			"SCENE a\n  ON_ENTER\n    -> b\n  END\nEND\nSCENE b\n  ON_ENTER\n    -> GAME_END\n  END\nEND",
			adapter([]),
		);
		expect(report.scenesVisited).toBe(2);
		expect(report.modelCalls).toBe(3);
		expect(report.reachedEnding).toBe(true);
	});
	it("counts failed calls and never invents their cost", async () => {
		const mock = adapter([]);
		mock.decide = async () => {
			throw new Error("transport");
		};
		const report = await playStory(story, mock);
		expect(report.stopReason).toBe("player_error");
		expect(report.modelCalls).toBe(3);
		expect(report.costUsd).toBeNull();
	});
	it("caps automatic scene loops inside a single runtime action", async () => {
		const report = await playStory(
			"SCENE loop\n  ON_ENTER\n    -> loop\n  END\nEND",
			adapter([]),
			{ maxScenes: 3 },
		);
		expect(report.stopReason).toBe("max_scenes");
		expect(report.scenes).toHaveLength(3);
		expect(report.reachedEnding).toBe(false);
		expect(report.modelCalls).toBe(4);
	});
	it("can finish a single-scene story with a scene cap of one", async () => {
		const report = await playStory(
			"SCENE room\n  HOTSPOT door\n    TALK\n      -> GAME_END\n    END\n  END\nEND",
			adapter([]),
			{ maxScenes: 1 },
		);
		expect(report.reachedEnding).toBe(true);
		expect(report.scenes).toHaveLength(1);
	});
});
