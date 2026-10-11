import type { Perspective } from "./perspective";
export interface FloorMask {
	width: number;
	height: number;
	data: number[];
}
export interface WalkArea {
	mask: FloorMask;
	perspective: Perspective;
	baseScale: number;
	scaleClamp: { min: number; max: number };
}
