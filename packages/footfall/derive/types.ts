import type { Occluder } from "../core/occlusion/occlusion";
import type { WalkArea } from "../core/walkarea/types";
export interface ScaleReference {
	label: string;
	rect: { x: number; y: number; width: number; height: number };
	realHeightM: number;
}
export interface Raster {
	width: number;
	height: number;
	data: number[];
}
export interface GroundData {
	scaleReference?: ScaleReference;
	walkArea?: WalkArea;
	groundLine: {
		points: Array<{ x: number; y: number; scaleFactor: number }>;
		interpolation: "linear";
		clampToBounds: boolean;
	};
	freeWalkBounds: { minX: number; maxX: number; minY: number; maxY: number };
	freeWalkRanges: Array<{ minX: number; maxX: number }>;
	floor: Raster;
	horizonY: number;
	scaleSlope: number;
	baseScale: number;
	ground: "derived" | "inherited" | "failed";
	reason?: string;
	walkable?: boolean;
	travelEnabled?: boolean;
	regions?: GroundRegion[];
	overlays?: string[];
	derivationVersion?: number;
	verdicts: GroundVerdict[];
	notes?: string[];
}
export interface GroundVerdict {
	pass: boolean;
	why: string;
	question?: string;
	answer?: string;
	reason?: string;
	overlay?: string;
	attempt?: string;
	probabilities?: Record<string, number>;
	questions?: FloorQuestions;
	rejected?: string[];
	hazardBounds?: number[][];
}
/** Regions use game coordinates (1920x1080). Intersect polygon AND mask.
 * scaleAtY is piecewise linear, clamped at endpoints; factors multiply baseScale.
 * Regions override the global perspective only inside their visible mask. */
export interface GroundRegion {
	id: string;
	kind: "floor" | "stairs";
	polygon: Array<{ x: number; y: number }>;
	mask: Raster;
	scaleAtY: Array<{ y: number; scaleFactor: number }>;
	interpolation: "linear";
	source: "relative-depth";
}
export interface FloorObject {
	name: string;
	bounds: number[];
}
export interface FloorQuestion {
	type: "noul" | "score";
	instructions: string;
	criteria: Record<string, string> | string[];
	bounds?: number[];
	advisory?: boolean;
}
export type FloorQuestions = Record<string, FloorQuestion>;
export interface DerivedOccluder extends Occluder {
	maskCoverage?: {
		referencePixels: number;
		retainedPixels: number;
		fraction: number;
	};
}
