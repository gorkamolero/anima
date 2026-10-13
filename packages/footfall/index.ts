export type {
	ContactFrame,
	Foot,
	FootCycle,
	FootPose,
} from "./core/characters/footLock";
export type { WalkDirection } from "./core/characters/walkHeading";
export { headingFromGround } from "./core/characters/walkHeading";
export {
	beginArrival,
	passageArrival,
	resolveReturnExit,
} from "./core/occlusion/arrivals";
export {
	bridgeFloor,
	bridgeOccluders,
	floorPixel,
} from "./core/occlusion/bridge";
export type { Exit } from "./core/occlusion/exits";
export { exitAt, exitAtArrival, exitForFrame } from "./core/occlusion/exits";
export {
	objectFootprints,
	subtractFootprints,
} from "./core/occlusion/footprints";
export type { Occluder } from "./core/occlusion/occlusion";
export {
	baselineYAt,
	depthForOccluder,
	isBehind,
} from "./core/occlusion/occlusion";
export { walkAreaFromAnchor } from "./core/walkarea/anchor";
export {
	cellPoint,
	erode,
	findPath,
	lineOfSight,
	nearestCell,
	nearestReachable,
	refineMask,
} from "./core/walkarea/navigation";
export {
	objectApproach,
	objectFacingPoint,
} from "./core/walkarea/objectApproach";
export { objectAtPoint } from "./core/walkarea/objectHit";
export type { Perspective } from "./core/walkarea/perspective";
export {
	fitFromLine,
	fitLinear,
	fromGround,
	fromMetres,
	scaleAt,
	toGround,
	toMetres,
} from "./core/walkarea/perspective";
export {
	applySceneFootprints,
	sceneExitApproaches,
} from "./core/walkarea/sceneGeometry";
export type { FloorMask, WalkArea } from "./core/walkarea/types";
export type { FootAnimation } from "./phaser/CharacterMotor";
export { CharacterMotor } from "./phaser/CharacterMotor";
