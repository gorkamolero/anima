import { Scene } from "phaser";

/**
 * Camera configuration options
 */
export interface CameraConfig {
	worldWidth: number;
	worldHeight?: number;
	edgeZone?: number;
	scrollSpeed?: number;
}

/**
 * Manages camera behavior including bounds and edge scrolling.
 * Uses composition pattern - instantiate and delegate from BaseScene.
 */
export class SceneCamera {
	private readonly scene: Scene;
	private readonly worldWidth: number;
	private readonly worldHeight: number;
	private readonly edgeZone: number;
	private readonly scrollSpeed: number;

	constructor(scene: Scene, config: CameraConfig) {
		this.scene = scene;
		this.worldWidth = config.worldWidth;
		this.worldHeight = config.worldHeight ?? 1080;
		this.edgeZone = config.edgeZone ?? 100;
		this.scrollSpeed = config.scrollSpeed ?? 12;
	}

	/**
	 * Set up camera bounds based on world dimensions
	 */
	public setupBounds(): void {
		this.scene.cameras.main.setBounds(
			0,
			0,
			this.worldWidth,
			this.worldHeight,
		);
	}

	/**
	 * Handle edge scrolling - call in update()
	 * Scrolls camera when pointer is near screen edges
	 */
	public handleEdgeScrolling(pointer: Phaser.Input.Pointer): void {
		const camera = this.scene.cameras.main;
		const screenWidth = this.scene.scale.width;

		const isTouchDevice = pointer.wasTouch;
		if (isTouchDevice && !pointer.isDown) return;

		const edgeZone = isTouchDevice ? screenWidth * 0.08 : this.edgeZone;

		if (pointer.x < edgeZone) {
			const intensity = 1 - pointer.x / edgeZone;
			camera.scrollX -= this.scrollSpeed * intensity;
		} else if (pointer.x > screenWidth - edgeZone) {
			const intensity = (pointer.x - (screenWidth - edgeZone)) / edgeZone;
			camera.scrollX += this.scrollSpeed * intensity;
		}

		camera.scrollX = Math.max(
			0,
			Math.min(camera.scrollX, this.worldWidth - screenWidth),
		);
	}

	/**
	 * Get current camera scroll position
	 */
	public getScrollX(): number {
		return this.scene.cameras.main.scrollX;
	}

	/**
	 * Get current camera scroll position
	 */
	public getScrollY(): number {
		return this.scene.cameras.main.scrollY;
	}

	/**
	 * Get camera width
	 */
	public getWidth(): number {
		return this.scene.cameras.main.width;
	}

	/**
	 * Get camera height
	 */
	public getHeight(): number {
		return this.scene.cameras.main.height;
	}

	/**
	 * Get center position of the camera viewport
	 */
	public getCenter(): { x: number; y: number } {
		const cam = this.scene.cameras.main;
		return {
			x: cam.scrollX + cam.width / 2,
			y: cam.scrollY + cam.height / 2,
		};
	}

	/**
	 * Fade in the scene from black
	 */
	public fadeIn(duration = 500): void {
		this.scene.cameras.main.fadeIn(duration);
	}

	/**
	 * Fade out the scene to black
	 */
	public fadeOut(
		duration = 500,
		onComplete?: () => void,
	): void {
		this.scene.cameras.main.fadeOut(
			duration,
			0,
			0,
			0,
			(_cam: unknown, progress: number) => {
				if (progress === 1 && onComplete) {
					onComplete();
				}
			},
		);
	}
}
