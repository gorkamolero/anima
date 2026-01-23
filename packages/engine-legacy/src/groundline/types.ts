/**
 * A single point on the ground line path
 */
export interface GroundLinePoint {
	x: number;
	y: number;
}

/**
 * Configuration for ground line in scene config
 */
export interface GroundLineConfig {
	/** Array of points defining the walking path (sorted left to right) */
	points: GroundLinePoint[];
	/** Enable perspective scaling based on Y position */
	perspectiveScale?: {
		/** Y position where scale = 1.0 (foreground, typically higher Y) */
		foregroundY: number;
		/** Y position where scale = minScale (background, typically lower Y) */
		backgroundY: number;
		/** Minimum scale at background (e.g., 0.7 = 70% size) */
		minScale: number;
	};
	/** Clamp X movement to ground line bounds (default: true) */
	clampToBounds?: boolean;
}

/**
 * Callback from ground line manager to character.
 * Called with current X position, returns Y and optional scale.
 */
export type PositionUpdateCallback = (x: number) => {
	y: number;
	scale?: number;
};

/**
 * Ground line change events for editor/persistence
 */
export interface GroundLineCallbacks {
	onPointAdded?: (point: GroundLinePoint, index: number) => void;
	onPointMoved?: (index: number, newPos: GroundLinePoint) => void;
	onPointRemoved?: (index: number) => void;
	onGroundLineChanged?: (points: GroundLinePoint[]) => void;
}
