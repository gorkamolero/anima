import { Scene } from "phaser";
import { IrisTransition } from "../transitions";
import { UIState } from "../ui";
import { ScenePreloadManager } from "./ScenePreloadManager";
import type { SceneSoundManager } from "../audio";
import { getCharacterHeadPosition, type Character } from "../characters";

/**
 * Transition options for scene changes
 */
export interface TransitionOptions {
	data?: Record<string, unknown>;
	duration?: number;
	skipTransition?: boolean;
}

/**
 * Manages scene transitions including iris wipe and fade effects.
 * Uses composition pattern - instantiate and delegate from BaseScene.
 */
export class SceneTransitions {
	private readonly scene: Scene;
	private irisTransition?: IrisTransition;

	constructor(scene: Scene) {
		this.scene = scene;
	}

	/**
	 * Transition to another scene using iris wipe effect
	 */
	public async transitionToScene(
		sceneKey: string,
		options: TransitionOptions = {},
		player?: Character,
		soundManager?: SceneSoundManager,
	): Promise<void> {
		const { data, duration = 600, skipTransition = false } = options;
		const preloadManager = ScenePreloadManager.getInstance();

		// Iris out centered on player's head (unless skipped)
		if (!skipTransition) {
			soundManager?.fadeOutAll(duration);

			const headPos = getCharacterHeadPosition(player, this.scene.cameras.main);
			// Destroy old transition before creating new one
			this.irisTransition?.destroy();
			this.irisTransition = new IrisTransition(this.scene);

			// Wait for iris to close
			await this.irisTransition.irisOut({
				centerX: headPos.x,
				centerY: headPos.y,
				duration,
			});
		}

		// Wait for scene assets if not loaded
		if (!preloadManager.isSceneLoaded(sceneKey)) {
			UIState.getInstance().showSceneLoading(true);

			try {
				await preloadManager.waitForSceneWithTimeout(sceneKey, 10000);
			} catch (error) {
				console.error(`Scene preload failed: ${sceneKey}`, error);
				this.scene.events.emit("sceneLoadWarning", { sceneKey, error });
				// Continue to scene - it may partially work or show placeholder assets
			}

			UIState.getInstance().showSceneLoading(false);
		}

		// Start the scene
		this.scene.scene.start(sceneKey, { ...data, _irisIn: !skipTransition });
	}

	/**
	 * Iris in from black at scene start
	 */
	public async irisIn(duration = 600, player?: Character): Promise<void> {
		const headPos = getCharacterHeadPosition(player, this.scene.cameras.main);
		// Destroy old transition before creating new one
		this.irisTransition?.destroy();
		this.irisTransition = new IrisTransition(this.scene);

		// Start with closed iris, then open
		this.irisTransition.drawClosed({ centerX: headPos.x, centerY: headPos.y });
		await this.irisTransition.irisIn({
			centerX: headPos.x,
			centerY: headPos.y,
			duration,
		});
	}

	/**
	 * Fade in the scene from black
	 */
	public fadeIn(duration = 500): void {
		this.scene.cameras.main.fadeIn(duration);
	}

	/**
	 * Fade out and transition to another scene
	 */
	public fadeToScene(
		sceneKey: string,
		data?: Record<string, unknown>,
		duration = 500,
	): void {
		this.scene.cameras.main.fadeOut(
			duration,
			0,
			0,
			0,
			(_cam: unknown, progress: number) => {
				if (progress === 1) {
					this.scene.scene.start(sceneKey, data);
				}
			},
		);
	}

	/**
	 * Destroy the iris transition effect
	 */
	public destroy(): void {
		this.irisTransition?.destroy();
		this.irisTransition = undefined;
	}
}
