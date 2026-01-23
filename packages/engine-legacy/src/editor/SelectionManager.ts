import type {
	Bounds,
	RegisteredEntity,
	Selectable,
	SelectedInfo,
} from "./types";

/**
 * Manages selection state and JSON generation for editor.
 */
export class SelectionManager {
	private selected: Selectable | null = null;
	private onSelectCallback: ((info: SelectedInfo | null) => void) | null = null;

	setSelectCallback(cb: (info: SelectedInfo | null) => void): void {
		this.onSelectCallback = cb;
	}

	get current(): Selectable | null {
		return this.selected;
	}

	select(sel: Selectable | null): void {
		this.selected = sel;
		this.notifySelection();
	}

	clear(): void {
		this.selected = null;
		this.onSelectCallback?.(null);
	}

	/**
	 * Get bounds of currently selected item
	 */
	getSelectedBounds(
		getEntityBounds: (e: RegisteredEntity) => Bounds,
	): Bounds | null {
		if (!this.selected) return null;

		if (this.selected.type === "hotspot") {
			const b = this.selected.hotspot.bounds;
			return { x: b.x, y: b.y, w: b.width, h: b.height };
		} else if (this.selected.type === "entity") {
			return getEntityBounds(this.selected.entity);
		}
		// Ground line points don't have bounds for resize handles
		return null;
	}

	private notifySelection(): void {
		if (!this.selected) {
			this.onSelectCallback?.(null);
			return;
		}

		let info: SelectedInfo;

		if (this.selected.type === "hotspot") {
			const h = this.selected.hotspot;
			info = {
				id: h.id,
				name: h.name,
				x: Math.round(h.bounds.x),
				y: Math.round(h.bounds.y),
				width: Math.round(h.bounds.width),
				height: Math.round(h.bounds.height),
				json: JSON.stringify(
					{
						id: h.id,
						x: Math.round(h.bounds.x),
						y: Math.round(h.bounds.y),
						width: Math.round(h.bounds.width),
						height: Math.round(h.bounds.height),
						verbs: h.verbs,
					},
					null,
					2,
				),
			};
		} else if (this.selected.type === "entity") {
			const e = this.selected.entity;
			info = {
				id: e.id,
				name: e.name,
				x: Math.round(e.sprite.x),
				y: Math.round(e.sprite.y),
				width: Math.round(e.sprite.displayWidth),
				height: Math.round(e.sprite.displayHeight),
				scale: Math.round(e.sprite.scale * 1000) / 1000,
				json: JSON.stringify(
					{
						id: e.id,
						x: Math.round(e.sprite.x),
						y: Math.round(e.sprite.y),
						scale: Math.round(e.sprite.scale * 1000) / 1000,
					},
					null,
					2,
				),
			};
		} else {
			// Ground line point
			const { index, x, y } = this.selected;
			info = {
				id: `point-${index}`,
				name: `Ground Line Point ${index}`,
				x: Math.round(x),
				y: Math.round(y),
				width: 0,
				height: 0,
				json: JSON.stringify(
					{ index, x: Math.round(x), y: Math.round(y) },
					null,
					2,
				),
			};
		}

		this.onSelectCallback?.(info);
	}

	/**
	 * Generate JSON for selected item
	 */
	getSelectedJSON(): string | null {
		if (!this.selected) return null;

		if (this.selected.type === "hotspot") {
			const h = this.selected.hotspot;
			return JSON.stringify(
				{
					id: h.id,
					x: h.bounds.x,
					y: h.bounds.y,
					width: h.bounds.width,
					height: h.bounds.height,
				},
				null,
				2,
			);
		} else if (this.selected.type === "entity") {
			const e = this.selected.entity;
			return JSON.stringify(
				{
					id: e.id,
					x: e.sprite.x,
					y: e.sprite.y,
					scale: e.sprite.scale,
				},
				null,
				2,
			);
		} else if (this.selected.type === "groundLinePoint") {
			const { index, x, y } = this.selected;
			return JSON.stringify({ index, x, y }, null, 2);
		}
		return null;
	}
}
