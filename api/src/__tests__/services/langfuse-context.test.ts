// @vitest-environment node
import { expect, it, vi } from "vitest";
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
	const { langfuse, traceJudge, traceDecision, scoreVerdict, tracePlaythrough, shutdownLangfuse } = await import("../../lib/langfuse.js");
	try {
		langfuse();
		let callerId: string | undefined;
		await startActiveObservation("experiment-item", async () => {
			callerId = getActiveTraceId();
			await traceJudge("floor", {}, async () => {
				await traceDecision("model", async () => ({ usage: { prompt_tokens: 2, completion_tokens: 1 } }));
				scoreVerdict({ pass: true, why: "clear" }, 0.6);
			});
		});
		expect(callerId).toMatch(/^[a-f0-9]{32}$/);
		expect(captured.spans.map((span) => span.name)).toEqual(["floor-decisions", "anima-floor-judge", "experiment-item"]);
		expect(captured.spans.every((span) => span.spanContext().traceId === callerId)).toBe(true);
		expect(captured.scores[0].traceId).toBe(callerId);
		await tracePlaythrough({}, async () => ({ final: { ended: true }, failures: [] }));
		const play = captured.spans.find((span) => span.name === "anima-playthrough");
		expect(play.spanContext().traceId).not.toBe(callerId);
		expect(captured.scores.filter((entry) => entry.score.name === "ended")[0].traceId).toBe(play.spanContext().traceId);
	} finally {
		await shutdownLangfuse(); listener.mockRestore(); vi.unstubAllEnvs();
	}
});
