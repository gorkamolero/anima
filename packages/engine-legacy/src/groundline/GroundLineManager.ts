import type { Scene } from "phaser";
import { GroundLine } from "./GroundLine";
import { GroundLineRenderer } from "./GroundLineRenderer";
import type {
	GroundLineCallbacks,
	GroundLineConfig,
	GroundLinePoint,
	PositionUpdateCallback,
} from "./types";

/**
 * Registered character info
 */
interface RegisteredCharacter {
	id: string;
	sprite: Phaser.GameObjects.Sprite;
	baseScale: number;
	/** When true, ground line updates are suspended (editor is dragging) */
	suspended: boolean;
}

// Scene registry - same pattern as HotspotEditor
const sceneGroundLines = new WeakMap<Scene, GroundLineManager>();

/**
 * Get the ground line manager for a scene
 */
export function getSceneGroundLine(
	scene: Scene,
): GroundLineManager | undefined {
	return sceneGroundLines.get(scene);
}

/**
 * Register a character with the ground line system.
 * Returns a position callback if ground line exists, undefined otherwise.
 */
export function registerWithGroundLine(
	scene: Scene,
	characterId: string,
	sprite: Phaser.GameObjects.Sprite,
	baseScale: number,
): PositionUpdateCallback | undefined {
	const manager = sceneGroundLines.get(scene);
	if (!manager) return undefined;
	return manager.registerCharacter(characterId, sprite, baseScale);
}

/**
 * Manages ground line for a scene.
 * Characters register to receive Y/scale updates based on X position.
 */
export class GroundLineManager {
	private scene: Scene;
	private groundLine: GroundLine | null = null;
	private characters: Map<string, RegisteredCharacter> = new Map();
	private callbacks: GroundLineCallbacks;
	private renderer: GroundLineRenderer;
	private clampToBounds: boolean;

	constructor(
		scene: Scene,
		config?: GroundLineConfig,
		callbacks?: GroundLineCallbacks,
	) {
		this.scene = scene;
		this.callbacks = callbacks || {};
		this.clampToBounds = config?.clampToBounds ?? true;

		sceneGroundLines.set(scene, this);

		if (config && config.points.length >= 2) {
			this.groundLine = new GroundLine(config);
		}

		this.renderer = new GroundLineRenderer(scene);
	}

	/**
	 * Register a character to follow the ground line.
	 * Returns a callback the character should call in preUpdate.
	 */
	registerCharacter(
		id: string,
		sprite: Phaser.GameObjects.Sprite,
		baseScale: number,
	): PositionUpdateCallback {
		this.characters.set(id, { id, sprite, baseScale, suspended: false });

		// Return the callback that Character will use
		return (x: number) => {
			const char = this.characters.get(id);

			// If suspended (editor dragging), return current position unchanged
			if (char?.suspended) {
				return { y: sprite.y, scale: sprite.scale };
			}

			if (!this.groundLine) {
				return { y: sprite.y }; // No ground line, keep current Y
			}

			const { y, scale } = this.groundLine.getPositionData(x, baseScale);
			return { y, scale };
		};
	}

	/**
	 * Unregister a character
	 */
	unregisterCharacter(id: string): void {
		this.characters.delete(id);
	}

	/**
	 * Suspend ground line updates for a character (during editor drag)
	 */
	suspendCharacter(id: string): void {
		const char = this.characters.get(id);
		if (char) char.suspended = true;
	}

	/**
	 * Resume ground line updates for a character
	 */
	resumeCharacter(id: string): void {
		const char = this.characters.get(id);
		if (char) char.suspended = false;
	}

	/**
	 * Clamp X position to ground line bounds (if enabled)
	 */
	clampX(x: number): number {
		if (!this.groundLine || !this.clampToBounds) return x;
		return Math.max(
			this.groundLine.getMinX(),
			Math.min(x, this.groundLine.getMaxX()),
		);
	}

	// =========================================================================
	// Ground line mutation (for editor)
	// =========================================================================

	setGroundLine(config: GroundLineConfig): void {
		this.groundLine = new GroundLine(config);
		this.callbacks.onGroundLineChanged?.(config.points);
		this.renderer.render(this.groundLine);
	}

	addPoint(x: number, y: number): number {
		const point = { x: Math.round(x), y: Math.round(y) };

		if (!this.groundLine) {
			this.groundLine = new GroundLine({ points: [point] });
		} else {
			this.groundLine = this.groundLine.addPoint(point);
		}

		const points = [...this.groundLine.getPoints()];
		const index = points.findIndex((p) => p.x === point.x && p.y === point.y);

		this.callbacks.onPointAdded?.(point, index);
		this.callbacks.onGroundLineChanged?.(points);
		this.renderer.render(this.groundLine);

		return index;
	}

	movePoint(index: number, x: number, y: number): void {
		if (!this.groundLine) return;

		const point = { x: Math.round(x), y: Math.round(y) };
		this.groundLine = this.groundLine.updatePoint(index, point);

		this.callbacks.onPointMoved?.(index, point);
		this.callbacks.onGroundLineChanged?.([...this.groundLine.getPoints()]);
		this.renderer.render(this.groundLine);
	}

	removePoint(index: number): void {
		if (!this.groundLine) return;

		const points = this.groundLine.getPoints();
		if (points.length <= 2) return; // Keep at least 2 points

		this.groundLine = this.groundLine.removePoint(index);

		this.callbacks.onPointRemoved?.(index);
		this.callbacks.onGroundLineChanged?.([...this.groundLine.getPoints()]);
		this.renderer.render(this.groundLine);
	}

	// =========================================================================
	// Editor visualization
	// =========================================================================

	setDebugDraw(enabled: boolean): void {
		this.renderer.setVisible(enabled);
		if (enabled && this.groundLine) {
			this.renderer.render(this.groundLine);
		}
	}

	/**
	 * Render ground line (called by editor)
	 */
	renderGroundLine(): void {
		if (this.groundLine) {
			this.renderer.render(this.groundLine);
		}
	}

	// =========================================================================
	// Accessors
	// =========================================================================

	getGroundLine(): GroundLine | null {
		return this.groundLine;
	}

	getPoints(): readonly GroundLinePoint[] {
		return this.groundLine?.getPoints() ?? [];
	}

	hasGroundLine(): boolean {
		return this.groundLine !== null;
	}

	// =========================================================================
	// Cleanup
	// =========================================================================

	destroy(): void {
		sceneGroundLines.delete(this.scene);
		this.renderer.destroy();
		this.characters.clear();
	}
}
