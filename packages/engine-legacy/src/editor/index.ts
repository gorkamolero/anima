// React panel

// Sub-components (for advanced use cases)
export { DragController } from "./DragController";
export { EditorInputHandler } from "./EditorInputHandler";
export { EditorPanel } from "./EditorPanel";
export { EditorRenderer } from "./EditorRenderer";
export { GroundLineDragController } from "./GroundLineDragController";
export { HandleManager } from "./HandleManager";
// Main editor class and registration functions
export {
	getSceneEditor,
	HotspotEditor,
	registerHotspotWithEditor,
	registerWithEditor,
} from "./HotspotEditor";
export { SelectionManager } from "./SelectionManager";

// Types
export type {
	Bounds,
	DragMode,
	DragState,
	EditorCallbacks,
	HandleCorner,
	RegisteredEntity,
	Selectable,
	SelectedInfo,
} from "./types";

// Utility functions
export { getEntityBounds, getHotspotBounds } from "./types";
