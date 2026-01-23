import type { Story } from "inkjs";
import type { SpeechText } from "./SpeechText";
import { DialogueParser } from "./DialogueParser";
import { DialogueCallbackHandler } from "./DialogueCallbackHandler";
import { StoryManager } from "./StoryManager";
import type {
	DialogueCallbacks,
	DialogueLine,
	DialogueChoice,
	TagCallback,
} from "./types";

// Re-export types for backward compatibility
export type {
	DialogueCallbacks,
	DialogueLine,
	DialogueChoice,
	TagCallback,
} from "./types";
export type { SpeakerTalkingCallback } from "./types";

/**
 * Simplified Ink dialogue manager for point-and-click adventures.
 * Games provide callbacks for display, TTS, and choices.
 */
export class InkDialogueManager {
	private currentStory?: Story;
	private currentCharacterId?: string;
	private characterSprites: Map<string, Phaser.GameObjects.Sprite> = new Map();
	private _isDialogueActive = false;
	private parser: DialogueParser;
	private callbackHandler: DialogueCallbackHandler;
	private storyManager: StoryManager;
	private speechText?: SpeechText;
	private dialogueClickResolver?: () => void;

	constructor(callbacks?: DialogueCallbacks) {
		this.parser = new DialogueParser();
		this.callbackHandler = new DialogueCallbackHandler(callbacks);
		this.storyManager = new StoryManager();
	}

	public setCallbacks(callbacks: DialogueCallbacks): void {
		this.callbackHandler.setCallbacks(callbacks);
	}

	public setSpeechText(speechText: SpeechText): void {
		this.speechText = speechText;
	}

	public onTag(tag: string, callback: TagCallback): void {
		this.parser.onTag(tag, callback);
	}

	public clearTagCallbacks(): void {
		this.parser.clearTagCallbacks();
	}

	public registerSpeakerTalking(
		speaker: string,
		onStart: () => void,
		onEnd: () => void,
	): void {
		this.callbackHandler.registerSpeakerTalking(speaker, onStart, onEnd);
	}

	public unregisterSpeakerTalking(speaker: string): void {
		this.callbackHandler.unregisterSpeakerTalking(speaker);
	}

	public isDialogueActive(): boolean {
		return this._isDialogueActive;
	}

	public isWaitingForClick(): boolean {
		return this.dialogueClickResolver !== undefined;
	}

	public hasInterruptedDialogue(characterId: string): boolean {
		return this.storyManager.hasInterruptedDialogue(characterId);
	}

	public registerCharacterSprite(
		speakerName: string,
		sprite: Phaser.GameObjects.Sprite,
	): void {
		this.characterSprites.set(speakerName.toUpperCase(), sprite);
	}

	public getCharacterSprite(
		speakerName: string,
	): Phaser.GameObjects.Sprite | undefined {
		return this.characterSprites.get(speakerName.toUpperCase());
	}

	public getSpeakerColor(speaker: string): string | undefined {
		return this.parser.getSpeakerColor(speaker);
	}

	public registerStory(characterId: string, storyJson: string): void {
		this.storyManager.registerStory(characterId, storyJson, this.parser);
	}

	public getStoryVariable(characterId: string, variableName: string): unknown {
		return this.storyManager.getStoryVariable(characterId, variableName);
	}

	public setStoryVariable(
		characterId: string,
		variableName: string,
		value: string | number | boolean,
	): void {
		this.storyManager.setStoryVariable(characterId, variableName, value);
	}

	public getAvailableKnots(characterId: string): string[] {
		return this.storyManager.getAvailableKnots(characterId);
	}

	/**
	 * Start dialogue with a character
	 * @param characterId The character ID to start dialogue with
	 * @param startKnot Optional starting knot in the story
	 * @returns true if dialogue started successfully, false if story not found or failed to start
	 */
	public async startDialogue(
		characterId: string,
		startKnot?: string,
	): Promise<boolean> {
		const story = this.storyManager.getStory(characterId);
		if (!story) {
			console.error(`No story found for: ${characterId}`);
			return false;
		}

		this._isDialogueActive = true;
		this.currentStory = story;
		this.currentCharacterId = characterId;

		try {
			if (this.storyManager.hasInterruptedDialogue(characterId)) {
				this.storyManager.clearInterrupted(characterId);
				await this.continueStory();
				return true;
			}

			if (startKnot) {
				try {
					story.ChoosePathString(startKnot);
				} catch (error) {
					console.error(`Failed to start at knot ${startKnot}:`, error);
					return false;
				}
			}

			await this.continueStory();
			return true;
		} finally {
			this._isDialogueActive = false;
			this.callbackHandler.callOnEnd();
		}
	}

	public interruptDialogue(): void {
		if (this.currentCharacterId && this.currentStory) {
			if (
				this.currentStory.canContinue ||
				this.currentStory.currentChoices.length > 0
			) {
				this.storyManager.markInterrupted(this.currentCharacterId);
			}
		}
		this._isDialogueActive = false;
		this.speechText?.hide();
		this.dialogueClickResolver = undefined;
	}

	public handleDialogueClick(): void {
		if (this.dialogueClickResolver) {
			this.dialogueClickResolver();
		}
	}

	public async jumpToKnot(
		characterId: string,
		knotName: string,
	): Promise<void> {
		const story = this.storyManager.getStory(characterId);
		if (!story) return;

		this.currentStory = story;
		this.currentCharacterId = characterId;
		this._isDialogueActive = true;

		try {
			story.ChoosePathString(knotName);
			await this.continueStory();
		} catch (error) {
			console.error(`Failed to jump to knot ${knotName}:`, error);
		} finally {
			this._isDialogueActive = false;
		}
	}

	public getCurrentChoices(): DialogueChoice[] {
		if (!this.currentStory) return [];
		return this.currentStory.currentChoices.map((c, i) => ({
			index: i,
			text: c.text,
		}));
	}

	public async selectChoice(index: number): Promise<void> {
		if (!this.currentStory) return;
		if (index < 0 || index >= this.currentStory.currentChoices.length) return;

		this.currentStory.ChooseChoiceIndex(index);
		await this.continueStory();
	}

	private async continueStory(): Promise<void> {
		if (!this.currentStory) return;
		const story = this.currentStory;

		while (story.canContinue) {
			const line = story.Continue()?.trim();
			if (story.currentTags) {
				await this.parser.processTags(story.currentTags);
			}
			if (line) {
				const dialogueLine = this.parser.parseLine(line);
				await this.showDialogue(dialogueLine);
			}
		}

		if (story.currentChoices.length > 0) {
			await this.handleChoices();
		} else {
			this.speechText?.hide();
		}
	}

	private async showDialogue(line: DialogueLine): Promise<void> {
		line.color = line.color || this.parser.getSpeakerColor(line.speaker);

		const handled = await this.callbackHandler.callOnLine(line);
		if (handled) return;

		if (this.speechText) {
			return new Promise<void>((resolve) => {
				const sprite = this.characterSprites.get(line.speaker.toUpperCase());
				this.speechText?.show(line.speaker, line.text, sprite, line.color);
				this.callbackHandler.triggerTalkingStart(line.speaker);

				this.dialogueClickResolver = () => {
					this.speechText?.hide();
					this.callbackHandler.triggerTalkingEnd(line.speaker);
					this.dialogueClickResolver = undefined;
					resolve();
				};
			});
		}

		console.log(`[${line.speaker}]: ${line.text}`);
	}

	private async handleChoices(): Promise<void> {
		if (!this.currentStory) return;

		const choices: DialogueChoice[] = this.currentStory.currentChoices.map(
			(c, i) => ({ index: i, text: c.text }),
		);

		const selectedIndex = await this.callbackHandler.callOnChoices(choices);
		if (selectedIndex !== undefined) {
			this.currentStory.ChooseChoiceIndex(selectedIndex);
			await this.continueStory();
			return;
		}

		console.log("Choices:", choices.map((c) => c.text).join(", "));
		if (choices.length > 0) {
			this.currentStory.ChooseChoiceIndex(0);
			await this.continueStory();
		}
	}
}
