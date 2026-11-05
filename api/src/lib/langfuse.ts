import { LangfuseClient, type Evaluation } from "@langfuse/client";
import { LangfuseSpanProcessor } from "@langfuse/otel";
import { startActiveObservation, startObservation } from "@langfuse/tracing";
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
export function judgeTelemetry(functionId: string) {
	return langfuse() ? { isEnabled: true, functionId, recordInputs: false, recordOutputs: true } : undefined;
}
export async function traceJudge<T>(judge: string, input: unknown, task: () => Promise<T>): Promise<T> {
	if (!langfuse()) return task();
	return startActiveObservation("anima-floor-judge", async (span) => {
		span.update({ input, metadata: { judge } });
		try {
			const result = await task();
			span.update({ output: result });
			return result;
		} catch (error) {
			span.update({ level: "ERROR", statusMessage: "Judge invocation failed" });
			throw error;
		}
	});
}
export function verdictScores(verdict: GroundVerdict, threshold: number, prefix = ""): Evaluation[] {
	const scores: Evaluation[] = [{ name: `${prefix}floor_pass`, value: Number(verdict.pass), dataType: "BOOLEAN", comment: verdict.why }];
	const evidence = (verdict as GroundVerdict & { evidence?: Array<{ name: string; evidence: string }> }).evidence;
	for (const [name, probability] of Object.entries(verdict.probabilities ?? {})) {
		const question = verdict.questions?.[name];
		const comment = evidence?.find((e) => e.name === name)?.evidence ?? verdict.why;
		scores.push({ name: `${prefix}floor_probability_${name}`, value: probability, dataType: "NUMERIC", comment });
		if (question?.type === "noul") scores.push({
			name: `${prefix}floor_${question.advisory ? "coverage" : "pass"}_${name}`,
			value: Number(question.advisory ? probability >= threshold : probability < threshold), dataType: "BOOLEAN", comment,
		});
	}
	if (verdict.probabilities) scores.push({ name: `${prefix}false_walkable_threshold`, value: threshold, dataType: "NUMERIC", comment: "Hazard probabilities at or above this threshold fail; advisory coverage does not." });
	for (const outline of verdict.deterministic ?? []) {
		for (const metric of ["fraction", "pixels", "covered"] as const) scores.push({ name: `${prefix}floor_outline_${outline.name}_${metric}`, value: outline[metric], dataType: "NUMERIC", comment: verdict.why });
		scores.push({ name: `${prefix}floor_outline_${outline.name}_pass`, value: Number(outline.pass), dataType: "BOOLEAN", comment: verdict.why });
	}
	if (verdict.deterministic?.length) scores.push({ name: `${prefix}floor_outline_threshold`, value: 0.2, dataType: "NUMERIC", comment: "Eroded outline overlap above 0.2 fails." });
	return scores;
}
export function scoreVerdict(verdict: GroundVerdict, threshold: number, prefix = "") {
	const client = langfuse();
	if (client) for (const score of verdictScores(verdict, threshold, prefix)) client.score.activeTrace(score);
}
export async function traceDecision<T extends { usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number; cost?: number } }>(model: string, task: () => Promise<T>): Promise<T> {
	if (!langfuse()) return task();
	return startActiveObservation("floor-decisions", async (generation) => {
		generation.update({ model });
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
export async function tracePlaythrough<T>(input: unknown, task: () => Promise<T>, resultOf: (result: T) => PlaythroughResult = (r) => r as PlaythroughResult): Promise<T> {
	const client = langfuse();
	if (!client) return task();
	try {
		return await startActiveObservation("anima-playthrough", async (span) => {
			span.update({ input, metadata: { kind: "scripted-browser-playthrough" } });
			const record = (result: PlaythroughResult) => {
				const failures = result.failures ?? [];
				client.score.activeTrace({ name: "ended", value: Number(result.final?.ended === true), dataType: "BOOLEAN", comment: "Scripted completion state; no AI evaluator." });
				client.score.activeTrace({ name: "failure_count", value: failures.length, dataType: "NUMERIC", comment: JSON.stringify(failures) });
				const steps = result.trace ?? [];
				for (const [i, step] of steps.entries()) {
					const child = startObservation(`${step.scene ?? "scene"}: ${step.action}`, { output: step }, { startTime: new Date(step.time) });
					child.end(new Date(steps[i + 1]?.time ?? step.time));
				}
				for (const failure of failures) startObservation("playthrough-failure", { output: failure, level: "ERROR" }, { asType: "event" }).end();
				span.update({ output: result });
			};
			try {
				const value = await task();
				record(resultOf(value));
				return value;
			} catch (error) {
				record((error as { playthrough?: PlaythroughResult })?.playthrough ?? { failures: [String(error)], final: { ended: false } });
				throw error;
			}
		});
	} finally {
		await flushLangfuse().catch(() => {});
	}
}
