import type { StoryVerb } from "@anima/storyscript";
import exteriorGround from "../../../public/backgrounds/bus-station-flat-v1.ground.json";

export type ReviewSceneId = "outside" | "inside";
export type ReviewCharacterId = "hermes" | "kat";
export type SceneCharacterState =
	| "idle"
	| "walk"
	| "talk"
	| "seatedIdle"
	| "seatedTalk";

export interface ScenePoint {
	x: number;
	y: number;
	scaleFactor?: number;
	/**
	 * Walk-speed multiplier for the path segment ENDING at this point.
	 * Used to hurry fully-occluded stretches so the character never
	 * disappears long enough to read as a stall.
	 */
	speedFactor?: number;
}

export interface SceneCharacterPlacement extends ScenePoint {
	scale: number;
	visible?: boolean;
	flipX?: boolean;
	state?: SceneCharacterState;
	states?: Partial<
		Record<
			SceneCharacterState,
			Partial<Omit<SceneCharacterPlacement, "states">>
		>
	>;
}

export interface SceneGroundLine {
	points: ScenePoint[];
	interpolation?: "linear" | "catmull-rom";
	perspectiveScale?: {
		foregroundY: number;
		backgroundY: number;
		minScale: number;
	};
	clampToBounds?: boolean;
}

export interface ReviewAction {
	lines: string[];
	moveTo?: ScenePoint;
	route?: ScenePoint[];
	exitTo?: ScenePoint;
	hideOnExit?: boolean;
	/**
	 * Walk the route off the groundline: each point's y and scaleFactor are
	 * honored (tweened), letting a scripted path go deeper into the scene —
	 * e.g. around and behind the vehicle overlay. Input is blocked while
	 * the path plays.
	 */
	offGroundLine?: boolean;
	transitionTo?: ReviewSceneId;
	spawn?: Partial<Record<ReviewCharacterId, SceneCharacterPlacement>>;
	talkingCharacter?: ReviewCharacterId;
	talkingState?: SceneCharacterState;
}

export interface ReviewHotspot {
	id: string;
	name: string;
	bounds?: ScenePoint & {
		width: number;
		height: number;
	};
	approach?: ScenePoint;
	actions: Partial<Record<StoryVerb, ReviewAction>>;
}

export interface ReviewScene {
	id: ReviewSceneId;
	title: string;
	description: string;
	background: string;
	groundLine: SceneGroundLine;
	freeWalkBounds?: {
		minX: number;
		maxX: number;
		minY?: number;
		maxY?: number;
	};
	freeWalkRanges?: Array<{
		minX: number;
		maxX: number;
	}>;
	output: string[];
	characters: Partial<Record<ReviewCharacterId, SceneCharacterPlacement>>;
	hotspots: ReviewHotspot[];
}

export const REVIEW_SCENES: Record<ReviewSceneId, ReviewScene> = {
	outside: {
		id: "outside",
		title: "Innsmouth Bus Terminal - Exterior",
		description:
			"A salt-weathered bus depot stands on a timber harbor platform at sunset, with Kat seated beneath a rope-hung shelter, fishing boats on the water, and an old bus waiting beside the doors.",
		background: "bus-station-flat",
		groundLine: { ...exteriorGround.groundLine, interpolation: "linear" },
		freeWalkBounds: {
			minX: 0,
			maxX: 1920,
			minY: 0,
			maxY: 1080,
		},
		// Segmented floor and object supports now supply the exclusions.
		freeWalkRanges: [{ minX: 0, maxX: 1920 }],
		characters: {
			hermes: { x: 360, y: 950, scale: 0.5, visible: true, state: "idle" },
			kat: {
				x: 920,
				y: 924.479068303431,
				scale: 0.3753016472563215,
				visible: true,
				state: "seatedIdle",
				states: {
					seatedIdle: {
						x: 920,
						y: 924.479068303431,
						scale: 0.3753016472563215,
						visible: true,
						flipX: false,
					},
					seatedTalk: {
						x: 920,
						y: 924.479068303431,
						scale: 0.3753016472563215,
						visible: true,
						flipX: false,
					},
				},
			},
		},
		output: [
			"Salt fog rolls across the platform.",
			"The Innsmouth bus idles by the curb, rust ticking in its frame.",
			"The depot doors leak warm yellow light into the morning haze.",
		],
		hotspots: [
			{
				id: "bus",
				name: "Innsmouth Bus",
				bounds: { x: 1495, y: 492, width: 425, height: 361 },
				approach: { x: 1480, y: 905 },
				actions: {
					LOOK: {
						lines: [
							"The bus is older than the others. Dirtier.",
							"The driver watches from behind the windshield and does not blink.",
						],
					},
					USE: {
						// On the dock he walks IN FRONT of the vehicles (y-sorted
						// depth), so approaching the bus keeps him fully visible.
						route: [
							{ x: 1450, y: 930 },
							{ x: 1600, y: 925 },
						],
						lines: [
							"Hermes crosses toward the idling bus.",
							"The engine coughs behind the station wall.",
						],
					},
				},
			},
			{
				id: "waiting_bench",
				name: "Waiting Bench",
				bounds: { x: 753, y: 698, width: 312, height: 186 },
				approach: { x: 880, y: 990 },
				actions: {
					LOOK: {
						lines: [
							"Kat sits under the shelter, headphones on, arms folded.",
							"Her backpack rests against the bench like she may leave any second.",
						],
					},
					TALK: {
						route: [{ x: 880, y: 990 }],
						talkingCharacter: "kat",
						talkingState: "seatedTalk",
						lines: [
							"Kat looks up only after Hermes says her name twice.",
							"The sea wind almost swallows her answer.",
						],
					},
				},
			},
			{
				id: "depot_doors",
				name: "Depot Doors",
				bounds: { x: 1329, y: 465, width: 105, height: 225 },
				approach: { x: 1380, y: 750 },
				actions: {
					LOOK: {
						lines: [
							"The station door stands above a shallow wooden step.",
							"Warm light leaks through the weathered frame.",
						],
					},
					USE: {
						route: [
							{ x: 1380, y: 790 },
							{ x: 1380, y: 750 },
						],
						hideOnExit: true,
						transitionTo: "inside",
						spawn: {
							hermes: {
								x: 1760,
								y: 916,
								scale: 0.43,
								visible: true,
								flipX: true,
							},
							kat: {
								x: 1110,
								y: 890,
								scale: 0.47,
								visible: false,
								state: "seatedIdle",
							},
						},
						lines: [
							"Hermes crosses the platform and enters through the station door.",
							"Inside, stale warmth replaces the salt wind.",
						],
					},
				},
			},
		],
	},
	inside: {
		id: "inside",
		title: "Arkham Bus Depot - Interior",
		description:
			"The worn depot interior holds a ticket window, empty benches, a departure board, and a humming vending machine beneath tired fluorescent lights.",
		background: "arkham-depot-interior-clean",
		freeWalkBounds: { minX: 0, maxX: 1920, minY: 0, maxY: 1080 },
		groundLine: {
			interpolation: "catmull-rom",
			points: [
				{ x: 150, y: 914, scaleFactor: 0.98 },
				{ x: 460, y: 902, scaleFactor: 0.965 },
				{ x: 780, y: 890, scaleFactor: 0.94 },
				{ x: 1180, y: 890, scaleFactor: 0.94 },
				{ x: 1510, y: 904, scaleFactor: 0.968 },
				{ x: 1760, y: 916, scaleFactor: 0.985 },
			],
			clampToBounds: true,
		},
		characters: {
			hermes: { x: 460, y: 902, scale: 0.43, visible: true },
			kat: {
				x: 1110,
				y: 890,
				scale: 0.47,
				visible: false,
				state: "seatedIdle",
				states: {
					seatedIdle: { x: 1110, y: 890, scale: 0.47, visible: false },
					seatedTalk: { x: 1110, y: 890, scale: 0.47, visible: false },
				},
			},
		},
		output: [
			"A small-town bus depot. Diesel and stale coffee.",
			"Fluorescent lights hum and flicker.",
			"The waiting bench is empty; Kat is still outside under the shelter.",
		],
		hotspots: [
			{
				id: "ticket_window",
				name: "Ticket Window",
				// bounds = ticket-booth region in arkham-bus-depot-flat-2d.landmarks.json
				bounds: { x: 456, y: 336, width: 408, height: 456 },
				approach: { x: 480, y: 901 },
				actions: {
					LOOK: {
						lines: [
							"Scratched plexiglass. A faded schedule.",
							"Someone scratched DONT GO into the counter.",
						],
					},
					TALK: {
						moveTo: { x: 480, y: 901 },
						lines: [
							'The clerk says, "Innsmouth?"',
							"He pushes the ticket across like it might bite him.",
						],
					},
				},
			},
			{
				id: "waiting_bench",
				name: "Waiting Bench",
				// bounds = bench region in arkham-bus-depot-flat-2d.landmarks.json
				bounds: { x: 906, y: 600, width: 576, height: 240 },
				approach: { x: 780, y: 890 },
				actions: {
					LOOK: {
						lines: [
							"The bench is empty now.",
							"Outside, Kat is still under the shelter with her headphones on.",
						],
					},
				},
			},
			{
				id: "schedule_board",
				name: "Schedule Board",
				// bounds = departures-board region in arkham-bus-depot-flat-2d.landmarks.json
				bounds: { x: 444, y: 48, width: 396, height: 264 },
				approach: { x: 740, y: 892 },
				actions: {
					LOOK: {
						lines: [
							"BOSTON - 8:00 AM, 12:00 PM, 4:00 PM, 8:00 PM",
							"INNSMOUTH - 10:00 AM, 6:00 PM",
							"Hermes thinks: Only two buses a day.",
						],
					},
				},
			},
			{
				id: "bus_platform",
				name: "Bus Platform",
				// bounds = platform-doorway region in arkham-bus-depot-flat-2d.landmarks.json
				bounds: { x: 1446, y: 252, width: 390, height: 636 },
				approach: { x: 1180, y: 890 },
				actions: {
					LOOK: {
						lines: [
							"The bus waits outside under a gauze of steam and fog.",
							"The road beyond it bends north toward Innsmouth.",
						],
					},
					USE: {
						moveTo: { x: 1420, y: 900 },
						transitionTo: "outside",
						spawn: {
							hermes: { x: 970, y: 880, scale: 0.5, visible: true },
						},
						lines: [
							"Hermes grips his satchel strap and heads for the platform.",
						],
					},
				},
			},
		],
	},
};

export function getReviewAction(
	scene: ReviewScene,
	hotspotId: string,
	verb: StoryVerb,
) {
	return scene.hotspots.find((hotspot) => hotspot.id === hotspotId)?.actions[
		verb
	];
}
