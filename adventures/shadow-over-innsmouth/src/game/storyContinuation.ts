import type { StoryRuntimeSnapshot, StoryState } from "@anima/storyscript";

export interface ActContinuation {
	next: string;
	state: StoryState;
}
export interface ActCompletion {
	act: string;
	ending?: string;
	continuation?: ActContinuation;
}
export const CONTINUATION_KEY = "anima.story.continuation";
export function continuationFor(
	act: string,
	snapshot: StoryRuntimeSnapshot,
): ActContinuation | undefined {
	if (!snapshot.ended || snapshot.ending !== "ACT_END") return;
	const next = (
		{ "1": "2", "2": "3", "3": "4", "3b": "4" } as Record<string, string>
	)[act];
	return next ? { next, state: snapshot.state } : undefined;
}
export function readContinuation(act: string): StoryState | undefined {
	if (new URLSearchParams(window.location.search).get("continue") !== "1")
		return;
	try {
		const value = JSON.parse(
			sessionStorage.getItem(CONTINUATION_KEY) ?? "null",
		) as ActContinuation | null;
		return value?.next === act ? value.state : undefined;
	} catch {
		return;
	}
}
