import { LangfuseClient, type Evaluation } from "@langfuse/client";
import { LangfuseSpanProcessor } from "@langfuse/otel";
import { startActiveObservation, startObservation, propagateAttributes } from "@langfuse/tracing";
import { NodeSDK } from "@opentelemetry/sdk-node";
import type { GroundVerdict } from "../services/ground.js";

let runtime: { client: LangfuseClient; processor: LangfuseSpanProcessor; sdk: NodeSDK } | undefined;
let stopped = false;
export function langfuse() {
	if (!process.env.LANGFUSE_PUBLIC_KEY || !process.env.LANGFUSE_SECRET_KEY || stopped) return undefined;
	if (!runtime) {
		const config = {
			publicKey: process.env.LANGFUSE_PUBLIC_KEY,
			secretKey: process.env.LANGFUSE_SECRET_KEY,
			baseUrl: process.env.LANGFUSE_BASE_URL || "https://cloud.langfuse.com",
		};
		const processor = new LangfuseSpanProcessor(config);
		const sdk = new NodeSDK({ spanProcessors: [processor] });
		sdk.start();
		runtime = { client: new LangfuseClient(config), processor, sdk };
		process.once("beforeExit", shutdownLangfuse);
		for (const signal of ["SIGINT", "SIGTERM"] as const) {
			process.once(signal, async () => {
				await shutdownLangfuse();
				process.kill(process.pid, signal);
			});
		}
	}
	return runtime.client;
}
export async function flushLangfuse() {
	if (runtime) await Promise.all([runtime.client.flush(), runtime.processor.forceFlush()]);
}
export async function shutdownLangfuse() {
	if (!runtime || stopped) return;
	stopped = true;
	await flushLangfuse().catch(() => {});
	await Promise.allSettled([runtime.client.shutdown(), runtime.sdk.shutdown()]);
}
export function judgeTelemetry(functionId: string, metadata: Record<string, string> = {}) {
	return langfuse() ? { isEnabled: true, functionId, recordInputs: true, recordOutputs: true, metadata } : undefined;
}
export interface JudgeTraceContext {
	place?: string;
	background?: string;
	variant?: string;
	model?: string;
	prompt?: string;
	sessionId?: string;
}
export async function traceJudge<T>(judge: string, context: JudgeTraceContext, task: (setQuestions: (questions: unknown) => void) => Promise<T>): Promise<T> {
	if (!langfuse()) return task(() => {});
	return propagateAttributes({ traceName: "judge-floor", sessionId: context.sessionId, tags: ["anima", "floor-judge", context.variant ?? "baseline"], metadata: { variant: context.variant ?? "baseline", ...(context.model ? { model: context.model } : {}) } }, () => startActiveObservation("judge-floor", async (span) => {
		const input = { place: context.place ?? null, background: context.background ?? null, questions: [] as unknown };
		const metadata = { judge, ...context, variant: context.variant ?? "baseline" };
		span.update({ input, metadata });
		try {
			const result = await task((questions) => {
				input.questions = questions;
				span.update({ input });
			});
			const verdicts = (Array.isArray(result) ? result : [result]) as GroundVerdict[];
			const output = {
				pass: verdicts.every((verdict) => verdict?.pass === true),
				why: verdicts.map((verdict) => verdict?.why).filter(Boolean).join("; "),
				probabilities: verdicts.length === 1 ? verdicts[0]?.probabilities ?? {} : verdicts.map((verdict) => verdict?.probabilities ?? {}),
			};
			span.update({ output, metadata: { ...metadata, rawOutput: result } });
			return result;
		} catch (error) {
			span.update({ level: "ERROR", statusMessage: "Judge invocation failed" });
			span.update({ output: { error: "Judge invocation failed" } });
			throw error;
		}
	}, { asType: "evaluator" }));
}
export function verdictScores(verdict: GroundVerdict, threshold: number): Evaluation[] {
	const scores: Evaluation[] = [{ name: "floor_pass", value: Number(verdict.pass), dataType: "BOOLEAN", comment: verdict.why }];
	if (verdict.probabilities) {
		const hazards = Object.entries(verdict.probabilities).filter(([name]) => {
			const question = verdict.questions?.[name];
			return question?.type === "noul" && !question.advisory;
		});
		const comment = JSON.stringify({ why: verdict.why, threshold, probabilities: verdict.probabilities, questions: verdict.questions });
		scores.push(
			{ name: "false_walkable_max_probability", value: Math.max(0, ...hazards.map(([, probability]) => probability)), dataType: "NUMERIC", comment },
			{ name: "floor_failed_questions", value: hazards.filter(([, probability]) => probability >= threshold).length, dataType: "NUMERIC", comment },
		);
	}
	if (verdict.deterministic) {
		const comment = JSON.stringify({ why: verdict.why, threshold: 0.2, outlines: verdict.deterministic });
		scores.push(
			{ name: "floor_outline_max_fraction", value: Math.max(0, ...verdict.deterministic.map((outline) => outline.fraction)), dataType: "NUMERIC", comment },
			{ name: "floor_outline_failed", value: verdict.deterministic.filter((outline) => !outline.pass).length, dataType: "NUMERIC", comment },
		);
	}
	return scores;
}
export function scoreVerdict(verdict: GroundVerdict, threshold: number) {
	const client = langfuse();
	if (client) for (const score of verdictScores(verdict, threshold)) client.score.activeTrace(score);
}
export async function traceDecision<T extends { usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number; cost?: number } }>(model: string, task: () => Promise<T>, input?: unknown): Promise<T> {
	if (!langfuse()) return task();
	return startActiveObservation("decide-floor-hazards", async (generation) => {
		generation.update({ model, input });
		try {
			const result = await task();
			const usage = result.usage;
			generation.update({ output: result, usageDetails: usage ? {
				...(usage.prompt_tokens === undefined ? {} : { input: usage.prompt_tokens }),
				...(usage.completion_tokens === undefined ? {} : { output: usage.completion_tokens }),
				...(usage.total_tokens === undefined ? {} : { total: usage.total_tokens }),
			} : undefined, costDetails: usage?.cost === undefined ? undefined : { total: usage.cost } });
			return result;
		} catch (error) {
			generation.update({ level: "ERROR", statusMessage: "Decision request failed" });
			throw error;
		}
	}, { asType: "generation" });
}

export interface PlaythroughResult {
	trace?: Array<{ time: number; action: string; scene?: string; [key: string]: unknown }>;
	failures?: unknown[];
	final?: { ended?: boolean };
}
/** Scripted browser results only: these are not AI judgments. */
export async function tracePlaythrough<T>(input: { session?: string; sessionId?: string; variant?: string; act?: string; script?: string; config?: Record<string, unknown>; [key: string]: unknown }, task: () => Promise<T>, resultOf: (result: T) => PlaythroughResult = (r) => r as PlaythroughResult): Promise<T> {
	const client = langfuse();
	if (!client) return task();
	const variant = input.variant ?? String(input.config?.archetype ?? "scripted");
	try {
		return await propagateAttributes({ traceName: "play-story", sessionId: input.sessionId ?? input.session, tags: ["anima", "playthrough", variant], metadata: { variant } }, () => startActiveObservation("play-story", async (span) => {
			const summary = { harness: input.script ?? "story-player", act: input.act ?? input.config?.act ?? null };
			const metadata = { kind: "scripted-browser-playthrough", variant, rawInput: input };
			span.update({ input: summary, metadata });
			const record = (result: PlaythroughResult) => {
				const failures = result.failures ?? [];
				client.score.activeTrace({ name: "ended", value: Number(result.final?.ended === true), dataType: "BOOLEAN", comment: "Scripted completion state; no AI evaluator." });
				client.score.activeTrace({ name: "failure_count", value: failures.length, dataType: "NUMERIC", comment: JSON.stringify(failures) });
				const steps = result.trace ?? [];
				for (const [i, step] of steps.entries()) {
					const child = startObservation("play-step", { input: { scene: step.scene, action: step.action }, metadata: { scene: step.scene, action: step.action, rawStep: step } }, { startTime: new Date(step.time) });
					child.end(new Date(steps[i + 1]?.time ?? step.time));
				}
				for (const failure of failures) startObservation("record-playthrough-failure", { output: failure, level: "ERROR" }, { asType: "event" }).end();
				const output = { ended: result.final?.ended === true, failure_count: failures.length, failures, steps: steps.length };
				span.update({ output, metadata: { ...metadata, rawOutput: result } });
			};
			try {
				const value = await task();
				record(resultOf(value));
				return value;
			} catch (error) {
				record((error as { playthrough?: PlaythroughResult })?.playthrough ?? { failures: [String(error)], final: { ended: false } });
				throw error;
			}
		}));
	} finally {
		await flushLangfuse().catch(() => {});
	}
}
