import type { Scene } from "phaser";
import type { GroundLine } from "./GroundLine";

/**
 * Renders ground line for debug/editor visualization.
 */
export class GroundLineRenderer {
	private graphics: Phaser.GameObjects.Graphics;
	private visible = false;

	constructor(scene: Scene) {
		this.graphics = scene.add.graphics();
		this.graphics.setDepth(850); // Below editor overlay (900)
		this.graphics.setVisible(false);
	}

	setVisible(visible: boolean): void {
		this.visible = visible;
		this.graphics.setVisible(visible);
	}

	isVisible(): boolean {
		return this.visible;
	}

	render(groundLine: GroundLine): void {
		this.graphics.clear();

		if (!this.visible) return;

		const points = groundLine.getPoints();
		if (points.length === 0) return;

		// Draw line segments
		this.graphics.lineStyle(3, 0xff6b6b, 0.8);
		this.graphics.beginPath();
		this.graphics.moveTo(points[0].x, points[0].y);

		for (let i = 1; i < points.length; i++) {
			this.graphics.lineTo(points[i].x, points[i].y);
		}
		this.graphics.strokePath();

		// Draw points
		for (let i = 0; i < points.length; i++) {
			const p = points[i];

			// Outer ring (white)
			this.graphics.fillStyle(0xffffff, 1);
			this.graphics.fillCircle(p.x, p.y, 8);

			// Inner circle (red)
			this.graphics.fillStyle(0xff6b6b, 1);
			this.graphics.fillCircle(p.x, p.y, 5);

			// Black outline
			this.graphics.lineStyle(2, 0x000000, 1);
			this.graphics.strokeCircle(p.x, p.y, 8);
		}
	}

	clear(): void {
		this.graphics.clear();
	}

	destroy(): void {
		this.graphics.destroy();
	}
}
