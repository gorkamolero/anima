import type { StoryVerb } from "@anima/storyscript";

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
		background: "bus-station-kat-seated",
		groundLine: {
			interpolation: "catmull-rom",
			// scaleFactors derived from bus-station-kat-seated-composite-v1.landmarks.json
			// (horizon perspective model, Kat anchor, figureCalibration 0.8) —
			// verified by `pnpm verify:art`; regenerate there if the art changes
			points: [
				{ x: 120, y: 950, scaleFactor: 0.913 },
				{ x: 520, y: 966, scaleFactor: 0.943 },
				{ x: 755, y: 976, scaleFactor: 0.963 },
				{ x: 1040, y: 966, scaleFactor: 0.943 },
				{ x: 1520, y: 950, scaleFactor: 0.913 },
				{ x: 1800, y: 942, scaleFactor: 0.898 },
			],
			clampToBounds: true,
		},
		freeWalkBounds: {
			minX: 200,
			maxX: 1520,
			minY: 760,
			maxY: 950,
		},
		freeWalkRanges: [
			{ minX: 200, maxX: 760 },
			{ minX: 1280, maxX: 1520 },
		],
		characters: {
			hermes: { x: 360, y: 950, scale: 0.5, visible: true, state: "idle" },
			kat: {
				x: 1040,
				y: 880,
				scale: 0.42,
				visible: false,
				state: "seatedIdle",
				states: {
					seatedIdle: {
						x: 1040,
						y: 880,
						scale: 0.42,
						visible: false,
						flipX: true,
					},
					seatedTalk: {
						x: 1040,
						y: 880,
						scale: 0.42,
						visible: false,
						flipX: true,
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
				bounds: { x: 1640, y: 488, width: 280, height: 250 },
				approach: { x: 1540, y: 895 },
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
							{ x: 1540, y: 918 },
							{ x: 1660, y: 946 },
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
				bounds: { x: 820, y: 430, width: 430, height: 300 },
				approach: { x: 760, y: 893 },
				actions: {
					LOOK: {
						lines: [
							"Kat sits under the shelter, headphones on, arms folded.",
							"Her backpack rests against the bench like she may leave any second.",
						],
					},
					TALK: {
						route: [{ x: 755, y: 976 }],
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
				bounds: { x: 1455, y: 330, width: 205, height: 320 },
				approach: { x: 1800, y: 900 },
				actions: {
					LOOK: {
						lines: [
							"The station door is tucked past the bus, half-hidden by the vehicle's nose.",
							"To reach it, Hermes would have to slip around the right side.",
						],
					},
					USE: {
						// Around, behind, and INTO THE HOUSE: along the dock in front
						// of the vehicles (he covers them - y-sorted depth), hooks up
						// at the bus's right edge (crossing VEHICLE_GROUND_Y flips him
						// behind), then climbs the depth toward the porch - emerging
						// in the gap left of the car's nose at house-door scale - and
						// enters the door. The house-door landmark is the character's
						// scale reference at the end of this path: all scaleFactors
						// follow the landmarks perspective model factor(y) =
						// 0.0019284 * (y - 470), which puts him at ~178px beside the
						// 213px door.
						offGroundLine: true,
						route: [
							{ x: 1500, y: 946, scaleFactor: 0.918 },
							{ x: 1885, y: 938, scaleFactor: 0.902 },
							{ x: 1900, y: 908, scaleFactor: 0.845 },
							// Fully hidden behind the bus only for this hop - hurried
							// (speedFactor) so the disappearance never reads as a stall.
							{ x: 1790, y: 850, scaleFactor: 0.733, speedFactor: 2.0 },
							// From here his head and shoulders ride above the car while
							// he climbs - visibly walking the whole way to the porch.
							{ x: 1650, y: 745, scaleFactor: 0.53, speedFactor: 1.3 },
							{ x: 1560, y: 668, scaleFactor: 0.382 },
							{ x: 1458, y: 632, scaleFactor: 0.312 },
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
							"Hermes slips behind the bus and disappears through the station door.",
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
