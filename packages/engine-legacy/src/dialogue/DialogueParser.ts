import type { Story } from "inkjs";
import type { DialogueLine, TagCallback } from "./types";

/**
 * Parses and processes Ink dialogue lines and tags.
 */
export class DialogueParser {
	/**
	 * Maximum length for a speaker name when parsing "SPEAKER: text" format.
	 * This limit prevents false positives like "URL: https://..." or
	 * "Long sentence with colon: more text" from being parsed as dialogue.
	 * 20 chars accommodates typical character names (e.g., "MYSTERIOUS_STRANGER").
	 */
	private static readonly MAX_SPEAKER_NAME_LENGTH = 20;

	private characterColors: Map<string, string> = new Map();
	private tagCallbacks: Map<string, TagCallback> = new Map();
	private currentStory?: Story;

	/**
	 * Parse dialogue line into speaker and text.
	 * Format: "SPEAKER: text" or just "text"
	 * Speaker names must be <= MAX_SPEAKER_NAME_LENGTH chars to avoid
	 * false positives like "URL: https://..." being parsed as dialogue.
	 */
	public parseLine(line: string): DialogueLine {
		const colonIndex = line.indexOf(":");
		if (colonIndex > 0 && colonIndex < DialogueParser.MAX_SPEAKER_NAME_LENGTH) {
			return {
				speaker: line.substring(0, colonIndex).trim(),
				text: line.substring(colonIndex + 1).trim(),
			};
		}
		return { speaker: "", text: line };
	}

	/**
	 * Process Ink tags, calling registered callbacks
	 */
	public async processTags(tags: string[]): Promise<void> {
		for (const tag of tags) {
			if (tag.startsWith("tts:")) continue; // Skip TTS hints

			const tagName = tag.split(":")[0].trim();
			const callback = this.tagCallbacks.get(tagName);
			if (callback) {
				await callback(tag);
			}
		}
	}

	/**
	 * Register a callback for a specific Ink tag
	 */
	public onTag(tag: string, callback: TagCallback): void {
		this.tagCallbacks.set(tag, callback);
	}

	/**
	 * Clear all tag callbacks
	 */
	public clearTagCallbacks(): void {
		this.tagCallbacks.clear();
	}

	/**
	 * Extract speaker colors from Ink variables.
	 * Stores reference to story for lazy color lookup via public API.
	 * Optionally accepts known speaker names to pre-cache their colors.
	 */
	public extractColorsFromStory(story: Story, speakerNames?: string[]): void {
		this.currentStory = story;

		// Pre-cache colors for known speakers if provided
		if (speakerNames) {
			for (const speaker of speakerNames) {
				const colorVar = `${speaker.toLowerCase()}_color`;
				try {
					const color = story.variablesState.$(colorVar);
					if (typeof color === "string") {
						this.characterColors.set(speaker.toUpperCase(), color);
					}
				} catch {
					// Variable doesn't exist, skip
				}
			}
		}
	}

	/**
	 * Get speaker color from Ink variables.
	 * Uses lazy lookup via public API if not already cached.
	 */
	public getSpeakerColor(speaker: string): string | undefined {
		const upperSpeaker = speaker.toUpperCase();

		// Return cached value if available
		const cached = this.characterColors.get(upperSpeaker);
		if (cached !== undefined) {
			return cached;
		}

		// Lazy lookup using public inkjs API
		if (this.currentStory) {
			const colorVar = `${speaker.toLowerCase()}_color`;
			try {
				const color = this.currentStory.variablesState.$(colorVar);
				if (typeof color === "string") {
					this.characterColors.set(upperSpeaker, color);
					return color;
				}
			} catch {
				// Variable doesn't exist
			}
		}

		return undefined;
	}

	/**
	 * Set a speaker color manually
	 */
	public setSpeakerColor(speaker: string, color: string): void {
		this.characterColors.set(speaker.toUpperCase(), color);
	}
}
