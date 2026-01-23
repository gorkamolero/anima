import type { Hotspot } from "../hotspots/Hotspot";

// Core types
export interface RegisteredEntity {
	id: string;
	name: string;
	sprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Image;
	color: number;
}

export interface Bounds {
	x: number;
	y: number;
	w: number;
	h: number;
}

// Selection types
export type Selectable =
	| { type: "hotspot"; hotspot: Hotspot }
	| { type: "entity"; entity: RegisteredEntity }
	| { type: "groundLinePoint"; index: number; x: number; y: number };

export interface SelectedInfo {
	id: string;
	name: string;
	x: number;
	y: number;
	width: number;
	height: number;
	scale?: number;
	json: string;
}

// Callbacks
export interface EditorCallbacks {
	onToggle?: (enabled: boolean) => void;
	onSelect?: (selected: SelectedInfo | null) => void;
}

// Drag state
export type DragMode = "move" | "resize" | null;
export type HandleCorner = "nw" | "ne" | "sw" | "se";

export interface DragState {
	mode: DragMode;
	handle: HandleCorner | null;
	startX: number;
	startY: number;
	originalBounds: Bounds;
	originalScale: number;
}

// Utility
export function getEntityBounds(e: RegisteredEntity): Bounds {
	const s = e.sprite;
	return {
		x: s.x - s.displayWidth * s.originX,
		y: s.y - s.displayHeight * s.originY,
		w: s.displayWidth,
		h: s.displayHeight,
	};
}

export function getHotspotBounds(h: Hotspot): Bounds {
	return {
		x: h.bounds.x,
		y: h.bounds.y,
		w: h.bounds.width,
		h: h.bounds.height,
	};
}
