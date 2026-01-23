import type { Scene } from "phaser";
import type { Hotspot } from "../hotspots/Hotspot";
import type { RegisteredEntity, Selectable } from "./types";
import { getEntityBounds } from "./types";

/**
 * Handles all visual rendering for the editor overlay.
 */
export class EditorRenderer {
	private scene: Scene;
	private overlay: Phaser.GameObjects.Graphics;
	private labels: Phaser.GameObjects.Text[] = [];

	constructor(scene: Scene) {
		this.scene = scene;
		this.overlay = scene.add.graphics();
		this.overlay.setDepth(900);
		this.overlay.setVisible(false);
	}

	setVisible(visible: boolean): void {
		this.overlay.setVisible(visible);
	}

	/**
	 * Render everything
	 */
	render(
		hotspots: Hotspot[],
		entities: RegisteredEntity[],
		selected: Selectable | null,
	): void {
		this.clear();

		const g = this.overlay;

		// Dim overlay
		const worldW = this.scene.physics.world.bounds.width || 4000;
		g.fillStyle(0x000000, 0.3);
		g.fillRect(0, -300, worldW, 1680);

		// Hotspots
		for (const h of hotspots) {
			const sel = selected?.type === "hotspot" && selected.hotspot === h;
			this.drawRect(
				h.bounds.x,
				h.bounds.y,
				h.bounds.width,
				h.bounds.height,
				sel ? 0xfbbf24 : 0x22c55e,
				sel,
			);
			this.addLabel(
				h.id,
				h.bounds.x + 2,
				h.bounds.y + 2,
				sel ? "#fbbf24" : "#22c55e",
			);
		}

		// Entities
		for (const e of entities) {
			const sel = selected?.type === "entity" && selected.entity.id === e.id;
			const b = getEntityBounds(e);
			const color = sel ? 0xfbbf24 : e.color;
			this.drawRect(b.x, b.y, b.w, b.h, color, sel);
			this.addLabel(
				e.id,
				b.x + 2,
				b.y + 2,
				sel ? "#fbbf24" : `#${e.color.toString(16).padStart(6, "0")}`,
			);
		}
	}

	private drawRect(
		x: number,
		y: number,
		w: number,
		h: number,
		color: number,
		selected: boolean,
	): void {
		const g = this.overlay;
		g.lineStyle(2, color, 1);
		g.fillStyle(color, selected ? 0.3 : 0.15);
		g.strokeRect(x, y, w, h);
		g.fillRect(x, y, w, h);
	}

	private addLabel(text: string, x: number, y: number, color: string): void {
		const label = this.scene.add
			.text(x, y, text, {
				fontSize: "10px",
				color,
				fontFamily: "monospace",
				backgroundColor: "#000000",
				padding: { x: 2, y: 1 },
			})
			.setDepth(901);
		this.labels.push(label);
	}

	clear(): void {
		for (const l of this.labels) l.destroy();
		this.labels = [];
		this.overlay.clear();
	}

	destroy(): void {
		this.clear();
		this.overlay.destroy();
	}
}
