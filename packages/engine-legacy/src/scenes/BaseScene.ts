import { Scene } from "phaser";
import { SceneSoundManager } from "../audio";
import { Character, type CharacterAnimConfig, getCharacterHeadPosition } from "../characters";
import { SpeechText } from "../dialogue";
import { type EditorCallbacks, HotspotEditor } from "../editor";
import { type GroundLineConfig, GroundLineManager } from "../groundline";
import { Hotspot, type HotspotConfig } from "../hotspots";
import { UIState } from "../ui";
import { SceneCamera, type CameraConfig } from "./SceneCamera";
import {
	SceneParallax,
	type ParallaxLayerConfig,
} from "./SceneParallax";
import {
	SceneTransitions,
	type TransitionOptions,
} from "./SceneTransitions";

// Re-export types for backward compatibility
export type { ParallaxLayerConfig } from "./SceneParallax";
export type { TransitionOptions } from "./SceneTransitions";

/**
 * Player configuration for createPlayer
 */
export interface PlayerConfig {
	x: number;
	y: number;
	scale?: number;
	spriteKey: string;
	animConfig?: CharacterAnimConfig;
}

/**
 * Scene configuration
 */
export interface SceneConfig {
	sceneName: string;
	displayName: string;
	worldWidth: number;
	playerSpawn: { x: number; y: number; scale: number };
	playerLeftBoundary?: number;
	playerRightBoundary?: number;
	playerSpeed?: number;
	/** Optional ground line configuration for walking path */
	groundLine?: GroundLineConfig;
}

/**
 * Base scene for point-and-click adventure games.
 * Provides: parallax backgrounds, ground line, edge scrolling, and scene transition helpers.
 */
export abstract class BaseScene extends Scene {
	/**
	 * Standard game world height in pixels.
	 * 1080p is the target resolution for this engine, matching Full HD displays.
	 */
	protected static readonly WORLD_HEIGHT = 1080;

	/**
	 * Default fade transition duration in milliseconds.
	 * 500ms provides a smooth but not sluggish transition feel.
	 */
	protected static readonly DEFAULT_FADE_DURATION = 500;

	/**
	 * Default iris transition duration in milliseconds.
	 * 600ms matches classic cartoon iris wipe timing.
	 */
	protected static readonly DEFAULT_IRIS_DURATION = 600;

	// Helper modules (composition)
	protected sceneCamera!: SceneCamera;
	protected sceneParallax!: SceneParallax;
	protected sceneTransitions!: SceneTransitions;

	// World dimensions
	protected worldWidth = 0;

	// Input blocking
	protected inputBlocked = false;

	// Input listener reference for cleanup
	private pointerDownListener?: (pointer: Phaser.Input.Pointer) => void;

	// Ground line manager (optional)
	protected groundLineManager?: GroundLineManager;

	// Editor
	protected editor?: HotspotEditor;
	protected editorCallbacks: EditorCallbacks = {};

	// Scene configuration (set by child class)
	protected abstract readonly config: SceneConfig;

	// Player character instance
	protected player?: Character;

	// Speech text for floating dialogue
	protected speechText?: SpeechText;

	// Scene sound manager
	protected soundManager?: SceneSoundManager;

	// Active hotspots in the scene
	protected hotspots: Hotspot[] = [];

	// Debug mode flag
	protected debugMode: boolean = false;

	/**
	 * Base create - sets up physics and camera bounds.
	 * Child classes should call super.create() after setting up backgrounds.
	 */
	create(): void {
		this.worldWidth = this.config.worldWidth;

		// Initialize helper modules
		const cameraConfig: CameraConfig = {
			worldWidth: this.worldWidth,
			worldHeight: BaseScene.WORLD_HEIGHT,
		};
		this.sceneCamera = new SceneCamera(this, cameraConfig);
		this.sceneParallax = new SceneParallax(this);
		this.sceneTransitions = new SceneTransitions(this);

		// Set up physics world bounds
		this.physics.world.setBounds(0, 0, this.worldWidth, BaseScene.WORLD_HEIGHT);

		// Set up camera bounds
		this.sceneCamera.setupBounds();

		// Disable browser context menu
		this.input.mouse?.disableContextMenu();

		// Create ground line manager BEFORE editor (so characters can register when created)
		if (this.config.groundLine) {
			this.groundLineManager = new GroundLineManager(
				this,
				this.config.groundLine,
			);
		}

		// Create editor (auto-registration happens when Characters/Hotspots are created)
		this.editor = new HotspotEditor(this, this.editorCallbacks);

		// Connect editor to ground line manager
		if (this.groundLineManager) {
			this.editor.setGroundLineManager(this.groundLineManager);
		}
	}

	// ===========================================================================
	// Parallax Layers (delegates to SceneParallax)
	// ===========================================================================

	/**
	 * Add a parallax layer to the scene
	 */
	protected addParallaxLayer(
		config: ParallaxLayerConfig,
	): Phaser.GameObjects.Image | Phaser.GameObjects.TileSprite {
		if (!this.sceneParallax) {
			throw new Error("addParallaxLayer called before create()");
		}
		return this.sceneParallax.addLayer(config);
	}

	protected getParallaxLayer(
		key: string,
	): Phaser.GameObjects.Image | Phaser.GameObjects.TileSprite | undefined {
		return this.sceneParallax?.getLayer(key);
	}

	protected setLayerTexture(layerKey: string, newTextureKey: string): void {
		this.sceneParallax?.setLayerTexture(layerKey, newTextureKey);
	}

	/**
	 * Update parallax TileSprites based on camera position.
	 * Call this in update().
	 */
	protected updateParallaxLayers(): void {
		this.sceneParallax?.update(this.cameras.main.scrollX);
	}

	// ===========================================================================
	// Edge Scrolling (delegates to SceneCamera)
	// ===========================================================================

	/**
	 * Handle edge scrolling - call in update()
	 */
	protected handleEdgeScrolling(pointer: Phaser.Input.Pointer): void {
		this.sceneCamera.handleEdgeScrolling(pointer);
	}

	// ===========================================================================
	// Movement Boundaries
	// ===========================================================================

	/**
	 * Clamp movement to configured boundaries
	 */
	protected clampMovement(targetX: number): number {
		let x = targetX;
		if (this.config.playerLeftBoundary !== undefined) {
			x = Math.max(x, this.config.playerLeftBoundary);
		}
		if (this.config.playerRightBoundary !== undefined) {
			x = Math.min(x, this.config.playerRightBoundary);
		}
		return x;
	}

	// ===========================================================================
	// Scene Transitions (delegates to SceneTransitions)
	// ===========================================================================

	/**
	 * Fade in the scene from black
	 */
	protected fadeInScene(duration = BaseScene.DEFAULT_FADE_DURATION): void {
		this.sceneTransitions.fadeIn(duration);
	}

	/**
	 * Fade out and transition to another scene
	 */
	protected fadeToScene(
		sceneKey: string,
		data?: Record<string, unknown>,
		duration = BaseScene.DEFAULT_FADE_DURATION,
	): void {
		this.inputBlocked = true;
		this.sceneTransitions.fadeToScene(sceneKey, data, duration);
	}

	/**
	 * Transition to another scene using iris wipe effect
	 */
	public async transitionToScene(
		sceneKey: string,
		options: TransitionOptions = {},
	): Promise<void> {
		// Block input during transition
		this.inputBlocked = true;
		await this.sceneTransitions.transitionToScene(
			sceneKey,
			options,
			this.player,
			this.soundManager,
		);
	}

	/**
	 * Iris in from black at scene start
	 */
	public async irisInScene(duration = BaseScene.DEFAULT_IRIS_DURATION): Promise<void> {
		await this.sceneTransitions.irisIn(duration, this.player);
	}

	/**
	 * Get player head position for iris transitions
	 * Returns center of screen if no player exists
	 */
	public getPlayerHeadPosition(): { x: number; y: number } {
		return getCharacterHeadPosition(this.player, this.cameras.main);
	}

	// ===========================================================================
	// Player Character Methods
	// ===========================================================================

	/**
	 * Create the player character using config from playerSpawn
	 * Returns the created Character instance
	 */
	public createPlayer(): Character {
		const { x, y, scale } = this.config.playerSpawn;

		// Default animation config if none specified
		const defaultAnimConfig: CharacterAnimConfig = {
			walk: {
				key: "player-walk",
				frames: { start: 0, end: 7 },
				frameRate: 12,
			},
			idle: {
				key: "player-idle",
				frames: { start: 0, end: 3 },
				frameRate: 8,
			},
		};

		this.player = new Character(
			this,
			x,
			y,
			"player", // Default texture key
			defaultAnimConfig,
			scale,
			"player",
		);

		if (this.config.playerSpeed) {
			this.player.setMoveSpeed(this.config.playerSpeed);
		}

		return this.player;
	}

	/**
	 * Get the player character instance
	 */
	public getPlayer(): Character | undefined {
		return this.player;
	}

	// ===========================================================================
	// Dialogue Systems
	// ===========================================================================

	/**
	 * Set up dialogue systems including SpeechText
	 */
	public setupDialogueSystems(): void {
		this.speechText = new SpeechText(this);
	}

	/**
	 * Get the speech text instance (for subclass access)
	 */
	public getSpeechText(): SpeechText | undefined {
		return this.speechText;
	}

	// ===========================================================================
	// Sound Manager
	// ===========================================================================

	/**
	 * Initialize the scene sound manager
	 */
	public async initializeSoundManager(): Promise<void> {
		this.soundManager = new SceneSoundManager(this, this.config.sceneName);
		await this.soundManager.initialize();
	}

	/**
	 * Get the sound manager instance
	 */
	public getSoundManager(): SceneSoundManager | undefined {
		return this.soundManager;
	}

	// ===========================================================================
	// Input Handling
	// ===========================================================================

	/**
	 * Set up input handlers for pointer events
	 */
	public setupInputHandlers(): void {
		this.pointerDownListener = (pointer: Phaser.Input.Pointer) => {
			this.handlePointerDown(pointer);
		};
		this.input.on("pointerdown", this.pointerDownListener, this);
	}

	/**
	 * Handle pointer down events - override in subclass for custom behavior
	 */
	protected handlePointerDown(_pointer: Phaser.Input.Pointer): void {
		// Base implementation does nothing
		// Subclasses can override for game-specific click handling
	}

	// ===========================================================================
	// Hotspot Management
	// ===========================================================================

	/**
	 * Add a hotspot to the scene
	 */
	public addHotspot(config: HotspotConfig): void {
		const hotspot = new Hotspot(this, config);
		this.hotspots.push(hotspot);
	}

	/**
	 * Get all hotspots in the scene
	 */
	public getHotspots(): Hotspot[] {
		return this.hotspots;
	}

	/**
	 * Find a hotspot at the given coordinates
	 */
	public findHotspotAtPoint(x: number, y: number): Hotspot | undefined {
		// Return last matching hotspot (topmost in render order)
		const matching = this.hotspots.filter((h) => h.bounds.contains(x, y));
		return matching[matching.length - 1];
	}

	// ===========================================================================
	// UI State
	// ===========================================================================

	/**
	 * Update UI state with current scene name
	 */
	public updateUIState(): void {
		UIState.getInstance().setSceneName(this.config.displayName);
	}

	// ===========================================================================
	// Debug Mode
	// ===========================================================================

	/**
	 * Set debug mode
	 */
	public setDebugMode(enabled: boolean): void {
		this.debugMode = enabled;
	}

	// ===========================================================================
	// Update
	// ===========================================================================

	/**
	 * Base update - call super.update() from child classes
	 */
	update(_time?: number, _delta?: number): void {
		const pointer = this.input.activePointer;
		this.handleEdgeScrolling(pointer);
		this.updateParallaxLayers();
	}

	// ===========================================================================
	// Cleanup
	// ===========================================================================

	shutdown(): void {
		// Remove input listener
		if (this.pointerDownListener) {
			this.input.off("pointerdown", this.pointerDownListener, this);
			this.pointerDownListener = undefined;
		}

		// Destroy player
		this.player?.destroy();
		this.player = undefined;

		// Destroy helper modules
		this.sceneParallax?.destroy();
		this.sceneTransitions?.destroy();

		// Destroy managers and subsystems
		this.groundLineManager?.destroy();
		this.editor?.destroy();
		this.soundManager?.destroy();
		this.speechText?.destroy();

		// Clear hotspots
		for (const hotspot of this.hotspots) {
			hotspot.destroy();
		}
		this.hotspots = [];
	}

	// ===========================================================================
	// Public API
	// ===========================================================================

	public getConfig(): SceneConfig {
		return this.config;
	}

	/**
	 * Set editor callbacks (for React UI integration)
	 * Call before create() to receive editor events
	 */
	public setEditorCallbacks(callbacks: EditorCallbacks): void {
		this.editorCallbacks = callbacks;
	}

	/**
	 * Get the editor instance
	 */
	public getEditor(): HotspotEditor | undefined {
		return this.editor;
	}

	/**
	 * Get the ground line manager
	 */
	public getGroundLineManager(): GroundLineManager | undefined {
		return this.groundLineManager;
	}
}
