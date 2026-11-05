// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
	const observation = { update: vi.fn(), end: vi.fn() };
	return { observation, score: vi.fn(), active: vi.fn(async (_name, task) => task(observation)), start: vi.fn(() => observation), client: vi.fn(), sdk: vi.fn(), flush: vi.fn(), shutdown: vi.fn() };
});
vi.mock("@langfuse/client", () => ({ LangfuseClient: class {
	score = { activeTrace: mocks.score };
	flush = mocks.flush;
	shutdown = mocks.shutdown;
	constructor(config: unknown) { mocks.client(config); }
} }));
vi.mock("@langfuse/tracing", () => ({ startActiveObservation: mocks.active, startObservation: mocks.start, propagateAttributes: (_attributes: unknown, task: () => unknown) => task() }));
vi.mock("@langfuse/otel", () => ({ LangfuseSpanProcessor: class { forceFlush = mocks.flush; } }));
vi.mock("@opentelemetry/sdk-node", () => ({ NodeSDK: class { start = mocks.sdk; shutdown = mocks.shutdown; } }));
beforeEach(() => {
	vi.resetModules(); vi.clearAllMocks();
	vi.stubEnv("LANGFUSE_PUBLIC_KEY", ""); vi.stubEnv("LANGFUSE_SECRET_KEY", "");
	vi.spyOn(process, "once").mockReturnValue(process);
});
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks(); });
it("silently preserves results and exceptions without keys and never initializes exporters", async () => {
	const lf = await import("../../lib/langfuse.js");
	expect(await lf.traceJudge("test", {}, async () => 42)).toBe(42);
	expect(await lf.tracePlaythrough({}, async () => "same")).toBe("same");
	expect(await lf.traceDecision("test", async () => ({ usage: {} }))).toEqual({ usage: {} });
	await expect(lf.traceJudge("test", {}, async () => { throw Error("original"); })).rejects.toThrow("original");
	lf.scoreVerdict({ pass: false, why: "reason" }, 0.6);
	expect(lf.judgeTelemetry("test")).toBeUndefined();
	await lf.shutdownLangfuse();
	expect(mocks.client).not.toHaveBeenCalled(); expect(mocks.active).not.toHaveBeenCalled();
});
it("records verdict reasoning, inclusive hazard threshold, advisory coverage and outline arithmetic", async () => {
	const { verdictScores } = await import("../../lib/langfuse.js");
	const scores = verdictScores({ pass: false, why: "water", probabilities: { environment: 0.6, rug: 1 }, questions: {
		environment: { type: "noul", instructions: "water?", criteria: { true: "yes", false: "no" } },
		rug: { type: "noul", advisory: true, instructions: "rug?", criteria: { true: "yes", false: "no" } },
	}, deterministic: [{ name: "pool", fraction: 0.5, pixels: 10, covered: 5, pass: false }] }, 0.6);
	expect(scores).toEqual(expect.arrayContaining([
		expect.objectContaining({ name: "floor_pass", value: 0, dataType: "BOOLEAN", comment: "water" }),
		expect.objectContaining({ name: "false_walkable_max_probability", value: 0.6 }),
		expect.objectContaining({ name: "floor_failed_questions", value: 1 }),
		expect.objectContaining({ name: "floor_outline_max_fraction", value: 0.5, dataType: "NUMERIC" }),
	]));
	expect(scores.map((score) => score.name).sort()).toEqual(["floor_pass", "false_walkable_max_probability", "floor_failed_questions", "floor_outline_max_fraction", "floor_outline_failed"].sort());
	expect(scores.find((score) => score.name === "floor_outline_failed")?.value).toBe(1);
	expect(scores.find((score) => score.name === "floor_outline_max_fraction")?.comment).toContain('"name":"pool"');
});
it("initializes once from env, captures Decisions usage/cost and flushes on shutdown", async () => {
	vi.stubEnv("LANGFUSE_PUBLIC_KEY", "test-public"); vi.stubEnv("LANGFUSE_SECRET_KEY", "test-secret");
	vi.stubEnv("LANGFUSE_BASE_URL", "https://example.invalid");
	const lf = await import("../../lib/langfuse.js");
	await lf.traceJudge("asymmetricFloorJudge", {}, async () => {
		lf.scoreVerdict({ pass: true, why: "clear" }, 0.6);
		return lf.traceDecision("decision-model", async () => ({ usage: { prompt_tokens: 10, completion_tokens: 4, total_tokens: 14, cost: 0.002 } }));
	});
	expect(lf.judgeTelemetry("label-floor-outlines")).toMatchObject({ recordInputs: true, recordOutputs: true });
	expect(mocks.client).toHaveBeenCalledTimes(1);
	expect(mocks.client).toHaveBeenCalledWith(expect.objectContaining({ baseUrl: "https://example.invalid" }));
	expect(mocks.active.mock.calls.map((call) => call[0])).toEqual(["judge-floor", "decide-floor-hazards"]);
	expect(mocks.observation.update).toHaveBeenCalledWith(expect.objectContaining({ usageDetails: { input: 10, output: 4, total: 14 }, costDetails: { total: 0.002 } }));
	expect(mocks.score).toHaveBeenCalledWith(expect.objectContaining({ name: "floor_pass", comment: "clear" }));
	await lf.shutdownLangfuse(); await lf.shutdownLangfuse();
	expect(mocks.shutdown).toHaveBeenCalledTimes(2);
	expect(mocks.flush).toHaveBeenCalledTimes(2);
});
it("emits scripted step spans, completion and every failure without model calls", async () => {
	vi.stubEnv("LANGFUSE_PUBLIC_KEY", "test"); vi.stubEnv("LANGFUSE_SECRET_KEY", "test");
	const lf = await import("../../lib/langfuse.js");
	const result = { trace: [{ time: 1000, scene: "depot", action: "start" }, { time: 2000, scene: "town", action: "end" }], failures: ["one", "two"], final: { ended: true } };
	expect(await lf.tracePlaythrough({}, async () => result)).toBe(result);
	expect(mocks.score).toHaveBeenCalledWith(expect.objectContaining({ name: "ended", value: 1, dataType: "BOOLEAN" }));
	expect(mocks.score).toHaveBeenCalledWith(expect.objectContaining({ name: "failure_count", value: 2, dataType: "NUMERIC" }));
	expect(mocks.start.mock.calls[0][1]).toMatchObject({ metadata: { scene: "depot", action: "start" } });
	expect(mocks.start.mock.calls.map((call) => call[0])).toEqual(["play-step", "play-step", "record-playthrough-failure", "record-playthrough-failure"]);
	await expect(lf.tracePlaythrough({}, async () => { throw Error("browser unavailable"); })).rejects.toThrow("browser unavailable");
	expect(mocks.score).toHaveBeenCalledWith(expect.objectContaining({ name: "ended", value: 0 }));
});

it("keeps score names fixed with many object IDs, excluding advisory and coverage probabilities", async () => {
	const { verdictScores } = await import("../../lib/langfuse.js");
	const hazards = Array.from({ length: 100 }, (_, i) => `object_${i}`);
	const scores = verdictScores({ pass: false, why: "hazards", probabilities: {
		...Object.fromEntries(hazards.map((name) => [name, 0.6])), rug: 1, coverage: 1,
	}, questions: {
		...Object.fromEntries(hazards.map((name) => [name, { type: "noul" as const, instructions: name, criteria: { true: "yes", false: "no" } }])),
		rug: { type: "noul", advisory: true, instructions: "rug", criteria: { true: "yes", false: "no" } },
		coverage: { type: "score", instructions: "coverage", criteria: ["coverage"] },
	}, deterministic: hazards.map((name) => ({ name: `${name}-shelves-9`, fraction: 0.5, pixels: 10, covered: 5, pass: false })) }, 0.6);
	expect(scores).toHaveLength(5);
	expect(scores.find((score) => score.name === "false_walkable_max_probability")?.value).toBe(0.6);
	expect(scores.find((score) => score.name === "floor_failed_questions")?.value).toBe(100);
	expect(scores.find((score) => score.name === "floor_outline_failed")?.value).toBe(100);
	expect(scores.some((score) => score.name.includes("object_") || score.name.includes("shelves"))).toBe(false);
});
