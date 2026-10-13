import { createHash } from "node:crypto";
import type { WorldState } from "../services/world.js";
export function narrationCacheInput(
	request: {
		scene: string;
		sceneDescription: string;
		object: string;
		exit?: string;
		flags: Record<string, string | boolean>;
		choice?: string;
		mode: string;
	},
	world: WorldState | undefined,
	knownPlaces: { id: string; description: string }[] = [],
) {
	const sharedPrompt = [
		`Scene: ${request.scene}`,
		`Scene description: ${request.sceneDescription}`,
		`Clicked object: ${request.object}`,
		...(request.exit
			? [
					`Known places available for travel: ${JSON.stringify(knownPlaces)}. If one is the natural destination, use kind existing and its exact id. Otherwise use kind new; do not pretend the current scene is a new destination.`,
				]
			: []),
		`Current flags: ${JSON.stringify(request.flags)}`,
		`<world-state>${JSON.stringify(world ? { ...world, visual: world.visual[world.location] } : { flags: request.flags })}</world-state>`,
		"Return statePatch.flags, inventory {add,remove}, npcMemory when changed. A visual delta new MUST include a nonempty visualStatePatch describing the resulting visible state, preserving earlier changes. Travel only for declared movement: {to: stable short place slug, kind: anchor or new, template: exterior or interior, description}. Anchors: outside (depot exterior), inside (depot interior).",
	].join("\n");

	const cacheKey = createHash("sha256")
		.update(
			JSON.stringify({
				prompt: sharedPrompt,
				choice: request.choice,
				mode: request.mode,
				version: 3,
			}),
		)
		.digest("hex");
	return { sharedPrompt, cacheKey };
}
