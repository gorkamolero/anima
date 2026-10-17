import type { Raster } from "./ground.js";
import type { NormalField } from "./ground-normals.js";
import {
	measureFloorPlane,
	projectObjectScale,
} from "./ground-object-height.js";

/** Last-resort scale estimate for scenes without an object-height reference.
 * MoGe's predicted metric units are an assumption, not surveyed dimensions. */
export function estimateMetricScale(field: NormalField, floor: Raster) {
	const plane = measureFloorPlane(field, floor);
	if (!plane)
		return { status: "rejected" as const, reason: "no reliable floor plane" };
	const cameraHeight = Math.abs(
		plane.center.reduce((sum, v, i) => sum + v * plane.normal[i], 0),
	);
	if (!(cameraHeight > 0) || plane.residual90 > cameraHeight * 0.05)
		return {
			status: "rejected" as const,
			reason: "floor is not sufficiently planar for metric scale",
		};
	return projectObjectScale(field, floor, plane, 1, 1);
}
