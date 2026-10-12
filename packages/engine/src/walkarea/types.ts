import type { Perspective } from "./perspective";
export interface FloorMask {
	width: number;
	height: number;
	data: number[];
}
export interface WalkArea {
	/** Physical object support pixels, before character clearance dilation. */
	objectFootprints?: FloorMask;
	mask: FloorMask;
	/** Un-eroded floor for physical boot contacts; mask remains body clearance. */
	rawMask?: FloorMask;
	perspective: Perspective;
	baseScale: number;
	scaleClamp: { min: number; max: number };
}
