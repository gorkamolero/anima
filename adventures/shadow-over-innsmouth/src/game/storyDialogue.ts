import type {
	StoryRuntime,
	StoryRuntimeSnapshot,
	StoryVerb,
} from "@anima/storyscript";
import { type DialogueState, emitDialogue } from "../dialogue";
import { isAudioMuted, speakCaption } from "./narratorVoice";

/** Presentation owns a queue, never a character position or runtime choice. */
export class StoryDialogue {
	state: DialogueState | null = null;
	snapshot: StoryRuntimeSnapshot;
	private lines: string[] = [];
	private serial = 0;
	private voice?: ReturnType<typeof speakCaption>;
	private pendingArt?: string;
	constructor(
		private runtime: StoryRuntime,
		private api: string,
		private onLock: (locked: boolean) => void,
		private onScene: (
			snapshot: StoryRuntimeSnapshot,
		) => Promise<string | undefined>,
	) {
		this.snapshot = runtime.snapshot();
		window.addEventListener("anima:dialogue-advance", this.advanceEvent);
		window.addEventListener("anima:dialogue-choice", this.choiceEvent);
		window.addEventListener("anima:dialogue-request", this.requestEvent);
	}
	private requestEvent = () => emitDialogue(this.state);
	private advanceEvent = (event: Event) => {
		if (
			(event as CustomEvent<{ id: number }>).detail?.id === this.state?.id &&
			!this.state?.choices.length
		)
			this.next();
	};
	private choiceEvent = (event: Event) => {
		const detail = (event as CustomEvent<{ id: number; index: number }>).detail;
		if (
			detail?.id !== this.state?.id ||
			!this.state?.choices.some((c) => c.index === detail.index)
		)
			return;
		void this.present(this.runtime.choose(detail.index));
	};
	async present(snapshot: StoryRuntimeSnapshot): Promise<void> {
		this.voice?.stop();
		this.onLock(true);
		this.state = null;
		this.snapshot = snapshot;
		this.pendingArt = await this.onScene(snapshot);
		this.lines = snapshot.output.filter((line) => !line.startsWith("## "));
		this.next();
	}
	perform(id: string, verb: StoryVerb): void {
		if (this.state) return;
		void this.present(this.runtime.perform(id, verb));
	}
	private next(): void {
		this.voice?.stop();
		const text = this.lines.shift();
		const id = ++this.serial;
		if (text !== undefined) {
			const match = text.match(/^(\w+)(?:\s+\(([^)]+)\))?:\s*(.*)$/);
			this.state = {
				id,
				speaker: match?.[1] ?? "Narrator",
				text: match ? `${match[2] ? `(${match[2]}) ` : ""}${match[3]}` : text,
				choices: [],
				busy: !isAudioMuted(),
				pendingArt: this.pendingArt,
			};
			emitDialogue(this.state);
			this.voice = speakCaption(match?.[3] ?? text, this.api, isAudioMuted());
			void this.voice.full.then(() => {
				if (this.state?.id === id) this.next();
			});
		} else if (this.snapshot.choices.length) {
			this.state = {
				id,
				speaker: "hermes",
				text: "What do you say?",
				choices: this.snapshot.choices,
				busy: false,
				pendingArt: this.pendingArt,
			};
			emitDialogue(this.state);
		} else {
			this.state = null;
			emitDialogue(null);
			this.onLock(false);
		}
	}
	destroy(): void {
		this.serial++;
		this.state = null;
		this.voice?.stop();
		window.removeEventListener("anima:dialogue-advance", this.advanceEvent);
		window.removeEventListener("anima:dialogue-choice", this.choiceEvent);
		window.removeEventListener("anima:dialogue-request", this.requestEvent);
		emitDialogue(null);
	}
}
