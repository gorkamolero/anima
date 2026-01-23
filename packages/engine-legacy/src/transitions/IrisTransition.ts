/**
 * IrisTransition - Classic iris wipe transition effect
 *
 * Creates a circular reveal/hide effect commonly used in classic
 * cartoons and adventure games.
 */

import type { Scene } from "phaser";

export interface IrisTransitionOptions {
	/** Duration of the transition in ms */
	duration?: number;
	/** Center X of the iris (screen coordinates) */
	centerX?: number;
	/** Center Y of the iris (screen coordinates) */
	centerY?: number;
	/** Callback when transition completes */
	onComplete?: () => void;
}

export interface DrawClosedOptions {
	/** Center X of the iris hole */
	centerX?: number;
	/** Center Y of the iris hole */
	centerY?: number;
	/** Fill color (default: 0x000000 black) */
	color?: number;
}

/**
 * Creates a classic "iris wipe" transition effect.
 * A black mask with a circular hole that expands/shrinks to reveal/hide the scene.
 */
export class IrisTransition {
	private scene: Scene;
	private graphics: Phaser.GameObjects.Graphics | null = null;
	private currentTween: Phaser.Tweens.Tween | null = null;
	private destroyed = false;
	private pendingResolve: (() => void) | null = null;

	/** Default animation duration in milliseconds for iris transitions */
	private static readonly DEFAULT_DURATION = 600;

	/** Render depth ensuring iris overlay appears above all scene content */
	private static readonly DEPTH = 1000;

	/**
	 * Extra radius padding (in pixels) added to the calculated max radius.
	 * Ensures the iris circle fully covers screen corners during animation.
	 */
	private static readonly PADDING = 50;

	/**
	 * Number of line segments used to approximate the iris circle.
	 * 72 segments = 5 degrees per segment, providing smooth circular appearance
	 * while maintaining good performance.
	 */
	private static readonly CIRCLE_SEGMENTS = 72;

	constructor(scene: Scene) {
		this.scene = scene;
		this.graphics = scene.add.graphics();
		this.graphics.setDepth(IrisTransition.DEPTH);
		this.graphics.setScrollFactor(0);

		// Clean up when scene shuts down
		scene.events.once("shutdown", () => this.destroy());
		scene.events.once("destroy", () => this.destroy());
	}

	/**
	 * Cancel any running transition and resolve its pending promise
	 */
	private cancelCurrentTransition(): void {
		if (this.currentTween) {
			this.currentTween.destroy();
			this.currentTween = null;
		}
		if (this.pendingResolve) {
			this.pendingResolve();
			this.pendingResolve = null;
		}
	}

	/**
	 * Animate iris closing (circle shrinks from full screen to point)
	 */
	irisOut(options: IrisTransitionOptions = {}): Promise<void> {
		if (this.destroyed || !this.graphics) {
			return Promise.resolve();
		}

		// Cancel any running transition first
		this.cancelCurrentTransition();

		const {
			duration = IrisTransition.DEFAULT_DURATION,
			centerX = this.scene.scale.width / 2,
			centerY = this.scene.scale.height / 2,
			onComplete,
		} = options;

		// Calculate max radius to cover entire screen from center point
		const maxRadius = this.calculateMaxRadius(centerX, centerY);

		// Animation state object
		const state = { radius: maxRadius };

		return new Promise<void>((resolve) => {
			this.pendingResolve = resolve;
			this.currentTween = this.scene.tweens.add({
				targets: state,
				radius: 0,
				duration,
				ease: "Quad.easeIn",
				onUpdate: () => {
					if (!this.destroyed && this.graphics) {
						this.drawIris(centerX, centerY, state.radius);
					}
				},
				onComplete: () => {
					this.currentTween = null;
					this.pendingResolve = null;
					onComplete?.();
					resolve();
				},
			});
		});
	}

	/**
	 * Animate iris opening (circle expands from point to full screen)
	 */
	irisIn(options: IrisTransitionOptions = {}): Promise<void> {
		if (this.destroyed || !this.graphics) {
			return Promise.resolve();
		}

		// Cancel any running transition first
		this.cancelCurrentTransition();

		const {
			duration = IrisTransition.DEFAULT_DURATION,
			centerX = this.scene.scale.width / 2,
			centerY = this.scene.scale.height / 2,
			onComplete,
		} = options;

		// Calculate max radius to cover entire screen from center point
		const maxRadius = this.calculateMaxRadius(centerX, centerY);

		// Animation state object
		const state = { radius: 0 };

		return new Promise<void>((resolve) => {
			this.pendingResolve = resolve;
			this.currentTween = this.scene.tweens.add({
				targets: state,
				radius: maxRadius,
				duration,
				ease: "Quad.easeOut",
				onUpdate: () => {
					if (!this.destroyed && this.graphics) {
						this.drawIris(centerX, centerY, state.radius);
					}
				},
				onComplete: () => {
					this.currentTween = null;
					this.pendingResolve = null;
					// Clear graphics after iris fully opens
					this.graphics?.clear();
					onComplete?.();
					resolve();
				},
			});
		});
	}

	/**
	 * Draw a closed iris (filled screen)
	 */
	drawClosed(options: DrawClosedOptions = {}): void {
		if (this.destroyed || !this.graphics) {
			return;
		}

		const { color = 0x000000 } = options;

		this.graphics.clear();
		this.graphics.fillStyle(color, 1);
		this.graphics.fillRect(
			0,
			0,
			this.scene.scale.width,
			this.scene.scale.height,
		);
	}

	/**
	 * Clean up the transition
	 */
	destroy(): void {
		if (this.destroyed) {
			return;
		}
		this.destroyed = true;

		// Cancel any running transition and resolve its promise
		this.cancelCurrentTransition();

		// Destroy graphics
		if (this.graphics) {
			this.graphics.clear();
			this.graphics.destroy();
			this.graphics = null;
		}
	}

	/**
	 * Check if this transition has been destroyed
	 */
	isDestroyed(): boolean {
		return this.destroyed;
	}

	/**
	 * Calculate the maximum radius needed to cover the entire screen from a given center point
	 */
	private calculateMaxRadius(centerX: number, centerY: number): number {
		const width = this.scene.scale.width;
		const height = this.scene.scale.height;

		// Distance to each corner
		const corners = [
			{ x: 0, y: 0 },
			{ x: width, y: 0 },
			{ x: 0, y: height },
			{ x: width, y: height },
		];

		let maxDist = 0;
		for (const corner of corners) {
			const dist = Math.sqrt(
				(corner.x - centerX) ** 2 + (corner.y - centerY) ** 2,
			);
			maxDist = Math.max(maxDist, dist);
		}

		// Add some padding
		return maxDist + IrisTransition.PADDING;
	}

	/**
	 * Draw the iris mask with a circular hole
	 */
	private drawIris(centerX: number, centerY: number, radius: number): void {
		if (!this.graphics) {
			return;
		}

		const width = this.scene.scale.width;
		const height = this.scene.scale.height;

		this.graphics.clear();
		this.graphics.fillStyle(0x000000, 1);

		if (radius <= 0) {
			// Fully closed - just draw a black rectangle
			this.graphics.fillRect(0, 0, width, height);
			return;
		}

		// Draw the black area with a circular hole using path-based approach
		const segments = IrisTransition.CIRCLE_SEGMENTS;
		const maxRadius = Math.max(width, height) * 2;

		this.graphics.beginPath();

		// Draw outer circle (clockwise) - large enough to cover screen
		for (let i = 0; i <= segments; i++) {
			const angle = (i / segments) * Math.PI * 2;
			const x = centerX + Math.cos(angle) * maxRadius;
			const y = centerY + Math.sin(angle) * maxRadius;
			if (i === 0) {
				this.graphics.moveTo(x, y);
			} else {
				this.graphics.lineTo(x, y);
			}
		}

		// Draw inner circle (counter-clockwise) - the hole
		for (let i = segments; i >= 0; i--) {
			const angle = (i / segments) * Math.PI * 2;
			const x = centerX + Math.cos(angle) * radius;
			const y = centerY + Math.sin(angle) * radius;
			this.graphics.lineTo(x, y);
		}

		this.graphics.closePath();
		this.graphics.fillPath();
	}
}
