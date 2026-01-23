import type { Scene } from "phaser";
import type { Hotspot } from "../hotspots/Hotspot";
import type { DragController } from "./DragController";
import type { GroundLineDragController } from "./GroundLineDragController";
import type { HandleManager } from "./HandleManager";
import type { SelectionManager } from "./SelectionManager";
import type { Bounds, RegisteredEntity, Selectable } from "./types";
import { getEntityBounds, getHotspotBounds } from "./types";

/**
 * Callbacks for input handler events
 */
export interface InputHandlerCallbacks {
	onSelect: (sel: Selectable | null) => void;
	onRedraw: () => void;
	onStartResize: (corner: "nw" | "ne" | "sw" | "se", wx: number, wy: number) => void;
	onEntityDragStart: (entityId: string) => void;
}

/**
 * Handles pointer and keyboard input for the editor.
 */
export class EditorInputHandler {
	private scene: Scene;
	private selection: SelectionManager;
	private handles: HandleManager;
	private drag: DragController;
	private groundLineDrag: GroundLineDragController;
	private callbacks: InputHandlerCallbacks;

	private _clickConsumed = false;

	// Data references (set by HotspotEditor)
	private hotspots: Hotspot[] = [];
	private entities: RegisteredEntity[] = [];

	constructor(
		scene: Scene,
		selection: SelectionManager,
		handles: HandleManager,
		drag: DragController,
		groundLineDrag: GroundLineDragController,
		callbacks: InputHandlerCallbacks,
	) {
		this.scene = scene;
		this.selection = selection;
		this.handles = handles;
		this.drag = drag;
		this.groundLineDrag = groundLineDrag;
		this.callbacks = callbacks;
	}

	/**
	 * Update references to hotspots and entities
	 */
	setData(hotspots: Hotspot[], entities: RegisteredEntity[]): void {
		this.hotspots = hotspots;
		this.entities = entities;
	}

	/**
	 * Check if the last click was consumed by the editor
	 */
	consumedClick(): boolean {
		return this._clickConsumed;
	}

	/**
	 * Set up pointer event listeners
	 */
	setupPointerEvents(): void {
		this.scene.input.off("pointerdown", this.onPointerDown, this);
		this.scene.input.off("pointermove", this.onPointerMove, this);
		this.scene.input.off("pointerup", this.onPointerUp, this);

		this.scene.input.on("pointerdown", this.onPointerDown, this);
		this.scene.input.on("pointermove", this.onPointerMove, this);
		this.scene.input.on("pointerup", this.onPointerUp, this);
	}

	private onPointerDown = (pointer: Phaser.Input.Pointer): void => {
		this._clickConsumed = false;

		const cam = this.scene.cameras.main;
		const wx = pointer.x + cam.scrollX;
		const wy = pointer.y + cam.scrollY;

		// 1. HANDLES FIRST - if clicking a handle, start resize (not move!)
		if (this.selection.current && this.handles.tryStartResize(wx, wy)) {
			this._clickConsumed = true;
			return;
		}

		// 2. Ground line points (small circles, check first)
		const groundLinePoint = this.groundLineDrag.tryStartDrag(wx, wy);
		if (groundLinePoint) {
			this.callbacks.onSelect(groundLinePoint);
			this._clickConsumed = true;
			return;
		}

		// 3. Entities
		for (const e of this.entities) {
			const b = getEntityBounds(e);
			if (wx >= b.x && wx <= b.x + b.w && wy >= b.y && wy <= b.y + b.h) {
				this.callbacks.onSelect({ type: "entity", entity: e });
				this.drag.startMove(wx, wy, b);
				this.callbacks.onEntityDragStart(e.id);
				this._clickConsumed = true;
				return;
			}
		}

		// 4. Hotspots
		for (const h of this.hotspots) {
			if (h.bounds.contains(wx, wy)) {
				this.callbacks.onSelect({ type: "hotspot", hotspot: h });
				const b = getHotspotBounds(h);
				this.drag.startMove(wx, wy, b);
				this._clickConsumed = true;
				return;
			}
		}

		// Clicked nothing
		this.callbacks.onSelect(null);
		this._clickConsumed = true;
	};

	private onPointerMove = (pointer: Phaser.Input.Pointer): void => {
		const cam = this.scene.cameras.main;
		const wx = pointer.x + cam.scrollX;
		const wy = pointer.y + cam.scrollY;

		// Handle ground line point drag
		if (this.groundLineDrag.isActive) {
			this.groundLineDrag.applyDrag(wx, wy);
			return;
		}

		// Handle entity/hotspot drag
		if (!this.drag.isActive || !this.selection.current) return;
		this.drag.apply(wx, wy, this.selection.current);
		this.callbacks.onRedraw();
	};

	private onPointerUp = (): void => {
		this.groundLineDrag.endDrag();
		this.drag.end();

		// Re-notify selection with updated position
		if (this.selection.current) {
			this.selection.select(this.selection.current);
		}
	};

	/**
	 * Start resize operation for the currently selected item
	 */
	startResize(
		corner: "nw" | "ne" | "sw" | "se",
		wx: number,
		wy: number,
		bounds: Bounds,
		scale: number,
	): void {
		this.drag.startResize(corner, wx, wy, bounds, scale);
	}
}
