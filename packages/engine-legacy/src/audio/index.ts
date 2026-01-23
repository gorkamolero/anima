export { SceneSoundManager } from "./SceneSoundManager";
export { HoverSoundHandler } from "./HoverSoundHandler";
export { SpatialAudioCalculator } from "./SpatialAudio";
export { loadManifest, preloadSceneAudio, createEmptyManifest } from "./SoundLoader";
export { VolumeController } from "./VolumeController";
export { wrapPhaserSound } from "./SoundWrapper";
export type { VolumeControllableSound } from "./SoundWrapper";
export type {
	ActiveSound,
	AmbientSoundConfig,
	HoverSoundConfig,
	ObjectSoundConfig,
	OneshotSoundConfig,
	SoundCondition,
	SoundManifest,
	SpatialHotspot,
} from "./types";
