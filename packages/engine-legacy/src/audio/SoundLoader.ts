/**
 * SoundLoader - Manifest loading and audio preloading for scenes
 *
 * Handles:
 * - Fetching scene sound manifests from JSON files
 * - Preloading all audio files for a scene
 * - Providing default empty manifests on failure
 */

import type { Scene } from "phaser";
import type { SoundManifest } from "./types";

/**
 * Create an empty manifest with all required arrays
 */
export function createEmptyManifest(): SoundManifest {
	return {
		ambient: [],
		objects: [],
		hover: [],
		oneshot: [],
	};
}

/**
 * Fetch and parse a scene's sound manifest
 *
 * @param sceneId - The scene identifier used to locate the manifest
 * @returns The parsed manifest or an empty manifest if loading fails
 */
export async function loadManifest(sceneId: string): Promise<SoundManifest> {
	try {
		const response = await fetch(
			`/audio/scenes/${sceneId}/manifest.json`,
		);

		if (!response.ok) {
			console.warn(
				`SoundLoader: Failed to load manifest for ${sceneId}: ${response.status}`,
			);
			return createEmptyManifest();
		}

		const manifest = await response.json();
		if (!manifest) {
			return createEmptyManifest();
		}

		// Ensure all arrays exist
		return {
			ambient: manifest.ambient ?? [],
			objects: manifest.objects ?? [],
			hover: manifest.hover ?? [],
			oneshot: manifest.oneshot ?? [],
		};
	} catch (error) {
		console.warn("SoundLoader: Failed to load manifest", error);
		return createEmptyManifest();
	}
}

/**
 * Preload all audio files from a manifest into a Phaser scene
 *
 * @param scene - The Phaser scene to load audio into
 * @param sceneId - The scene identifier for constructing file paths
 * @param manifest - The sound manifest containing audio configurations
 * @returns Promise that resolves when all audio is loaded
 */
export function preloadSceneAudio(
	scene: Scene,
	sceneId: string,
	manifest: SoundManifest,
): Promise<void> {
	const allSounds = [
		...manifest.ambient,
		...manifest.objects,
		...manifest.hover,
		...manifest.oneshot,
	];

	if (allSounds.length === 0) {
		return Promise.resolve();
	}

	let loadedCount = 0;
	const totalCount = allSounds.length;

	return new Promise<void>((resolve) => {
		for (const sound of allSounds) {
			const key = sound.id;
			const path = `/audio/scenes/${sceneId}/${sound.file}`;

			if (!scene.cache.audio.exists(key)) {
				scene.load.audio(key, path);
			} else {
				loadedCount++;
			}
		}

		if (loadedCount === totalCount) {
			resolve();
			return;
		}

		scene.load.once("complete", () => {
			resolve();
		});

		scene.load.start();
	});
}
