import type { Perspective } from "./perspective";
export interface FloorMask {
	width: number;
	height: number;
	data: number[];
}
export interface WalkArea {
	/** Physical body clearance; routing may additionally reject raster slivers. */
	clearanceMask?: FloorMask;
	/** Physical object support pixels, before character clearance dilation. */
	objectFootprints?: FloorMask;
	mask: FloorMask;
	/** Un-eroded floor for physical boot contacts; mask is used for routing. */
	rawMask?: FloorMask;
	perspective: Perspective;
	baseScale: number;
	scaleClamp: { min: number; max: number };
}
