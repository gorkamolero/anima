/**
 * HoverSoundHandler - Manages hover-triggered sounds for hotspots
 *
 * Handles:
 * - Playing sounds when hovering over hotspots
 * - Fade in/out transitions between hover sounds
 * - Cleanup when hover ends
 */

import type { Scene } from "phaser";
import type { ActiveSound, HoverSoundConfig, SoundManifest } from "./types";
import { wrapPhaserSound } from "./SoundWrapper";

export class HoverSoundHandler {
	private scene: Scene;
	private activeHoverSound: ActiveSound | null = null;

	constructor(scene: Scene) {
		this.scene = scene;
	}

	/**
	 * Get the currently active hover sound
	 */
	getActiveHoverSound(): ActiveSound | null {
		return this.activeHoverSound;
	}

	/**
	 * Handle hotspot hover state changes
	 */
	setHoveredHotspot(
		hotspotId: string | null,
		manifest: SoundManifest,
		masterVolume: number,
	): void {
		if (!this.scene?.sound?.add) return;

		// Find hover sound config for this hotspot
		const hoverConfig = hotspotId
			? manifest.hover.find((h) => h.hotspotId === hotspotId)
			: null;

		// If there's a current hover sound and we're changing to a different/no hotspot
		if (this.activeHoverSound) {
			const currentConfig = this.activeHoverSound.config as HoverSoundConfig;

			// If same hotspot, do nothing
			if (hoverConfig && currentConfig.hotspotId === hoverConfig.hotspotId) {
				return;
			}

			// Store reference to old sound before starting fade (avoids race condition)
			const oldSound = this.activeHoverSound.sound;
			this.activeHoverSound = null;

			// Fade out current hover sound
			if (this.scene?.tweens) {
				this.scene.tweens.add({
					targets: oldSound,
					volume: 0,
					duration: currentConfig.fadeOutDuration,
					onComplete: () => {
						oldSound.stop();
						oldSound.destroy();
					},
				});
			} else {
				oldSound.stop();
				oldSound.destroy();
			}
		}

		// Start new hover sound if applicable
		if (hoverConfig && this.scene.cache.audio.exists(hoverConfig.id)) {
			const sound = this.scene.sound.add(hoverConfig.id, {
				volume: 0, // Start at 0 for fade in
			});
			sound.play();

			this.activeHoverSound = {
				key: hoverConfig.id,
				sound,
				wrappedSound: wrapPhaserSound(sound),
				config: hoverConfig,
				hotspotId: hoverConfig.hotspotId,
			};

			// Fade in
			if (this.scene?.tweens) {
				this.scene.tweens.add({
					targets: sound,
					volume: hoverConfig.volume * masterVolume,
					duration: hoverConfig.fadeInDuration,
				});
			}
		}
	}

	/**
	 * Update the hover sound volume when master volume changes
	 */
	updateVolume(masterVolume: number): void {
		if (this.activeHoverSound) {
			const hoverConfig = this.activeHoverSound.config as HoverSoundConfig;
			this.activeHoverSound.wrappedSound.setVolume(hoverConfig.volume * masterVolume);
		}
	}

	/**
	 * Pause the current hover sound
	 */
	pause(): void {
		if (this.activeHoverSound) {
			this.activeHoverSound.sound.pause();
		}
	}

	/**
	 * Resume the current hover sound
	 */
	resume(): void {
		if (this.activeHoverSound) {
			this.activeHoverSound.sound.resume();
		}
	}

	/**
	 * Fade out and destroy the current hover sound
	 */
	fadeOut(duration: number): void {
		if (!this.activeHoverSound) return;

		const hoverSound = this.activeHoverSound.sound;
		this.activeHoverSound = null;

		if (this.scene?.tweens) {
			this.scene.tweens.add({
				targets: hoverSound,
				volume: 0,
				duration,
				onComplete: () => {
					hoverSound.stop();
					hoverSound.destroy();
				},
			});
		} else {
			hoverSound.stop();
			hoverSound.destroy();
		}
	}

	/**
	 * Stop and destroy the current hover sound immediately
	 */
	destroy(): void {
		if (this.activeHoverSound) {
			this.activeHoverSound.sound.stop();
			this.activeHoverSound.sound.destroy();
			this.activeHoverSound = null;
		}
	}
}
