import { GameObjects, type Scene } from "phaser";
import { registerWithEditor } from "../editor";
import {
	type PositionUpdateCallback,
	registerWithGroundLine,
} from "../groundline";

/**
 * Animation configuration for a character
 */
export interface CharacterAnimConfig {
	walk: {
		key: string;
		frames: { start: number; end: number };
		frameRate: number;
	};
	idle: {
		key: string;
		frames: { start: number; end: number };
		frameRate: number;
	};
	/** If true, sprite faces left by default (flip when going right) */
	facesLeft?: boolean;
}

/**
 * Base character class for point-and-click adventures.
 * Handles: click-to-move, animations, walking, ground line following.
 */
export class Character extends GameObjects.Sprite {
	/**
	 * Default movement speed in pixels per second.
	 * 300 provides a comfortable walking pace that feels natural
	 * without being too slow or appearing to rush.
	 */
	protected static readonly DEFAULT_MOVE_SPEED = 300;

	/**
	 * Distance threshold (in pixels) for considering the character "arrived".
	 * 5 pixels prevents jittering at destination while being precise enough
	 * for gameplay purposes.
	 */
	protected static readonly ARRIVAL_THRESHOLD = 5;

	/**
	 * Default minimum approach distance (in pixels) for walkToPosition().
	 * 80 pixels keeps the character at a comfortable conversational distance
	 * from hotspots/NPCs rather than walking directly on top of them.
	 */
	protected static readonly DEFAULT_APPROACH_DISTANCE = 80;

	protected characterId: string;
	protected targetX: number | null = null;
	protected moveSpeed = Character.DEFAULT_MOVE_SPEED;
	protected isMoving = false;
	protected animConfig: CharacterAnimConfig;
	protected onArrivalResolve: (() => void) | null = null;
	protected facesLeft: boolean;

	/** Base scale before any perspective adjustment */
	protected baseScale: number;
	/** Callback for ground line position updates (optional) */
	protected positionCallback: PositionUpdateCallback | null = null;

	constructor(
		scene: Scene,
		x: number,
		y: number,
		texture: string,
		animConfig: CharacterAnimConfig,
		scale = 1,
		id?: string,
	) {
		super(scene, x, y, texture, 0);

		this.characterId = id || texture;
		this.animConfig = animConfig;
		this.facesLeft = animConfig.facesLeft ?? false;
		this.baseScale = scale;

		// Auto-register with editor
		registerWithEditor(
			scene,
			this.characterId,
			this.characterId,
			this,
			0x06b6d4,
		);

		// Try to register with ground line (returns undefined if none)
		this.positionCallback =
			registerWithGroundLine(scene, this.characterId, this, scale) ?? null;

		// Add to scene
		scene.add.existing(this);
		scene.physics.add.existing(this);

		// Origin at bottom center (feet)
		this.setOrigin(0.5, 1);
		this.setScale(scale);

		// Create animations
		this.createAnimations();

		// Physics body
		const body = this.body as Phaser.Physics.Arcade.Body;
		body.setCollideWorldBounds(true);

		// Start with idle
		this.play(this.animConfig.idle.key, true);

		// Apply initial ground line position
		if (this.positionCallback) {
			const { y: groundY, scale: groundScale } = this.positionCallback(x);
			this.y = groundY;
			if (groundScale !== undefined) {
				this.setScale(groundScale);
			}
		}
	}

	protected createAnimations(): void {
		const { walk, idle } = this.animConfig;

		if (!this.scene.anims.exists(walk.key)) {
			this.scene.anims.create({
				key: walk.key,
				frames: this.scene.anims.generateFrameNumbers(this.texture.key, {
					start: walk.frames.start,
					end: walk.frames.end,
				}),
				frameRate: walk.frameRate,
				repeat: -1,
			});
		}

		if (!this.scene.anims.exists(idle.key)) {
			this.scene.anims.create({
				key: idle.key,
				frames: this.scene.anims.generateFrameNumbers(this.texture.key, {
					start: idle.frames.start,
					end: idle.frames.end,
				}),
				frameRate: idle.frameRate,
				repeat: -1,
			});
		}
	}

	/**
	 * Move character to target X position
	 */
	public moveTo(targetX: number): void {
		this.targetX = targetX;
		this.isMoving = true;

		// Play walk animation
		this.play(this.animConfig.walk.key, true);

		// Face direction
		this.faceDirection(targetX);
	}

	/**
	 * Walk to position and return a promise that resolves on arrival
	 */
	public walkToPosition(x: number, minDistance = Character.DEFAULT_APPROACH_DISTANCE): Promise<void> {
		return new Promise((resolve) => {
			const currentDistance = Math.abs(this.x - x);
			if (currentDistance <= minDistance) {
				resolve();
				return;
			}

			const direction = x > this.x ? 1 : -1;
			const targetX = x - direction * minDistance;

			this.onArrivalResolve = resolve;
			this.moveTo(targetX);
		});
	}

	/**
	 * Face toward a target X position
	 */
	public faceDirection(targetX: number): void {
		const goingRight = targetX > this.x;
		this.setFlipX(this.facesLeft ? goingRight : !goingRight);
	}

	/**
	 * Stop all movement
	 */
	public stopMoving(): void {
		this.targetX = null;
		this.isMoving = false;

		const body = this.body as Phaser.Physics.Arcade.Body;
		body.setVelocity(0, 0);

		// Play idle animation
		this.play(this.animConfig.idle.key, true);

		// Resolve any pending promise
		if (this.onArrivalResolve) {
			this.onArrivalResolve();
			this.onArrivalResolve = null;
		}
	}

	preUpdate(time: number, delta: number): void {
		super.preUpdate(time, delta);

		// Apply ground line position (even when not moving, for editor sync)
		if (this.positionCallback) {
			const { y, scale } = this.positionCallback(this.x);
			this.y = y;
			if (scale !== undefined) {
				this.setScale(scale);
			}
		}

		if (!this.isMoving || this.targetX === null) {
			return;
		}

		const body = this.body as Phaser.Physics.Arcade.Body;
		const dx = this.targetX - this.x;
		const distance = Math.abs(dx);

		// Arrived at target
		if (distance < Character.ARRIVAL_THRESHOLD) {
			this.stopMoving();
			return;
		}

		const velocityX = (dx > 0 ? 1 : -1) * this.moveSpeed;
		body.setVelocity(velocityX, 0);

		// Flip based on direction
		const goingRight = velocityX > 0;
		this.setFlipX(this.facesLeft ? goingRight : !goingRight);
	}

	// ===========================================================================
	// Setters
	// ===========================================================================

	public setMoveSpeed(speed: number): void {
		this.moveSpeed = speed;
	}

	/**
	 * Set position callback manually (for late binding or custom behavior)
	 */
	public setPositionCallback(callback: PositionUpdateCallback | null): void {
		this.positionCallback = callback;
	}

	/**
	 * Get the base scale (before perspective adjustment)
	 */
	public getBaseScale(): number {
		return this.baseScale;
	}

	// ===========================================================================
	// Getters
	// ===========================================================================

	public getIsMoving(): boolean {
		return this.isMoving;
	}

	public getCharacterId(): string {
		return this.characterId;
	}
}
