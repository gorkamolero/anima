import { Scene, GameObjects } from "phaser";

/**
 * Parallax layer configuration
 */
export interface ParallaxLayerConfig {
	key: string;
	scrollFactor: number; // 0 = fixed, 1 = moves with camera
	y: number;
	depth: number;
	tileSprite?: boolean; // Use TileSprite for seamless scrolling
	height?: number;
	origin?: { x: number; y: number };
}

type ParallaxLayer = GameObjects.Image | GameObjects.TileSprite;

/**
 * Manages parallax background layers with automatic scrolling.
 * Uses composition pattern - instantiate and delegate from BaseScene.
 */
export class SceneParallax {
	private readonly scene: Scene;
	private readonly layers: Map<string, ParallaxLayer> = new Map();
	private readonly configs: Map<string, ParallaxLayerConfig> = new Map();

	constructor(scene: Scene) {
		this.scene = scene;
	}

	/**
	 * Add a parallax layer to the scene
	 */
	public addLayer(config: ParallaxLayerConfig): ParallaxLayer {
		const { key, scrollFactor, y, depth, tileSprite, height, origin } = config;

		let layer: ParallaxLayer;

		if (tileSprite && height) {
			const screenWidth = this.scene.cameras.main.width;
			layer = this.scene.add.tileSprite(
				screenWidth / 2,
				y,
				screenWidth,
				height,
				key,
			);
			layer.setOrigin(0.5, origin?.y ?? 0);
			layer.setScrollFactor(0);
		} else {
			layer = this.scene.add.image(0, y, key);
			layer.setOrigin(origin?.x ?? 0, origin?.y ?? 0);
			layer.setScrollFactor(scrollFactor);
		}

		layer.setDepth(depth);
		this.layers.set(key, layer);
		this.configs.set(key, config);

		return layer;
	}

	/**
	 * Get a parallax layer by key
	 */
	public getLayer(key: string): ParallaxLayer | undefined {
		return this.layers.get(key);
	}

	/**
	 * Set texture for a layer
	 */
	public setLayerTexture(layerKey: string, newTextureKey: string): void {
		const layer = this.layers.get(layerKey);
		if (layer) {
			layer.setTexture(newTextureKey);
		}
	}

	/**
	 * Update parallax TileSprites based on camera position.
	 * Call this in update().
	 */
	public update(cameraScrollX: number): void {
		for (const [key, layer] of this.layers) {
			const config = this.configs.get(key);
			if (config?.tileSprite && layer instanceof GameObjects.TileSprite) {
				layer.tilePositionX = cameraScrollX * config.scrollFactor;
			}
		}
	}

	/**
	 * Get all layer keys
	 */
	public getLayerKeys(): string[] {
		return Array.from(this.layers.keys());
	}

	/**
	 * Check if a layer exists
	 */
	public hasLayer(key: string): boolean {
		return this.layers.has(key);
	}

	/**
	 * Destroy all layers and clean up
	 */
	public destroy(): void {
		for (const layer of this.layers.values()) {
			layer.destroy();
		}
		this.layers.clear();
		this.configs.clear();
	}
}
