export interface DialogueState {
	id: number;
	speaker: string;
	text: string;
	choices: Array<{ index: number; text: string }>;
	busy: boolean;
	pendingArt?: string;
}
export const speakerColours: Record<string, string> = {
	Narrator: "#e6d9b8",
	hermes: "#9fd9ec",
	kat: "#d8b3ed",
	clerk: "#efc481",
	driver: "#a8c6aa",
};
export function emitDialogue(state: DialogueState | null): void {
	window.dispatchEvent(
		new CustomEvent("anima:dialogue-state", { detail: state }),
	);
}
