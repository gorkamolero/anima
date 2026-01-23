import type { Scene } from "phaser";
import { registerHotspotWithEditor } from "../editor";

export type HotspotVerb = "look" | "talk" | "use" | "pickup";
export type HotspotIcon =
	| "door"
	| "computer"
	| "person"
	| "fridge"
	| "degree"
	| "bar"
	| "bartender"
	| "exit";

export interface HotspotConfig {
	id: string;
	name: string;
	x: number;
	y: number;
	width: number;
	height: number;
	verbs: HotspotVerb[];
	icon?: HotspotIcon;
	sprite?: string;
	spriteScale?: number;
	spriteDepth?: number;
	onInteract?: (verb: HotspotVerb) => void;
}

/**
 * Interactive hotspot for point-and-click adventures.
 * Handles: click detection, verb interactions, debug visualization.
 */
export class Hotspot {
	public id: string;
	public name: string;
	public bounds: Phaser.Geom.Rectangle;
	public verbs: HotspotVerb[];
	public onInteract?: (verb: HotspotVerb) => void;

	private icon?: HotspotIcon;
	private graphics: Phaser.GameObjects.Graphics;
	private iconGraphics: Phaser.GameObjects.Graphics;
	private spriteObj?: Phaser.GameObjects.Image;
	private isHovered = false;
	private debugDraw = false;

	constructor(scene: Scene, config: HotspotConfig) {
		this.id = config.id;
		this.name = config.name;
		this.icon = config.icon;
		this.bounds = new Phaser.Geom.Rectangle(
			config.x,
			config.y,
			config.width,
			config.height,
		);
		this.verbs = config.verbs;
		this.onInteract = config.onInteract;

		this.graphics = scene.add.graphics();
		this.iconGraphics = scene.add.graphics();

		// Auto-register with editor
		registerHotspotWithEditor(scene, this);

		if (config.sprite) {
			this.spriteObj = scene.add.image(
				this.bounds.centerX,
				this.bounds.centerY,
				config.sprite,
			);
			if (config.spriteScale) {
				this.spriteObj.setScale(config.spriteScale);
			} else {
				const scaleX = this.bounds.width / this.spriteObj.width;
				const scaleY = this.bounds.height / this.spriteObj.height;
				this.spriteObj.setScale(Math.min(scaleX, scaleY));
			}
			if (config.spriteDepth !== undefined) {
				this.spriteObj.setDepth(config.spriteDepth);
			}
		}

		this.drawIcon();
		this.drawBounds();
	}

	private drawIcon(): void {
		if (!this.icon) return;

		this.iconGraphics.clear();
		const cx = this.bounds.centerX;
		const cy = this.bounds.centerY;
		const w = this.bounds.width;
		const h = this.bounds.height;

		this.iconGraphics.lineStyle(3, 0xffffff, 1);
		this.iconGraphics.fillStyle(0x444444, 1);

		switch (this.icon) {
			case "door":
				this.iconGraphics.fillStyle(0x8b4513, 1);
				this.iconGraphics.fillRect(
					cx - w * 0.3,
					cy - h * 0.4,
					w * 0.6,
					h * 0.8,
				);
				this.iconGraphics.strokeRect(
					cx - w * 0.3,
					cy - h * 0.4,
					w * 0.6,
					h * 0.8,
				);
				this.iconGraphics.fillStyle(0xffd700, 1);
				this.iconGraphics.fillCircle(cx + w * 0.15, cy, 8);
				break;

			case "computer":
				this.iconGraphics.fillStyle(0x1a1a1a, 1);
				this.iconGraphics.fillRect(
					cx - w * 0.3,
					cy - h * 0.3,
					w * 0.6,
					h * 0.4,
				);
				this.iconGraphics.strokeRect(
					cx - w * 0.3,
					cy - h * 0.3,
					w * 0.6,
					h * 0.4,
				);
				this.iconGraphics.fillStyle(0x333333, 1);
				this.iconGraphics.fillRect(
					cx - w * 0.35,
					cy + h * 0.15,
					w * 0.7,
					h * 0.2,
				);
				this.iconGraphics.strokeRect(
					cx - w * 0.35,
					cy + h * 0.15,
					w * 0.7,
					h * 0.2,
				);
				break;

			case "person":
				this.iconGraphics.fillStyle(0xffdbac, 1);
				this.iconGraphics.fillCircle(cx, cy - h * 0.2, w * 0.15);
				this.iconGraphics.strokeCircle(cx, cy - h * 0.2, w * 0.15);
				this.iconGraphics.fillStyle(0x4169e1, 1);
				this.iconGraphics.fillRect(cx - w * 0.15, cy, w * 0.3, h * 0.35);
				this.iconGraphics.strokeRect(cx - w * 0.15, cy, w * 0.3, h * 0.35);
				break;

			case "fridge":
				this.iconGraphics.fillStyle(0xe0e0e0, 1);
				this.iconGraphics.fillRect(
					cx - w * 0.3,
					cy - h * 0.4,
					w * 0.6,
					h * 0.8,
				);
				this.iconGraphics.strokeRect(
					cx - w * 0.3,
					cy - h * 0.4,
					w * 0.6,
					h * 0.8,
				);
				this.iconGraphics.strokeRect(
					cx - w * 0.3,
					cy - h * 0.4,
					w * 0.6,
					h * 0.25,
				);
				this.iconGraphics.lineStyle(3, 0x666666, 1);
				this.iconGraphics.strokeRect(cx + w * 0.15, cy - h * 0.25, 15, 30);
				this.iconGraphics.strokeRect(cx + w * 0.15, cy + h * 0.1, 15, 30);
				break;

			case "degree":
				this.iconGraphics.fillStyle(0x8b4513, 1);
				this.iconGraphics.fillRect(
					cx - w * 0.4,
					cy - h * 0.35,
					w * 0.8,
					h * 0.7,
				);
				this.iconGraphics.strokeRect(
					cx - w * 0.4,
					cy - h * 0.35,
					w * 0.8,
					h * 0.7,
				);
				this.iconGraphics.fillStyle(0xfffacd, 1);
				this.iconGraphics.fillRect(
					cx - w * 0.3,
					cy - h * 0.25,
					w * 0.6,
					h * 0.5,
				);
				break;

			case "bar":
				this.iconGraphics.fillStyle(0x8b4513, 1);
				this.iconGraphics.fillRect(
					cx - w * 0.4,
					cy + h * 0.2,
					w * 0.8,
					h * 0.2,
				);
				this.iconGraphics.strokeRect(
					cx - w * 0.4,
					cy + h * 0.2,
					w * 0.8,
					h * 0.2,
				);
				this.iconGraphics.fillStyle(0x228b22, 1);
				this.iconGraphics.fillRect(cx - w * 0.2, cy - h * 0.2, 15, 40);
				this.iconGraphics.fillRect(cx, cy - h * 0.15, 15, 35);
				this.iconGraphics.fillRect(cx + w * 0.2, cy - h * 0.25, 15, 45);
				break;

			case "bartender":
				this.iconGraphics.fillStyle(0xffdbac, 1);
				this.iconGraphics.fillCircle(cx, cy - h * 0.25, w * 0.12);
				this.iconGraphics.strokeCircle(cx, cy - h * 0.25, w * 0.12);
				this.iconGraphics.fillStyle(0x2c2c2c, 1);
				this.iconGraphics.fillRect(
					cx - w * 0.15,
					cy - h * 0.05,
					w * 0.3,
					h * 0.4,
				);
				this.iconGraphics.fillStyle(0xffffff, 1);
				this.iconGraphics.fillRect(cx - w * 0.1, cy, w * 0.2, h * 0.35);
				break;

			case "exit":
				this.iconGraphics.fillStyle(0xff0000, 1);
				this.iconGraphics.fillRect(
					cx - w * 0.3,
					cy - h * 0.2,
					w * 0.6,
					h * 0.4,
				);
				this.iconGraphics.strokeRect(
					cx - w * 0.3,
					cy - h * 0.2,
					w * 0.6,
					h * 0.4,
				);
				this.iconGraphics.lineStyle(2, 0xffffff, 1);
				this.iconGraphics.strokeRect(
					cx - w * 0.35,
					cy - h * 0.3,
					w * 0.7,
					h * 0.6,
				);
				break;
		}
	}

	private drawBounds(): void {
		if (!this.debugDraw) return;

		this.graphics.clear();

		if (this.isHovered) {
			this.graphics.lineStyle(4, 0x3b82f6, 1);
			this.graphics.fillStyle(0x3b82f6, 0.3);
			this.graphics.strokeRect(
				this.bounds.x - 2,
				this.bounds.y - 2,
				this.bounds.width + 4,
				this.bounds.height + 4,
			);
			this.graphics.fillRect(
				this.bounds.x,
				this.bounds.y,
				this.bounds.width,
				this.bounds.height,
			);
		} else {
			this.graphics.lineStyle(2, 0x00ff00, 0.5);
			this.graphics.fillStyle(0x00ff00, 0.1);
			this.graphics.strokeRect(
				this.bounds.x,
				this.bounds.y,
				this.bounds.width,
				this.bounds.height,
			);
			this.graphics.fillRect(
				this.bounds.x,
				this.bounds.y,
				this.bounds.width,
				this.bounds.height,
			);
		}
	}

	public checkHover(pointer: { x: number; y: number }): boolean {
		const wasHovered = this.isHovered;
		this.isHovered = this.bounds.contains(pointer.x, pointer.y);

		if (wasHovered !== this.isHovered) {
			this.drawBounds();
		}

		return this.isHovered;
	}

	public getIsHovered(): boolean {
		return this.isHovered;
	}

	public interact(verb: HotspotVerb): void {
		if (!this.verbs.includes(verb)) {
			return;
		}

		if (this.onInteract) {
			this.onInteract(verb);
		}
	}

	public destroy(): void {
		this.graphics.destroy();
		this.iconGraphics.destroy();
		if (this.spriteObj) {
			this.spriteObj.destroy();
		}
	}

	public updateBounds(
		x: number,
		y: number,
		width: number,
		height: number,
	): void {
		this.bounds.setTo(x, y, width, height);
		this.syncSprite();
		this.drawIcon();
		this.drawBounds();
	}

	public syncSprite(): void {
		if (this.spriteObj) {
			this.spriteObj.setPosition(this.bounds.centerX, this.bounds.centerY);
		}
	}

	public setSpriteScale(scale: number): void {
		if (this.spriteObj) {
			this.spriteObj.setScale(scale);
		}
	}

	public getSpriteScale(): number {
		return this.spriteObj?.scaleX ?? 1;
	}

	public hideSprite(): void {
		if (this.spriteObj) {
			this.spriteObj.setVisible(false);
		}
	}

	public showSprite(): void {
		if (this.spriteObj) {
			this.spriteObj.setVisible(true);
		}
	}

	public hasSprite(): boolean {
		return !!this.spriteObj;
	}

	public setDebugDraw(enabled: boolean): void {
		this.debugDraw = enabled;
		if (!enabled) {
			this.graphics.clear();
		} else {
			this.drawBounds();
		}
	}
}
