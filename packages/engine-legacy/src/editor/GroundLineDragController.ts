import type { Scene } from "phaser";
import type { GroundLineManager } from "../groundline";
import type { Selectable } from "./types";

/**
 * State for ground line point dragging
 */
interface GroundLineDragState {
	active: boolean;
	pointIndex: number;
	startX: number;
	startY: number;
	originalX: number;
	originalY: number;
}

/**
 * Manages ground line point dragging and operations.
 */
export class GroundLineDragController {
	private manager?: GroundLineManager;
	private state: GroundLineDragState = {
		active: false,
		pointIndex: -1,
		startX: 0,
		startY: 0,
		originalX: 0,
		originalY: 0,
	};

	setManager(manager: GroundLineManager): void {
		this.manager = manager;
	}

	getManager(): GroundLineManager | undefined {
		return this.manager;
	}

	get isActive(): boolean {
		return this.state.active;
	}

	/**
	 * Try to start dragging a ground line point at the given world coordinates.
	 * Returns the selected point info if successful, null otherwise.
	 */
	tryStartDrag(wx: number, wy: number): Selectable | null {
		if (!this.manager) return null;

		const points = this.manager.getPoints();
		const POINT_RADIUS = 12; // Hit area radius

		for (let i = 0; i < points.length; i++) {
			const p = points[i];
			const dist = Math.sqrt((wx - p.x) ** 2 + (wy - p.y) ** 2);
			if (dist <= POINT_RADIUS) {
				this.state = {
					active: true,
					pointIndex: i,
					startX: wx,
					startY: wy,
					originalX: p.x,
					originalY: p.y,
				};
				return { type: "groundLinePoint", index: i, x: p.x, y: p.y };
			}
		}
		return null;
	}

	/**
	 * Apply drag movement to the ground line point
	 */
	applyDrag(wx: number, wy: number): void {
		if (!this.state.active || !this.manager) return;

		const dx = wx - this.state.startX;
		const dy = wy - this.state.startY;
		const newX = this.state.originalX + dx;
		const newY = this.state.originalY + dy;
		this.manager.movePoint(this.state.pointIndex, newX, newY);
	}

	/**
	 * End the current drag operation
	 */
	endDrag(): void {
		this.state.active = false;
	}

	/**
	 * Add a new ground line point at the pointer position.
	 * Returns the selected point info.
	 */
	addPoint(scene: Scene): Selectable | null {
		if (!this.manager) return null;

		const pointer = scene.input.activePointer;
		const cam = scene.cameras.main;
		const wx = pointer.x + cam.scrollX;
		const wy = pointer.y + cam.scrollY;

		const newIndex = this.manager.addPoint(wx, wy);
		const points = this.manager.getPoints();
		const p = points[newIndex];
		console.log(
			`Added ground line point ${newIndex} at (${Math.round(wx)}, ${Math.round(wy)})`,
		);
		return { type: "groundLinePoint", index: newIndex, x: p.x, y: p.y };
	}

	/**
	 * Remove a selected ground line point.
	 * Returns true if the point was removed.
	 */
	removePoint(selected: Selectable): boolean {
		if (
			!this.manager ||
			!selected ||
			selected.type !== "groundLinePoint"
		) {
			return false;
		}

		this.manager.removePoint(selected.index);
		console.log(`Removed ground line point ${selected.index}`);
		return true;
	}

	/**
	 * Get ground line points for JSON export
	 */
	getPointsForExport(): { x: number; y: number }[] | null {
		if (!this.manager?.hasGroundLine()) return null;
		return this.manager.getPoints().map((p) => ({
			x: Math.round(p.x),
			y: Math.round(p.y),
		}));
	}
}
