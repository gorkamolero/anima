import type {
	Bounds,
	DragMode,
	DragState,
	HandleCorner,
	Selectable,
} from "./types";

/**
 * Controls drag operations (move and resize) for editor items.
 */
export class DragController {
	private state: DragState = {
		mode: null,
		handle: null,
		startX: 0,
		startY: 0,
		originalBounds: { x: 0, y: 0, w: 0, h: 0 },
		originalScale: 1,
	};

	get isActive(): boolean {
		return this.state.mode !== null;
	}

	get mode(): DragMode {
		return this.state.mode;
	}

	/**
	 * Start a move operation
	 */
	startMove(wx: number, wy: number, bounds: Bounds): void {
		this.state = {
			mode: "move",
			handle: null,
			startX: wx,
			startY: wy,
			originalBounds: { ...bounds },
			originalScale: 1,
		};
	}

	/**
	 * Start a resize operation
	 */
	startResize(
		corner: HandleCorner,
		wx: number,
		wy: number,
		bounds: Bounds,
		scale: number,
	): void {
		this.state = {
			mode: "resize",
			handle: corner,
			startX: wx,
			startY: wy,
			originalBounds: { ...bounds },
			originalScale: scale,
		};
	}

	/**
	 * End the current drag operation
	 */
	end(): void {
		this.state.mode = null;
		this.state.handle = null;
	}

	/**
	 * Apply drag delta to the selected item
	 */
	apply(wx: number, wy: number, selected: Selectable): void {
		if (!this.state.mode) return;

		const dx = wx - this.state.startX;
		const dy = wy - this.state.startY;

		if (this.state.mode === "move") {
			this.applyMove(dx, dy, selected);
		} else if (this.state.mode === "resize") {
			this.applyResize(dx, dy, selected);
		}
	}

	private applyMove(dx: number, dy: number, selected: Selectable): void {
		const o = this.state.originalBounds;

		if (selected.type === "hotspot") {
			const b = selected.hotspot.bounds;
			b.x = Math.round(o.x + dx);
			b.y = Math.round(o.y + dy);
			selected.hotspot.syncSprite();
		} else if (selected.type === "entity") {
			const e = selected.entity;
			const s = e.sprite;
			// Calculate new position accounting for sprite origin
			const newX = o.x + o.w * s.originX + dx;
			const newY = o.y + o.h * s.originY + dy;
			s.x = Math.round(newX);
			s.y = Math.round(newY);
		}
	}

	private applyResize(dx: number, dy: number, selected: Selectable): void {
		if (!this.state.handle) return;
		const o = this.state.originalBounds;
		const h = this.state.handle;

		if (selected.type === "hotspot") {
			const b = selected.hotspot.bounds;

			// Horizontal resize
			if (h.includes("w")) {
				b.x = Math.round(o.x + dx);
				b.width = Math.max(20, Math.round(o.w - dx));
			} else {
				b.width = Math.max(20, Math.round(o.w + dx));
			}

			// Vertical resize
			if (h.includes("n")) {
				b.y = Math.round(o.y + dy);
				b.height = Math.max(20, Math.round(o.h - dy));
			} else {
				b.height = Math.max(20, Math.round(o.h + dy));
			}

			selected.hotspot.syncSprite();
		} else if (selected.type === "entity") {
			// Entities resize by scaling based on height change
			const heightDelta = h.includes("n") ? -dy : dy;
			const newHeight = Math.max(10, o.h + heightDelta);
			const newScale = (newHeight / o.h) * this.state.originalScale;
			selected.entity.sprite.setScale(Math.max(0.01, newScale));
		}
	}
}
