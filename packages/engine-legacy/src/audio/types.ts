/**
 * Audio types for SceneSoundManager
 *
 * Defines the manifest structure for scene-based audio:
 * - Ambient sounds (scene-wide, conditional)
 * - Object sounds (spatial, tied to hotspots)
 * - Hover sounds (triggered on hotspot hover)
 * - Oneshot sounds (event-triggered)
 */

import type { VolumeControllableSound } from "./SoundWrapper";

/**
 * Condition for conditional sound playback
 */
export interface SoundCondition {
	flag: string;
	value: boolean;
}

/**
 * Ambient sound configuration - plays scene-wide without spatial positioning
 */
export interface AmbientSoundConfig {
	id: string;
	file: string;
	volume: number;
	loop: boolean;
	condition?: string; // GameState flag name (true = play)
}

/**
 * Object sound configuration - spatial audio tied to hotspot positions
 */
export interface ObjectSoundConfig {
	id: string;
	file: string;
	hotspotId: string;
	refDistance: number;
	maxDistance: number;
	rolloffFactor: number;
	volume: number;
	loop: boolean;
	condition?: string; // GameState flag name (true = play)
}

/**
 * Hover sound configuration - plays when hovering over a hotspot
 */
export interface HoverSoundConfig {
	id: string;
	file: string;
	hotspotId: string;
	volume: number;
	fadeInDuration: number;
	fadeOutDuration: number;
}

/**
 * Oneshot sound configuration - triggered by game events
 */
export interface OneshotSoundConfig {
	id: string;
	file: string;
	triggerId: string;
	volume: number;
}

/**
 * Complete sound manifest for a scene
 */
export interface SoundManifest {
	ambient: AmbientSoundConfig[];
	objects: ObjectSoundConfig[];
	hover: HoverSoundConfig[];
	oneshot: OneshotSoundConfig[];
}

/**
 * Active sound instance being played
 */
export interface ActiveSound {
	key: string;
	sound: Phaser.Sound.BaseSound;
	/** Type-safe wrapper for volume control operations */
	wrappedSound: VolumeControllableSound;
	config: AmbientSoundConfig | ObjectSoundConfig | HoverSoundConfig;
	hotspotId?: string;
	sourceX?: number;
	sourceY?: number;
}

/**
 * Generic hotspot interface for spatial audio
 * Minimal interface - just needs id and bounds with centerX/centerY
 */
export interface SpatialHotspot {
	id: string;
	bounds: {
		centerX: number;
		centerY: number;
	};
}
