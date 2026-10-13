import type { Exit } from "../core/occlusion/exits";
import type { Perspective } from "../core/walkarea/perspective";
import type { FloorMask } from "../core/walkarea/types";
import type { DerivedOccluder, GroundData } from "./types";

export type * from "./types";
/** Providers own image access, segmentation, depth, caches and credentials. */
export interface DerivationProvider {
	deriveGround(
		image: string,
		template: "exterior" | "interior",
		fraction?: number,
		description?: string,
		key?: string,
	): Promise<GroundData>;
	deriveOccluders(
		image: string,
		ground?: {
			floor: FloorMask;
			horizonY?: number;
			scaleSlope?: number;
			walkArea?: { perspective: Perspective };
			template?: "interior" | "exterior";
		},
	): Promise<{ occluders: DerivedOccluder[]; exits: Exit[] }>;
}
