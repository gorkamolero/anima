// Anima Engine - Point-and-Click Adventure Framework
// ===================================================

export type {
	ActiveSound,
	AmbientSoundConfig,
	HoverSoundConfig,
	ObjectSoundConfig,
	OneshotSoundConfig,
	SoundCondition,
	SoundManifest,
	SpatialHotspot,
} from "./audio";
// Audio
export * as audio from "./audio";
export { SceneSoundManager } from "./audio";

export * as characters from "./characters";
export type { CharacterAnimConfig } from "./characters/Character";

// Characters
export { Character } from "./characters/Character";
export type {
	DialogueCallbacks,
	DialogueChoice,
	DialogueLine,
	SpeakerTalkingCallback,
	TagCallback,
} from "./dialogue";
export * as dialogue from "./dialogue";
// Dialogue
export { InkDialogueManager, SpeechText } from "./dialogue";
export type {
	EditorCallbacks,
	RegisteredEntity,
	SelectedInfo,
} from "./editor";
export * as editor from "./editor";

// Editor
export {
	EditorPanel,
	getSceneEditor,
	HotspotEditor,
	registerHotspotWithEditor,
	registerWithEditor,
} from "./editor";
export type {
	GroundLineCallbacks,
	GroundLineConfig,
	GroundLinePoint,
	PositionUpdateCallback,
} from "./groundline";
// Ground Line
export * as groundline from "./groundline";
export {
	GroundLine,
	GroundLineManager,
	GroundLineRenderer,
	getSceneGroundLine,
	registerWithGroundLine,
} from "./groundline";

export type {
	HotspotConfig,
	HotspotIcon,
	HotspotVerb,
} from "./hotspots";
export * as hotspots from "./hotspots";
// Hotspots
export { Hotspot, RadialMenu } from "./hotspots";
export type {
	InventoryCallbacks,
	InventoryItem,
	ItemDefinition,
} from "./inventory";
// Inventory
export * as inventory from "./inventory";
export { InventoryManager } from "./inventory";
// Re-export submodules
export * as scenes from "./scenes";
export type {
	ParallaxLayerConfig,
	PlayerConfig,
	SceneConfig,
	TransitionOptions,
} from "./scenes/BaseScene";
// Scenes
export { BaseScene } from "./scenes/BaseScene";
export { ScenePreloadManager } from "./scenes/ScenePreloadManager";
// State
export * as state from "./state";
export { GameState } from "./state";
export type { DrawClosedOptions, IrisTransitionOptions } from "./transitions";
// Transitions
export * as transitions from "./transitions";
export { IrisTransition } from "./transitions";
export type {
	DialogueConfig,
	DialogueContent,
	HoveredHotspot,
	UIStateSnapshot,
} from "./ui";
// UI
export * as ui from "./ui";
export { UIState } from "./ui";
