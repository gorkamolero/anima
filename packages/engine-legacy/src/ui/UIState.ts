/**
 * UIState - Observable UI state management singleton
 *
 * Framework-agnostic state management for adventure game UI.
 * Uses the observer pattern to notify subscribers of state changes.
 */

import type { InventoryCallbacks, InventoryItem } from "../inventory/types";

export type { InventoryItem };

/** Dialogue configuration for showDialogue() */
export interface DialogueConfig {
	speaker: string;
	text: string;
	choices?: Array<{ text: string; index: number }>;
	speakerColor?: string;
	showContinue?: boolean;
}

/** Dialogue content returned by getDialogueContent() */
export interface DialogueContent {
	speaker: string;
	text: string;
	choices?: Array<{ text: string; index: number }>;
	speakerColor?: string;
	showContinue?: boolean;
}

/** Hotspot hover information */
export interface HoveredHotspot {
	name: string;
	position?: { x: number; y: number };
}

/** Full state snapshot passed to subscribers */
export interface UIStateSnapshot {
	sceneName: string;
	hoveredHotspot: HoveredHotspot | null;
	dialogueVisible: boolean;
	dialogueContent: DialogueContent | null;
	inventory: InventoryItem[];
	selectedVerb: string | null;
	selectedItem: InventoryItem | null;
	sceneLoading: boolean;
}

type Subscriber = (state: UIStateSnapshot) => void;

export class UIState {
	private static instance: UIState | null = null;

	private subscribers: Set<Subscriber> = new Set();

	// State properties
	private sceneName: string = "";
	private hoveredHotspot: HoveredHotspot | null = null;
	private dialogueVisible: boolean = false;
	private dialogueContent: DialogueContent | null = null;
	private inventory: InventoryItem[] = [];
	private selectedVerb: string | null = null;
	private selectedItem: InventoryItem | null = null;
	private sceneLoading: boolean = false;
	private inventoryCallbacks: InventoryCallbacks = {};

	private constructor() {}

	/**
	 * Set inventory callbacks for InventoryManager to use.
	 * Called by UI components to register handlers.
	 */
	public setInventoryCallbacks(callbacks: InventoryCallbacks): void {
		this.inventoryCallbacks = callbacks;
	}

	/**
	 * Get inventory callbacks. Used by InventoryManager.
	 */
	public getInventoryCallbacks(): InventoryCallbacks {
		return this.inventoryCallbacks;
	}

	public static getInstance(): UIState {
		if (!UIState.instance) {
			UIState.instance = new UIState();
		}
		return UIState.instance;
	}

	public static resetInstance(): void {
		UIState.instance = null;
	}

	// Scene name methods
	public setSceneName(name: string): void {
		this.sceneName = name;
		this.notify();
	}

	public getSceneName(): string {
		return this.sceneName;
	}

	// Hovered hotspot methods
	public setHoveredHotspot(
		name: string | null,
		position?: { x: number; y: number },
	): void {
		if (name === null) {
			this.hoveredHotspot = null;
		} else {
			this.hoveredHotspot = { name, position };
		}
		this.notify();
	}

	public getHoveredHotspot(): HoveredHotspot | null {
		if (this.hoveredHotspot === null) return null;
		return { ...this.hoveredHotspot };
	}

	// Dialogue methods
	public showDialogue(config: DialogueConfig): void {
		this.dialogueVisible = true;
		this.dialogueContent = {
			speaker: config.speaker,
			text: config.text,
			choices: config.choices,
			speakerColor: config.speakerColor,
			showContinue: config.showContinue,
		};
		this.notify();
	}

	public hideDialogue(): void {
		this.dialogueVisible = false;
		this.notify();
	}

	public isDialogueVisible(): boolean {
		return this.dialogueVisible;
	}

	public getDialogueContent(): DialogueContent | null {
		if (this.dialogueContent === null) return null;
		return { ...this.dialogueContent };
	}

	// Inventory methods
	public addInventoryItem(item: InventoryItem): void {
		this.inventory.push(item);
		this.notify();
	}

	public removeInventoryItem(id: string): void {
		this.inventory = this.inventory.filter((item) => item.id !== id);
		this.notify();
	}

	public getInventory(): InventoryItem[] {
		// Return a copy to prevent external mutation
		return [...this.inventory];
	}

	// Verb selection methods
	public setSelectedVerb(verb: string | null): void {
		this.selectedVerb = verb;
		this.notify();
	}

	public getSelectedVerb(): string | null {
		return this.selectedVerb;
	}

	// Item selection methods
	public setSelectedItem(item: InventoryItem | null): void {
		this.selectedItem = item;
		this.notify();
	}

	public getSelectedItem(): InventoryItem | null {
		if (this.selectedItem === null) return null;
		return { ...this.selectedItem };
	}

	// Clear both verb and item selection
	public clearVerbSelection(): void {
		this.selectedVerb = null;
		this.selectedItem = null;
		this.notify();
	}

	// Scene loading methods
	public showSceneLoading(loading: boolean): void {
		this.sceneLoading = loading;
		this.notify();
	}

	public isSceneLoading(): boolean {
		return this.sceneLoading;
	}

	// Subscription methods
	public subscribe(callback: Subscriber): () => void {
		this.subscribers.add(callback);
		return () => {
			this.subscribers.delete(callback);
		};
	}

	private notify(): void {
		const snapshot: UIStateSnapshot = {
			sceneName: this.sceneName,
			hoveredHotspot: this.hoveredHotspot,
			dialogueVisible: this.dialogueVisible,
			dialogueContent: this.dialogueContent,
			inventory: [...this.inventory],
			selectedVerb: this.selectedVerb,
			selectedItem: this.selectedItem,
			sceneLoading: this.sceneLoading,
		};

		for (const subscriber of this.subscribers) {
			try {
				subscriber(snapshot);
			} catch (error) {
				console.error("UIState subscriber error:", error);
			}
		}
	}
}
