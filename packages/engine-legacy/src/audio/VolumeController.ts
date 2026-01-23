/**
 * VolumeController - Manages master volume and volume updates for active sounds
 *
 * Handles:
 * - Master volume state and clamping
 * - Applying volume changes to all active sounds
 * - Volume calculation with base config volumes
 */

import type { ActiveSound } from "./types";

export class VolumeController {
	/**
	 * Default master volume level (0-1 range).
	 * 1.0 = full volume, allowing per-sound configs to control actual levels.
	 */
	private static readonly DEFAULT_MASTER_VOLUME = 1;

	private masterVolume: number = VolumeController.DEFAULT_MASTER_VOLUME;

	/**
	 * Get current master volume
	 */
	getMasterVolume(): number {
		return this.masterVolume;
	}

	/**
	 * Set master volume (clamped to 0-1 range)
	 */
	setMasterVolume(volume: number): void {
		this.masterVolume = Math.max(0, Math.min(1, volume));
	}

	/**
	 * Calculate effective volume for a sound
	 */
	calculateEffectiveVolume(baseVolume: number): number {
		return baseVolume * this.masterVolume;
	}

	/**
	 * Update volumes for all active sounds based on their config volumes
	 */
	updateActiveSoundVolumes(activeSounds: Map<string, ActiveSound>): void {
		for (const [, active] of activeSounds) {
			const baseVolume = "volume" in active.config ? active.config.volume : VolumeController.DEFAULT_MASTER_VOLUME;
			active.wrappedSound.setVolume(baseVolume * this.masterVolume);
		}
	}
}
