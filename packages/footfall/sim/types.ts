import type { FootCycle, FootPose } from "../core/characters/footLock";
import type { Exit } from "../core/occlusion/exits";
import type { Occluder } from "../core/occlusion/occlusion";
import type { WalkObject } from "../core/walkarea/objectApproach";
import type { FloorMask, WalkArea } from "../core/walkarea/types";
import type { FootAnimation } from "../phaser/CharacterMotor";

export interface WalkBeat {
	name: string;
	start: [number, number];
	click: [number, number];
	object?: string;
	exit?: string;
	expectedDestination?: string;
	coverageFailure?: string;
}
export interface WalkPlan {
	beats: WalkBeat[];
	place?: string;
}
export interface SceneRecord {
	location: string;
	area: WalkArea;
	exits: Exit[];
	objects: (Occluder & { label: string })[];
	interactables: WalkObject[];
	layers: { data: { label: string }; alpha(x: number, y: number): boolean }[];
	visible?: FloorMask;
	connections: { to: string; entry: string; exit: string }[];
	kat?: { x: number; y: number; scale: number; flipX?: boolean };
}
export interface LoggedOccluder {
	id: string;
	depth: number;
	baseline: { x: number; y: number }[];
	bounds: { x: number; y: number; width: number; height: number };
	floorDecal?: boolean;
	sprite?: {
		texture: string;
		cutX: number;
		cutY: number;
		width: number;
		height: number;
		flip: boolean;
	};
}
export interface SimulationOptions {
	scenes: Record<string, { location: string; plan: WalkPlan }>;
	sheets(name: string): FootCycle;
	animation(
		cycle: (name: string) => FootCycle,
		current: () => FootPose,
		show: (pose: FootPose) => void,
	): FootAnimation;
	initialTexture: string;
	loadWalkRecords(location: string): SceneRecord;
	storedOptions(location: string, object: string): unknown;
	save(path: string, value: unknown): void;
	out?: string;
	selected?: string[];
	extraOccluders?(scene: SceneRecord): LoggedOccluder[];
	immediateLocations?: string[];
	Fade: new (camera: {
		emit(): void;
		scene: object;
	}) => {
		isRunning: boolean;
		update(time: number, delta: number): void;
		start(
			direction: boolean,
			duration: number,
			red: number,
			green: number,
			blue: number,
			force: boolean,
		): void;
	};
}
