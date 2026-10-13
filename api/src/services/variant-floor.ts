import { execFileSync } from "node:child_process";
import type { FloorRaster } from "@anima/footfall/derive/exits";
import { imagePath } from "../lib/backgrounds.js";
import { cachedFloor } from "./occluders.js";

/** Reuse only unchanged pixels of an anchor's segmented floor after a scene
 * edit. Changed pixels are removed, so a new object cannot inherit free floor. */
export async function unchangedAnchorFloor(
	image: string,
	anchor: string,
): Promise<FloorRaster | undefined> {
	const floor = await cachedFloor(anchor);
	if (!floor) return undefined;
	const difference = execFileSync(
		"magick",
		[
			imagePath(image),
			"-resize",
			"1920x1080!",
			"(",
			imagePath(anchor),
			"-resize",
			"1920x1080!",
			")",
			"-compose",
			"difference",
			"-composite",
			"-alpha",
			"off",
			"-separate",
			"-evaluate-sequence",
			"max",
			"-threshold",
			"3%",
			"-resize",
			`${floor.width}x${floor.height}!`,
			"-threshold",
			"0",
			"-depth",
			"8",
			"gray:-",
		],
		{ maxBuffer: 8 * 1024 * 1024 },
	);
	if (difference.length !== floor.data.length)
		throw new Error("Variant floor raster mismatch");
	return {
		...floor,
		data: floor.data.map((value, i) => (value && difference[i] === 0 ? 1 : 0)),
	};
}
