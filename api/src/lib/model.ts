import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { LanguageModel } from "ai";

export function getModel(): LanguageModel {
	const openrouter = createOpenRouter({
		apiKey: process.env.OPENROUTER_API_KEY,
	});
	return openrouter("google/gemini-2.5-flash");
}
