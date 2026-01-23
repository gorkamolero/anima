import { Story } from "inkjs";
import type { DialogueParser } from "./DialogueParser";

/**
 * Manages Ink story registration, state, and variable access.
 */
export class StoryManager {
	private stories: Map<string, Story> = new Map();
	private interruptedDialogues: Set<string> = new Set();

	/**
	 * Register an Ink story (compiled JSON)
	 */
	public registerStory(
		characterId: string,
		storyJson: string,
		parser?: DialogueParser,
	): void {
		try {
			const story = new Story(storyJson);
			this.stories.set(characterId, story);
			if (parser) {
				parser.extractColorsFromStory(story);
			}
		} catch (error) {
			console.error(`Failed to register story for ${characterId}:`, error);
		}
	}

	/**
	 * Get a registered story by ID
	 */
	public getStory(characterId: string): Story | undefined {
		return this.stories.get(characterId);
	}

	/**
	 * Check if a story is registered
	 */
	public hasStory(characterId: string): boolean {
		return this.stories.has(characterId);
	}

	/**
	 * Get a variable value from a registered story
	 */
	public getStoryVariable(characterId: string, variableName: string): unknown {
		const story = this.stories.get(characterId);
		if (!story) return undefined;
		try {
			return story.variablesState.$(variableName);
		} catch {
			return undefined;
		}
	}

	/**
	 * Set a variable value in a registered story
	 * @throws Error if story not found for characterId
	 */
	public setStoryVariable(
		characterId: string,
		variableName: string,
		value: string | number | boolean,
	): void {
		const story = this.stories.get(characterId);
		if (!story) {
			throw new Error(`No story found for character: ${characterId}`);
		}
		try {
			story.variablesState.$(variableName, value);
		} catch (error) {
			console.warn(
				`Failed to set story variable "${variableName}" for ${characterId}:`,
				error,
			);
		}
	}

	/**
	 * Mark a dialogue as interrupted
	 */
	public markInterrupted(characterId: string): void {
		this.interruptedDialogues.add(characterId);
	}

	/**
	 * Clear interrupted state for a dialogue
	 */
	public clearInterrupted(characterId: string): void {
		this.interruptedDialogues.delete(characterId);
	}

	/**
	 * Check if dialogue was interrupted
	 */
	public hasInterruptedDialogue(characterId: string): boolean {
		return this.interruptedDialogues.has(characterId);
	}

	/**
	 * Get available knots for debugging
	 */
	public getAvailableKnots(characterId: string): string[] {
		const story = this.stories.get(characterId);
		if (!story) return [];

		const knots: string[] = [];
		const content = story.mainContentContainer;

		if (content?.namedContent) {
			for (const [name] of content.namedContent) {
				if (!name.startsWith("global") && name !== "global decl") {
					knots.push(name);
				}
			}
		}

		return knots;
	}
}
