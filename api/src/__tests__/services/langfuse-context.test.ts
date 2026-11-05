// @vitest-environment node
import { expect, it, vi } from "vitest";
import { generateObject } from "ai";
import { z } from "zod";
import { getActiveTraceId, startActiveObservation } from "@langfuse/tracing";

const captured = vi.hoisted(() => ({ spans: [] as any[], scores: [] as any[] }));
// Real NodeSDK and Langfuse tracing; replace only the network sinks.
vi.mock("@langfuse/otel", () => ({ LangfuseSpanProcessor: class {
	onStart() {}
	onEnd(span: unknown) { captured.spans.push(span); }
	async forceFlush() {}
	async shutdown() {}
} }));
vi.mock("@langfuse/client", () => ({ LangfuseClient: class {
	score = { activeTrace: (score: unknown) => captured.scores.push({ score, traceId: getActiveTraceId() }) };
	async flush() {}
	async shutdown() {}
} }));

it("keeps judge generations and scores on the caller trace, and separates playthrough traces", async () => {
	vi.stubEnv("LANGFUSE_PUBLIC_KEY", "test"); vi.stubEnv("LANGFUSE_SECRET_KEY", "test");
	const listener = vi.spyOn(process, "once").mockReturnValue(process);
	const { langfuse, traceJudge, traceDecision, scoreVerdict, tracePlaythrough, judgeTelemetry, shutdownLangfuse } = await import("../../lib/langfuse.js");
	try {
		langfuse();
		let callerId: string | undefined;
		await startActiveObservation("experiment-item", async () => {
			callerId = getActiveTraceId();
			await traceJudge("floor", { place: "pier", background: "/pier.png", variant: "candidate", model: "model" }, async (setQuestions) => {
				setQuestions([{ name: "environment", instructions: "Water?" }]);
				await traceDecision("model", async () => ({ usage: { prompt_tokens: 2, completion_tokens: 1 } }));
				scoreVerdict({ pass: true, why: "clear" }, 0.6);
				return { pass: true, why: "clear", probabilities: { environment: 0.1 } };
			});
		});
		expect(callerId).toMatch(/^[a-f0-9]{32}$/);
		expect(captured.spans.map((span) => span.name)).toEqual(["decide-floor-hazards", "judge-floor", "experiment-item"]);
		expect(captured.spans.every((span) => span.spanContext().traceId === callerId)).toBe(true);
		expect(captured.scores[0].traceId).toBe(callerId);
		const judge = captured.spans.find((span) => span.name === "judge-floor");
		expect(judge.attributes["langfuse.observation.type"]).toBe("evaluator");
		expect(judge.attributes["langfuse.trace.tags"]).toEqual(["anima", "floor-judge", "candidate"]);
		expect(JSON.parse(judge.attributes["langfuse.trace.input"])).toMatchObject({ place: "pier", background: "/pier.png", questions: [{ name: "environment" }] });
		expect(JSON.parse(judge.attributes["langfuse.trace.output"])).toEqual({ pass: true, why: "clear", probabilities: { environment: 0.1 } });
		// Exercise the actual AI SDK telemetry with an entirely local provider stub.
		await traceJudge("floor", {}, async () => (await generateObject({
			model: { specificationVersion: "v2", provider: "stub", modelId: "local-vision", supportedUrls: {}, doGenerate: async () => ({ content: [{ type: "text", text: '{"pass":true}' }], finishReason: "stop", usage: { inputTokens: 5, outputTokens: 3 }, warnings: [] }), doStream: async () => { throw Error("unused"); } },
			schema: z.object({ pass: z.boolean() }),
			messages: [{ role: "user", content: [{ type: "text", text: "Is this floor safe?" }, { type: "image", image: new URL("data:image/png;base64,aW1hZ2U="), mediaType: "image/png" }] }],
			experimental_telemetry: judgeTelemetry("answer-floor-question", { question: "environment" }),
		})).object);
		const modelSpan = captured.spans.find((span) => span.name.startsWith("ai.generateObject.doGenerate"));
		expect(modelSpan.attributes["gen_ai.request.model"]).toBe("local-vision");
		expect(modelSpan.attributes["ai.prompt.messages"]).toContain("Is this floor safe?");
		expect(modelSpan.attributes["ai.prompt.messages"]).toContain('"mediaType":"image/png"');
		expect(modelSpan.attributes["ai.prompt.messages"]).toContain('"data":"aW1hZ2U="');
		expect(modelSpan.attributes["gen_ai.usage.input_tokens"]).toBe(5);
		await tracePlaythrough({ session: "game-session", variant: "curious" }, async () => ({ final: { ended: true }, failures: [] }));
		const play = captured.spans.find((span) => span.name === "play-story");
		expect(play.spanContext().traceId).not.toBe(callerId);
		expect(play.attributes["session.id"]).toBe("game-session");
		expect(play.attributes["langfuse.trace.tags"]).toEqual(["anima", "playthrough", "curious"]);
		expect(JSON.parse(play.attributes["langfuse.trace.output"])).toMatchObject({ ended: true, failure_count: 0 });
		expect(captured.scores.filter((entry) => entry.score.name === "ended")[0].traceId).toBe(play.spanContext().traceId);
	} finally {
		await shutdownLangfuse(); listener.mockRestore(); vi.unstubAllEnvs();
	}
});
