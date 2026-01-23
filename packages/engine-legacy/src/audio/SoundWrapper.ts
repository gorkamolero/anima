/**
 * SoundWrapper - Type-safe wrapper interface for Phaser sounds with volume control.
 *
 * Abstracts over WebAudioSound/HTML5AudioSound differences, providing a consistent
 * interface for sound operations without requiring unsafe type casts.
 */

/**
 * Type-safe interface for sounds with volume control.
 * Provides the common operations needed for game audio management.
 */
export interface VolumeControllableSound {
	play(): void;
	stop(): void;
	pause(): void;
	resume(): void;
	destroy(): void;
	setVolume(volume: number): void;
	readonly isPlaying: boolean;
}

/**
 * Wrap a Phaser BaseSound in a type-safe interface.
 * Handles the WebAudioSound vs HTML5AudioSound differences internally.
 *
 * @param sound - The Phaser BaseSound to wrap
 * @returns A VolumeControllableSound interface for safe sound operations
 */
export function wrapPhaserSound(
	sound: Phaser.Sound.BaseSound,
): VolumeControllableSound {
	// Cast once at the boundary - WebAudioSound has setVolume, HTML5AudioSound also has it
	const webAudioSound = sound as Phaser.Sound.WebAudioSound;

	return {
		play: () => sound.play(),
		stop: () => sound.stop(),
		pause: () => sound.pause(),
		resume: () => sound.resume(),
		destroy: () => sound.destroy(),
		setVolume: (v: number) => webAudioSound.setVolume?.(v),
		get isPlaying() {
			return sound.isPlaying;
		},
	};
}
