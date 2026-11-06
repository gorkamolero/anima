import { MockLanguageModelV2 } from "ai/test";
import type {
	PlayerView,
	SceneRecord,
} from "../../../packages/storyscript/src/playtester.js";

/** Real AI SDK structured-output path, deterministic transport, zero network. */
export function createStoryMock() {
	return new MockLanguageModelV2({
		doGenerate: async ({ prompt }) => {
			const content = prompt
				.filter((m) => m.role === "user")
				.flatMap((m) => m.content)
				.filter((c) => c.type === "text")
				.map((c) => c.text)
				.join("");
			const input = JSON.parse(content) as {
				snapshot?: PlayerView;
				transcript?: SceneRecord[];
			};
			let value: unknown;
			if (input.snapshot) {
				const view = input.snapshot;
				const tried = (input.transcript ?? [])
					.flatMap((s) => s.steps)
					.filter((s) => s.before.sceneId === view.sceneId);
				const options = view.hotspots.flatMap((h) =>
					h.verbs.map((verb) => ({
						kind: "perform",
						hotspotId: h.id,
						verb,
						reason: "Offline fixture explores available actions.",
					})),
				);
				value = view.choices.length
					? {
							kind: "choose",
							index: view.choices[0].index,
							reason: "Offline fixture selects the first choice.",
						}
					: (options.find(
							(o) =>
								!tried.some(
									(s) =>
										s.decision.hotspotId === o.hotspotId &&
										s.decision.verb === o.verb,
								),
						) ?? options[tried.length % options.length]);
			} else
				value = {
					pacing: 7,
					engagement: 7,
					clarity: 8,
					overall: 7,
					reasons: "Offline fixture verdict; not a real quality assessment.",
					suggestions: ["Run the live judge to assess this transcript."],
					emotionalArc: "Mock evaluation.",
				};
			return {
				content: [{ type: "text", text: JSON.stringify(value) }],
				finishReason: "stop",
				usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0 },
				warnings: [],
				providerMetadata: { openrouter: { usage: { cost: 0 } } },
			};
		},
	});
}
