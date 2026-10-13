export type {
	ContactFrame,
	Foot,
	FootCycle,
	FootPose,
} from "./characters/footLock";
export { planFootsteps } from "./characters/footstepPlan";
export type { WalkDirection } from "./characters/walkHeading";
export { headingFromGround } from "./characters/walkHeading";
export { GroundLine } from "./groundline/GroundLine";
export type { GroundLineConfig } from "./groundline/types";
export {
	beginArrival,
	passageArrival,
	resolveReturnExit,
} from "./occlusion/arrivals";
export {
	bridgeFloor,
	bridgeOccluders,
	floorPixel,
} from "./occlusion/bridge";
export type { Exit } from "./occlusion/exits";
export { exitAt, exitAtArrival, exitForFrame } from "./occlusion/exits";
export {
	objectFootprints,
	subtractFootprints,
} from "./occlusion/footprints";
export type { Occluder } from "./occlusion/occlusion";
export {
	baselineYAt,
	depthForOccluder,
	isBehind,
} from "./occlusion/occlusion";
export { walkAreaFromAnchor } from "./walkarea/anchor";
export {
	cellPoint,
	erode,
	findPath,
	lineOfSight,
	nearestCell,
	nearestReachable,
	refineMask,
} from "./walkarea/navigation";
export {
	objectApproach,
	objectFacingPoint,
} from "./walkarea/objectApproach";
export { objectAtPoint } from "./walkarea/objectHit";
export type { Perspective } from "./walkarea/perspective";
export {
	fitFromLine,
	fitLinear,
	fromGround,
	fromMetres,
	scaleAt,
	toGround,
	toMetres,
} from "./walkarea/perspective";
export { depthRegions } from "./walkarea/regions";
export {
	applySceneFootprints,
	sceneExitApproaches,
} from "./walkarea/sceneGeometry";
export type { FloorMask, WalkArea } from "./walkarea/types";
