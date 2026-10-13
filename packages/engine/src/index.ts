// Anima Engine - Point-and-Click Adventure Framework
// ===================================================

export type {
	ContactFrame,
	Foot,
	FootCycle,
	FootPose,
} from "@anima/footfall/core/characters/footLock";
export type { WalkDirection } from "@anima/footfall/core/characters/walkHeading";
export { headingFromGround } from "@anima/footfall/core/characters/walkHeading";
export {
	beginArrival,
	passageArrival,
	resolveReturnExit,
} from "@anima/footfall/core/occlusion/arrivals";
export {
	bridgeFloor,
	bridgeOccluders,
	floorPixel,
} from "@anima/footfall/core/occlusion/bridge";
export type { Exit } from "@anima/footfall/core/occlusion/exits";
export {
	exitAt,
	exitAtArrival,
	exitForFrame,
} from "@anima/footfall/core/occlusion/exits";
export {
	objectFootprints,
	subtractFootprints,
} from "@anima/footfall/core/occlusion/footprints";
export type { Occluder } from "@anima/footfall/core/occlusion/occlusion";
export {
	baselineYAt,
	depthForOccluder,
	isBehind,
} from "@anima/footfall/core/occlusion/occlusion";
export { walkAreaFromAnchor } from "@anima/footfall/core/walkarea/anchor";
export {
	cellPoint,
	erode,
	findPath,
	lineOfSight,
	nearestCell,
	nearestReachable,
	refineMask,
} from "@anima/footfall/core/walkarea/navigation";
export {
	objectApproach,
	objectFacingPoint,
} from "@anima/footfall/core/walkarea/objectApproach";
export { objectAtPoint } from "@anima/footfall/core/walkarea/objectHit";
export type { Perspective } from "@anima/footfall/core/walkarea/perspective";
export {
	fitFromLine,
	fitLinear,
	fromGround,
	fromMetres,
	scaleAt,
	toGround,
	toMetres,
} from "@anima/footfall/core/walkarea/perspective";
export {
	applySceneFootprints,
	sceneExitApproaches,
} from "@anima/footfall/core/walkarea/sceneGeometry";
export type { FloorMask, WalkArea } from "@anima/footfall/core/walkarea/types";
export type { FootAnimation } from "@anima/footfall/phaser/CharacterMotor";
export { CharacterMotor } from "@anima/footfall/phaser/CharacterMotor";
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
export type {
	CharacterAnimationState,
	CharacterAnimConfig,
} from "./characters/Character";
// Characters
export { Character } from "./characters/Character";
// Agent debug / playtest API
export type { AgentDebugApi, AgentSceneSnapshot } from "./debug/AgentDebug";
export { installAgentDebug } from "./debug/AgentDebug";
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
// Art landmarks (backgrounds describe their own geometry)
export type {
	ArtReport,
	ArtViolation,
	Landmark,
	LandmarksFile,
	PerspectiveModel,
} from "./verification/ArtLandmarks";
export {
	buildPerspectiveModel,
	checkArtConsistency,
	checkCharacterScales,
	checkGroundLineScales,
	checkHotspotBounds,
	verifySceneArt,
} from "./verification/ArtLandmarks";
