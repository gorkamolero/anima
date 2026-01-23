import type { DialogueCallbacks, SpeakerTalkingCallback } from "./types";

/**
 * Manages dialogue callbacks including speaker talking animations.
 */
export class DialogueCallbackHandler {
	private callbacks: DialogueCallbacks = {};
	private speakerTalkingCallbacks: Map<string, SpeakerTalkingCallback> =
		new Map();

	constructor(callbacks?: DialogueCallbacks) {
		if (callbacks) {
			this.callbacks = callbacks;
		}
	}

	/**
	 * Set callbacks for dialogue handling
	 */
	public setCallbacks(callbacks: DialogueCallbacks): void {
		this.callbacks = { ...this.callbacks, ...callbacks };
	}

	/**
	 * Get current callbacks
	 */
	public getCallbacks(): DialogueCallbacks {
		return this.callbacks;
	}

	/**
	 * Register talking callbacks for a specific speaker
	 */
	public registerSpeakerTalking(
		speaker: string,
		onStart: () => void,
		onEnd: () => void,
	): void {
		this.speakerTalkingCallbacks.set(speaker.toUpperCase(), { onStart, onEnd });
	}

	/**
	 * Unregister talking callbacks for a speaker
	 */
	public unregisterSpeakerTalking(speaker: string): void {
		this.speakerTalkingCallbacks.delete(speaker.toUpperCase());
	}

	/**
	 * Get speaker talking callback
	 */
	public getSpeakerTalkingCallback(
		speaker: string,
	): SpeakerTalkingCallback | undefined {
		return this.speakerTalkingCallbacks.get(speaker.toUpperCase());
	}

	/**
	 * Trigger talking start for a speaker.
	 * Uses registered speaker callback if available, otherwise global callback.
	 */
	public triggerTalkingStart(speaker: string): void {
		const speakerCallback = this.speakerTalkingCallbacks.get(
			speaker.toUpperCase(),
		);
		if (speakerCallback) {
			speakerCallback.onStart();
		} else {
			this.callbacks.onTalkingStart?.(speaker);
		}
	}

	/**
	 * Trigger talking end for a speaker.
	 * Uses registered speaker callback if available, otherwise global callback.
	 */
	public triggerTalkingEnd(speaker: string): void {
		const speakerCallback = this.speakerTalkingCallbacks.get(
			speaker.toUpperCase(),
		);
		if (speakerCallback) {
			speakerCallback.onEnd();
		} else {
			this.callbacks.onTalkingEnd?.(speaker);
		}
	}

	/**
	 * Call onLine callback if registered
	 */
	public async callOnLine(
		line: Parameters<NonNullable<DialogueCallbacks["onLine"]>>[0],
	): Promise<boolean> {
		if (this.callbacks.onLine) {
			await this.callbacks.onLine(line);
			return true;
		}
		return false;
	}

	/**
	 * Call onChoices callback if registered
	 */
	public async callOnChoices(
		choices: Parameters<NonNullable<DialogueCallbacks["onChoices"]>>[0],
	): Promise<number | undefined> {
		if (this.callbacks.onChoices) {
			return this.callbacks.onChoices(choices);
		}
		return undefined;
	}

	/**
	 * Call onEnd callback if registered
	 */
	public callOnEnd(): void {
		this.callbacks.onEnd?.();
	}
}
