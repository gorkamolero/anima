import type { Scene } from "phaser";
import type { Bounds, HandleCorner } from "./types";

/**
 * Manages resize handles for the editor.
 * Handles are interactive Phaser rectangles at corners of selected items.
 */
export class HandleManager {
	private scene: Scene;
	private handles: Phaser.GameObjects.Rectangle[] = [];
	private onResizeStart:
		| ((corner: HandleCorner, wx: number, wy: number) => void)
		| null = null;

	constructor(scene: Scene) {
		this.scene = scene;
	}

	setResizeCallback(
		cb: (corner: HandleCorner, wx: number, wy: number) => void,
	): void {
		this.onResizeStart = cb;
	}

	/**
	 * Check if a world point is over any handle
	 */
	isPointOverHandle(wx: number, wy: number): boolean {
		const size = 8; // Half of handle size
		for (const h of this.handles) {
			if (
				wx >= h.x - size &&
				wx <= h.x + size &&
				wy >= h.y - size &&
				wy <= h.y + size
			) {
				return true;
			}
		}
		return false;
	}

	/**
	 * Try to start resize if point is over a handle. Returns true if resize started.
	 */
	tryStartResize(wx: number, wy: number): boolean {
		const size = 8;
		for (const h of this.handles) {
			if (
				wx >= h.x - size &&
				wx <= h.x + size &&
				wy >= h.y - size &&
				wy <= h.y + size
			) {
				this.onResizeStart?.(h.name as HandleCorner, wx, wy);
				return true;
			}
		}
		return false;
	}

	/**
	 * Create handles at corners of bounds
	 */
	create(bounds: Bounds): void {
		this.clear();

		const corners: { name: HandleCorner; x: number; y: number }[] = [
			{ name: "nw", x: bounds.x, y: bounds.y },
			{ name: "ne", x: bounds.x + bounds.w, y: bounds.y },
			{ name: "sw", x: bounds.x, y: bounds.y + bounds.h },
			{ name: "se", x: bounds.x + bounds.w, y: bounds.y + bounds.h },
		];

		for (const c of corners) {
			const rect = this.scene.add.rectangle(c.x, c.y, 14, 14, 0xfbbf24);
			rect.setDepth(1000);
			rect.setStrokeStyle(1, 0x000000);
			rect.name = c.name;
			this.handles.push(rect);
		}
	}

	clear(): void {
		for (const h of this.handles) {
			h.destroy();
		}
		this.handles = [];
	}

	destroy(): void {
		this.clear();
		this.onResizeStart = null;
	}
}
