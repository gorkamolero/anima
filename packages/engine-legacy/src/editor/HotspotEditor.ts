import type { Scene } from "phaser";
import type { GroundLineManager } from "../groundline";
import type { Hotspot } from "../hotspots/Hotspot";
import { DragController } from "./DragController";
import { EditorInputHandler } from "./EditorInputHandler";
import { EditorRenderer } from "./EditorRenderer";
import { GroundLineDragController } from "./GroundLineDragController";
import { HandleManager } from "./HandleManager";
import { SelectionManager } from "./SelectionManager";
import type {
	Bounds,
	EditorCallbacks,
	RegisteredEntity,
	Selectable,
	SelectedInfo,
} from "./types";
import { getEntityBounds, getHotspotBounds } from "./types";

// Re-export types for consumers
export type { RegisteredEntity, EditorCallbacks, SelectedInfo };

// Scene registry - allows auto-registration from Character/Hotspot constructors
const sceneEditors = new WeakMap<Scene, HotspotEditor>();

export function getSceneEditor(scene: Scene): HotspotEditor | undefined {
	return sceneEditors.get(scene);
}

export function registerWithEditor(
	scene: Scene,
	id: string,
	name: string,
	sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image,
	color = 0x06b6d4,
): void {
	sceneEditors.get(scene)?.registerEntity(id, name, sprite, color);
}

export function registerHotspotWithEditor(
	scene: Scene,
	hotspot: Hotspot,
): void {
	sceneEditors.get(scene)?.registerHotspot(hotspot);
}

/**
 * Visual editor for hotspots and entities.
 * Coordinates sub-components for rendering, selection, handles, and dragging.
 */
export class HotspotEditor {
	private scene: Scene;
	private enabled = false;
	private hotspots: Hotspot[] = [];
	private entities: RegisteredEntity[] = [];
	private callbacks: EditorCallbacks;

	// Sub-components
	private renderer: EditorRenderer;
	private handles: HandleManager;
	private selection: SelectionManager;
	private drag: DragController;
	private groundLineDrag: GroundLineDragController;
	private inputHandler: EditorInputHandler;

	// Track all suspended entities (to resume when editor closes)
	private suspendedEntities: Set<string> = new Set();

	// Track keyboard listeners for cleanup
	private keyboardListeners: Array<{ event: string; callback: () => void }> = [];

	constructor(scene: Scene, callbacks?: EditorCallbacks) {
		this.scene = scene;
		this.callbacks = callbacks || {};
		sceneEditors.set(scene, this);

		// Initialize sub-components
		this.renderer = new EditorRenderer(scene);
		this.handles = new HandleManager(scene);
		this.selection = new SelectionManager();
		this.drag = new DragController();
		this.groundLineDrag = new GroundLineDragController();

		// Initialize input handler with callbacks
		this.inputHandler = new EditorInputHandler(
			scene,
			this.selection,
			this.handles,
			this.drag,
			this.groundLineDrag,
			{
				onSelect: (sel) => this.select(sel),
				onRedraw: () => this.redraw(),
				onStartResize: (corner, wx, wy) => this.startResize(corner, wx, wy),
				onEntityDragStart: (entityId) => this.suspendEntity(entityId),
			},
		);

		// Wire up callbacks
		this.selection.setSelectCallback((info) => this.callbacks.onSelect?.(info));
		this.handles.setResizeCallback((corner, wx, wy) =>
			this.startResize(corner, wx, wy),
		);

		this.setupKeys();
	}

	// Registration API
	registerHotspot(h: Hotspot): void {
		if (!this.hotspots.includes(h)) this.hotspots.push(h);
		this.inputHandler.setData(this.hotspots, this.entities);
	}

	registerEntity(
		id: string,
		name: string,
		sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image,
		color: number,
	): void {
		this.entities = this.entities.filter((e) => e.id !== id);
		this.entities.push({ id, name, sprite, color });
		this.inputHandler.setData(this.hotspots, this.entities);
	}

	/**
	 * Connect ground line manager for point editing
	 */
	setGroundLineManager(manager: GroundLineManager): void {
		this.groundLineDrag.setManager(manager);
	}

	// Toggle editor on/off
	toggle(): void {
		this.enabled = !this.enabled;
		this.renderer.setVisible(this.enabled);

		// Show/hide ground line
		this.groundLineDrag.getManager()?.setDebugDraw(this.enabled);

		if (this.enabled) {
			this.inputHandler.setupPointerEvents();
			this.redraw();
			console.log(
				"Editor ON | E=toggle S=copyAll C=copySelected A=addPoint Del=removePoint",
			);
		} else {
			this.handles.clear();
			this.renderer.clear();
			this.selection.clear();
			// Resume all suspended entities when editor closes
			const manager = this.groundLineDrag.getManager();
			for (const id of this.suspendedEntities) {
				manager?.resumeCharacter(id);
			}
			this.suspendedEntities.clear();
			console.log("Editor OFF");
		}

		this.callbacks.onToggle?.(this.enabled);
	}

	private setupKeys(): void {
		const kb = this.scene.input.keyboard;
		if (!kb) return;

		const addKey = (key: string, callback: () => void) => {
			const event = `keydown-${key}`;
			kb.on(event, callback);
			this.keyboardListeners.push({ event, callback });
		};

		addKey("E", () => this.toggle());
		addKey("S", () => this.enabled && this.copyAllJSON());
		addKey("C", () => this.enabled && this.selection.current && this.copySelectedJSON());
		// Ground line point shortcuts
		addKey("A", () => this.enabled && this.addGroundLinePoint());
		addKey("DELETE", () => this.enabled && this.removeSelectedGroundLinePoint());
		addKey("BACKSPACE", () => this.enabled && this.removeSelectedGroundLinePoint());
	}

	private suspendEntity(entityId: string): void {
		this.groundLineDrag.getManager()?.suspendCharacter(entityId);
		this.suspendedEntities.add(entityId);
	}

	private startResize(
		corner: "nw" | "ne" | "sw" | "se",
		wx: number,
		wy: number,
	): void {
		const sel = this.selection.current;
		if (!sel) return;

		let bounds: Bounds;
		let scale = 1;

		if (sel.type === "hotspot") {
			bounds = getHotspotBounds(sel.hotspot);
		} else if (sel.type === "entity") {
			bounds = getEntityBounds(sel.entity);
			scale = sel.entity.sprite.scale;
		} else {
			return;
		}

		this.inputHandler.startResize(corner, wx, wy, bounds, scale);
	}

	private select(sel: Selectable | null): void {
		this.selection.select(sel);
		this.redraw();
	}

	private redraw(): void {
		this.handles.clear();
		this.renderer.render(this.hotspots, this.entities, this.selection.current);

		// Create handles for selected item
		const bounds = this.selection.getSelectedBounds(getEntityBounds);
		if (bounds) {
			this.handles.create(bounds);
		}
	}

	private addGroundLinePoint(): void {
		const sel = this.groundLineDrag.addPoint(this.scene);
		if (sel) {
			this.select(sel);
		}
	}

	private removeSelectedGroundLinePoint(): void {
		const sel = this.selection.current;
		if (sel && this.groundLineDrag.removePoint(sel)) {
			this.select(null);
		}
	}

	// JSON copy
	copySelectedJSON(): void {
		const json = this.selection.getSelectedJSON();
		if (json) {
			navigator.clipboard
				.writeText(json)
				.then(() => console.log("Copied:", json));
		}
	}

	copyAllJSON(): void {
		const data: Record<string, unknown> = {
			hotspots: this.hotspots.map((h) => ({
				id: h.id,
				x: h.bounds.x,
				y: h.bounds.y,
				width: h.bounds.width,
				height: h.bounds.height,
			})),
			entities: Object.fromEntries(
				this.entities.map((e) => [
					e.id,
					{
						x: e.sprite.x,
						y: e.sprite.y,
						scale: e.sprite.scale,
					},
				]),
			),
		};

		// Include ground line if present
		const groundLinePoints = this.groundLineDrag.getPointsForExport();
		if (groundLinePoints) {
			data.groundLine = { points: groundLinePoints };
		}

		const json = JSON.stringify(data, null, 2);
		navigator.clipboard
			.writeText(json)
			.then(() => console.log("Copied all:", json));
	}

	// Public API
	isEnabled(): boolean {
		return this.enabled;
	}

	consumedClick(): boolean {
		return this.enabled && this.inputHandler.consumedClick();
	}

	/**
	 * Update callbacks (for late binding from React)
	 */
	setCallbacks(callbacks: EditorCallbacks): void {
		this.callbacks = { ...this.callbacks, ...callbacks };
	}

	destroy(): void {
		// Remove keyboard listeners to prevent memory leaks
		const kb = this.scene.input.keyboard;
		for (const { event, callback } of this.keyboardListeners) {
			kb?.off(event, callback);
		}
		this.keyboardListeners = [];

		sceneEditors.delete(this.scene);
		this.handles.destroy();
		this.renderer.destroy();
	}
}
