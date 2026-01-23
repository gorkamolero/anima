/**
 * SpatialAudio - Spatial audio calculations for distance-based volume
 *
 * Handles:
 * - Distance calculations between listener and sound sources
 * - Volume attenuation based on distance and rolloff
 * - Listener position tracking
 */

import type { ObjectSoundConfig, ActiveSound } from "./types";

/**
 * SpatialAudioCalculator handles all spatial audio volume calculations
 */
export class SpatialAudioCalculator {
	private listenerX: number = 0;
	private listenerY: number = 0;

	/**
	 * Get current listener X position
	 */
	getListenerX(): number {
		return this.listenerX;
	}

	/**
	 * Get current listener Y position
	 */
	getListenerY(): number {
		return this.listenerY;
	}

	/**
	 * Update listener position
	 */
	setListenerPosition(x: number, y: number): void {
		this.listenerX = x;
		this.listenerY = y;
	}

	/**
	 * Calculate volume based on distance from listener to source
	 *
	 * Uses a configurable rolloff model:
	 * - Within refDistance: full volume
	 * - Beyond maxDistance: zero volume
	 * - Between: exponential falloff based on rolloffFactor
	 */
	calculateSpatialVolume(
		sourceX: number,
		sourceY: number,
		config: ObjectSoundConfig,
	): number {
		const dx = sourceX - this.listenerX;
		const dy = sourceY - this.listenerY;
		const distance = Math.sqrt(dx * dx + dy * dy);

		if (distance <= config.refDistance) {
			return config.volume;
		}

		if (distance >= config.maxDistance) {
			return 0;
		}

		// Apply rolloff factor to the falloff calculation
		const range = config.maxDistance - config.refDistance;
		const distanceFromRef = distance - config.refDistance;
		const normalizedDistance = distanceFromRef / range;

		// With rolloffFactor, higher values mean steeper falloff
		const falloff = (1 - normalizedDistance) ** config.rolloffFactor;

		return config.volume * falloff;
	}

	/**
	 * Update volumes for all spatial sounds based on current listener position
	 */
	updateSpatialSounds(
		activeSounds: Map<string, ActiveSound>,
		masterVolume: number,
	): void {
		for (const [, active] of activeSounds) {
			if (active.sourceX !== undefined && active.sourceY !== undefined) {
				const config = active.config as ObjectSoundConfig;
				const volume = this.calculateSpatialVolume(
					active.sourceX,
					active.sourceY,
					config,
				);

				active.wrappedSound?.setVolume(volume * masterVolume);
			}
		}
	}
}
