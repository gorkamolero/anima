/**
 * Shared types for the dialogue system.
 */

/**
 * Dialogue line with speaker and text
 */
export interface DialogueLine {
	speaker: string;
	text: string;
	color?: string;
}

/**
 * Dialogue choice option
 */
export interface DialogueChoice {
	index: number;
	text: string;
}

/**
 * Callbacks for custom dialogue handling
 */
export interface DialogueCallbacks {
	/** Called when dialogue line should be displayed */
	onLine?: (line: DialogueLine) => Promise<void>;
	/** Called when choices are available */
	onChoices?: (choices: DialogueChoice[]) => Promise<number>;
	/** Called when dialogue ends */
	onEnd?: () => void;
	/** Called when speaker starts talking */
	onTalkingStart?: (speaker: string) => void;
	/** Called when speaker stops talking */
	onTalkingEnd?: (speaker: string) => void;
}

/**
 * Per-speaker talking callbacks
 */
export interface SpeakerTalkingCallback {
	onStart: () => void;
	onEnd: () => void;
}

/**
 * Tag callback for processing Ink tags
 */
export type TagCallback = (tag: string) => void | Promise<void>;
