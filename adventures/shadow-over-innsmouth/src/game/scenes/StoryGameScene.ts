import {
	BaseScene,
	Character,
	type CharacterAnimationState,
	type CharacterAnimConfig,
	type HotspotVerb,
	type SceneConfig,
} from "@anima/engine";
import {
	applySceneFootprints,
	beginArrival,
	CharacterMotor,
	type Exit,
	exitAt,
	exitForFrame,
	type FootCycle,
	findWalkPath,
	floorPixel,
	type Occluder,
	objectApproach,
	objectAtPoint,
	objectFacingPoint,
	renderDepthForOccluder,
	resolveReturnExit,
	roundCorners,
	sceneExitApproaches,
	type WalkArea,
	type WalkDirection,
} from "@anima/footfall";
import {
	interiorSpawn,
	sceneFloor,
} from "@anima/footfall/core/walkarea/sceneFloor";
import {
	type FloorMask,
	narrativeDeparture as findNarrativeDeparture,
} from "@anima/footfall/core/walkarea/worldGeometry";
import { refreshPlacementDebugOverlay } from "@anima/footfall/phaser/debugOverlay";
import {
	createOccluderLayers,
	loadOccluderImages,
} from "@anima/footfall/phaser/occluderLayers";
import { spriteFootBinding } from "@anima/footfall/phaser/spriteFootBinding";
import {
	parseStoryScript,
	StoryRuntime,
	type StoryRuntimeSnapshot,
	type StoryVerb,
	validateStoryGraph,
} from "@anima/storyscript";
import exteriorGround from "../../../public/backgrounds/bus-station-flat-v1.ground.json";
import act1Story from "../../../story/act1.story?raw";
import fullGameStory from "../../../story/full_game.story?raw";
import { type DialogueState, speakerColours } from "../../dialogue";
import { commitSceneRoute, readSceneRoute } from "../../sceneRoute";
import { act1Hotspots } from "../act1Hotspots";
import { HERMES_WALK, HERMES_WALK_SHEETS } from "../hermesWalk";
import { isAudioMuted, speakCaption } from "../narratorVoice";
import { StoryDialogue } from "../storyDialogue";
import { hermesFootAnimation } from "./hermesFootAnimation";
import { hermesStanding } from "./hermesStanding";
import {
	getReviewAction,
	REVIEW_SCENES,
	type ReviewCharacterId,
	type ReviewHotspot,
	type ReviewScene,
	type ReviewSceneId,
	type SceneCharacterPlacement,
	type SceneCharacterState,
	type ScenePoint,
} from "./standaloneScenes";

const SAVE_KEY = "anima.shadow-over-innsmouth.save";
const SESSION_KEY = "anima.shadow-over-innsmouth.session";
const WALKING_PREVIEW = import.meta.env.VITE_WALKING_PREVIEW === "1";

const REVIEW_SCENE_KEY = "anima.shadow-over-innsmouth.review-scene";
const API_BASE_URL =
	import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001/api";
const VERBS: StoryVerb[] = ["LOOK", "TALK", "USE"];
const PANEL_DEPTH = 100;
const CHARACTER_DEPTH = 24;
const TITLE_BAR_HEIGHT = 56;
const OUTPUT_PANEL_HEIGHT = 116;
// Lowest feet position: keeps Hermes clear of the caption panel.
// Captions live above the scene floor; foreground artwork remains walkable.
const MAX_FEET_Y = 1080 - 16;
const SHOW_DEBUG_OVERLAY =
	typeof window !== "undefined" &&
	new URLSearchParams(window.location.search).get("debug") === "1";
const HERMES_TEXTURE = "hermes-fal-veo-transparent-loop";
const HERMES_AWAY_TEXTURE = "hermes-walk-away";
const HERMES_TOWARD_TEXTURE = "hermes-walk-toward";
const HERMES_AWAY_DIAGONAL_TEXTURE = "hermes-walk-away-right";
const HERMES_TOWARD_DIAGONAL_TEXTURE = "hermes-walk-toward-right";
const HERMES_IDLE_TEXTURE = "hermes-passing-stand-side";
const HERMES_TALK_TEXTURE = "hermes-talk-v1-normalized";
const KAT_TEXTURE = "kat-fal-veo-transparent-loop";
const KAT_SEATED_TEXTURE = "kat-seated-talk-loop";
const REVIEW_SCENE_CONFIG: SceneConfig = {
	sceneName: "InnsmouthStandaloneScene",
	displayName: "Innsmouth Starting Scenes",
	worldWidth: 1920,
	playerSpawn: { x: 650, y: 880, scale: 0.4 },
	playerSpeed: 250,
	groundLine: REVIEW_SCENES.outside.groundLine,
};

interface ReviewTransitionSnapshot {
	from: ReviewSceneId;
	to: ReviewSceneId;
	exitX: number;
	exitY: number;
	hiddenBeforeTransition: boolean;
}

interface SceneInteractable {
	name: string;
	bounds: [number, number, number, number];
}

interface VisualState {
	timeOfDay: string;
	weather: string;
	damage: string;
	npcsPresent: string[];
}
interface WorldState {
	location: string;
	flags: Record<string, string | boolean>;
	inventory: string[];
	npcMemory: Record<string, string>;
	visual: Record<string, VisualState>;
	history: unknown[];
}

interface GeneratedPlace {
	id: string;
	neighbours?: Partial<Record<"edge-left" | "edge-right", string>>;
	parent: string;
	description: string;
	background: string;
	template: "exterior" | "interior";
	ground: {
		walkArea?: { scaleClamp: { min: number; max: number } };
		groundLine: ReviewScene["groundLine"];
		freeWalkBounds: ReviewScene["freeWalkBounds"];
		freeWalkRanges: ReviewScene["freeWalkRanges"];
		floor: FloorMask;
		horizonY: number;
		scaleSlope: number;
		baseScale: number;
		ground: "derived" | "inherited";
		verdicts: Array<{ pass: boolean; why: string }>;
	};
}

interface NarrationResolution {
	travel?: {
		to: string;
		kind: "anchor" | "new" | "existing";
		template?: "exterior" | "interior";
		description?: string;
	};
	caption: string;
	statePatch: {
		flags?: Record<string, string | boolean>;
		inventory?: { add?: string[]; remove?: string[] };
		npcMemory?: Record<string, string>;
	};
	visualStatePatch?: Partial<VisualState>;
	visual: { delta: "none" } | { delta: "new"; imagePrompt: string };
}

type OpenWorldUiState =
	| { status: "idle" }
	| { status: "loading"; object: string }
	| { status: "options"; object: string; options: [string, string, string] }
	| { status: "resolving"; object: string }
	| {
			status: "resolved";
			object: string;
			caption: string;
			imagePrompt?: string;
			imageEditMs?: number;
	  }
	| { status: "error"; message: string };

const BACKGROUNDS: Record<string, string> = {
	bus_station: "arkham-depot-interior",
	hotel_lobby: "gilman-lobby",
	hotel_lobby_evening: "gilman-lobby",
	hotel_room: "gilman-lobby",
	innsmouth_streets: "innsmouth-plaza",
	town_square: "innsmouth-plaza",
	grocery_store: "innsmouth-plaza",
	harbor: "innsmouth-night",
	pier_meeting: "innsmouth-night",
	the_beach: "innsmouth-night",
};

export class StoryGameScene extends BaseScene {
	protected readonly config = REVIEW_SCENE_CONFIG;
	private runtime!: StoryRuntime;
	private readonly act1 =
		new URLSearchParams(window.location.search).get("act") === "1";
	private dialogue?: StoryDialogue;
	private dialogueLocked = false;
	private storyVisualScene = "";
	private snapshot!: StoryRuntimeSnapshot;
	private background?: Phaser.GameObjects.Image;
	private outputText!: Phaser.GameObjects.Text;
	private titleText!: Phaser.GameObjects.Text;
	private stateText!: Phaser.GameObjects.Text;
	private hermesSprite?: Character;
	private katSprite?: Phaser.GameObjects.Sprite;
	private katSeatedSprite?: Phaser.GameObjects.Sprite;
	private hermesFacing: 1 | -1 = 1;
	private walkArea?: WalkArea;
	private geometryReady = false;
	private hermesWalkDirection: WalkDirection = "left";
	private hermesMotionState: CharacterAnimationState = "idle";
	private reviewSceneId: ReviewSceneId = "outside";
	private reviewOutput: string[] = [];
	private activeCharacterStates: Partial<
		Record<ReviewCharacterId, SceneCharacterState>
	> = {};
	private reviewCharacterOverrides: Partial<
		Record<ReviewSceneId, ReviewScene["characters"]>
	> = {};
	private lastReviewTransition?: ReviewTransitionSnapshot;
	private hermesMotor?: CharacterMotor;
	private objectLayers: {
		data: Occluder;
		image: Phaser.GameObjects.Image;
		alpha: (x: number, y: number) => boolean;
	}[] = [];
	private sceneExits: Exit[] = [];
	private exitLatch?: string;
	private arrivingExit = false;
	private travellingExit?: { from: string; exit: Exit };
	private connections: Array<{
		exit: string;
		kind: Exit["kind"];
		to: string;
		entry: string;
	}> = [];
	private requestedExit?: string;
	private approachingObject = false;
	private visibleFloor?: FloorMask;
	private geometryGeneration = 0;
	private commandObjects: Phaser.GameObjects.GameObject[] = [];
	private placementDebugEnabled = SHOW_DEBUG_OVERLAY;
	private placementDebugGraphics?: Phaser.GameObjects.Graphics;
	private placementDebugLabels: Phaser.GameObjects.Text[] = [];
	private interactables: SceneInteractable[] = [];
	private hoveredInteractableName?: string;
	private selectedInteractable?: SceneInteractable;
	private openWorldBusy = false;
	private lastOpenWorldCaption?: string;
	private lastOpenWorldImagePrompt?: string;
	private lastImageEditMs?: number;
	private world?: WorldState;
	private worldSessionId = "";
	private currentImage?: string;
	private generatedPlace?: GeneratedPlace;
	private optionsCache = new Map<string, Promise<[string, string, string]>>();
	private dwellTimer?: ReturnType<typeof setTimeout>;
	private captionVoice?: ReturnType<typeof speakCaption>;
	private lastResolution?: NarrationResolution;
	private locationImages = new Map<string, string>();

	constructor() {
		super({ key: "StoryGameScene" });
	}

	preload(): void {
		this.load.image("bus-station", "backgrounds/2026-01-27-bus-station.png");
		this.load.image("bus-station-flat", "backgrounds/bus-station-flat-v1.png");
		this.load.image(
			"arkham-depot-interior",
			"backgrounds/arkham-bus-depot-full-scene-v2.png",
		);
		this.load.image(
			"arkham-depot-interior-clean",
			"backgrounds/arkham-bus-depot-flat-2d.png",
		);
		this.load.image(
			"gilman-lobby",
			"backgrounds/2026-01-27-11-11-32-gilman-house-lobby.png",
		);
		this.load.image(
			"innsmouth-plaza",
			"backgrounds/arkham-bus-depot-full-scene-v2.png",
		);
		this.load.image(
			"innsmouth-night",
			"backgrounds/arkham-bus-depot-variant-b.png",
		);
		const loadCycle = (texture: string) => {
			this.load.once(`filecomplete-json-${texture}-meta`, () => {
				const meta = this.cache.json.get(`${texture}-meta`) as FootCycle;
				this.load.spritesheet(texture, `assets/sprites/hermes/${texture}.png`, {
					frameWidth: meta.frameWidth,
					frameHeight: meta.frameHeight,
				});
			});
		};
		loadCycle(HERMES_TEXTURE);
		this.load.json(
			`${HERMES_TEXTURE}-meta`,
			`assets/sprites/hermes/${HERMES_TEXTURE}.json`,
		);
		for (const texture of [
			...Object.values(HERMES_WALK_SHEETS),
			HERMES_AWAY_TEXTURE,
			"hermes-passing-stand-away",
			"hermes-passing-stand-away-right",
			"hermes-passing-stand-toward",
			"hermes-passing-stand-toward-right",
			HERMES_TOWARD_TEXTURE,
			HERMES_AWAY_DIAGONAL_TEXTURE,
			HERMES_TOWARD_DIAGONAL_TEXTURE,
		]) {
			this.load.json(
				`${texture}-meta`,
				`assets/sprites/hermes/${texture}.json`,
			);
			loadCycle(texture);
		}
		for (const texture of [HERMES_IDLE_TEXTURE, HERMES_TALK_TEXTURE])
			this.load.json(
				`${texture}-meta`,
				`assets/sprites/hermes/${texture}.json`,
			);
		this.load.spritesheet(
			HERMES_IDLE_TEXTURE,
			"assets/sprites/hermes/hermes-passing-stand-side.png",
			{ frameWidth: 612, frameHeight: 1059 },
		);
		this.load.spritesheet(
			HERMES_TALK_TEXTURE,
			"assets/sprites/hermes/hermes-talk-v1-normalized.png",
			{ frameWidth: 612, frameHeight: 1059 },
		);
		this.load.spritesheet(
			KAT_TEXTURE,
			"assets/sprites/kat/kat-fal-veo-transparent-loop.png",
			{ frameWidth: 515, frameHeight: 994 },
		);
		this.load.spritesheet(
			KAT_SEATED_TEXTURE,
			"assets/sprites/kat/kat-seated-talk-loop.png",
			{ frameWidth: 820, frameHeight: 880 },
		);
	}

	create(): void {
		const graph = parseStoryScript(this.act1 ? act1Story : fullGameStory);
		const diagnostics = validateStoryGraph(graph);
		const savedState = this.act1 ? undefined : this.loadState();

		this.runtime = new StoryRuntime(graph, savedState);
		this.snapshot = this.runtime.start();
		if (diagnostics.length > 0 && !this.act1) {
			this.snapshot.output.push(
				...diagnostics.slice(0, 4).map((item) => `[Story warning] ${item}`),
			);
		}

		this.createLayout();
		super.create();
		this.createCharacterSprites();
		this.reviewSceneId = this.loadReviewSceneId();
		this.renderReviewScene();
		this.bindReviewEvents();
		this.bindOpenWorldEvents();
		this.setupInputHandlers();
		void this.restoreWorld().then(() => {
			if (this.act1) this.startAct1();
		});

		if (this.act1) return;
		this.input.keyboard?.on("keydown-S", () => this.saveState());
		this.input.keyboard?.on("keydown-L", () => {
			const state = this.loadState();
			this.runtime = new StoryRuntime(graph, state);
			this.snapshot = this.runtime.start();
			this.renderSnapshot();
		});
		this.input.keyboard?.on("keydown-R", () => {
			localStorage.removeItem(SAVE_KEY);
			this.runtime = new StoryRuntime(graph);
			this.snapshot = this.runtime.start();
			this.reviewCharacterOverrides = {};
			this.renderReviewScene();
		});
		this.input.keyboard?.on("keydown-D", () => {
			this.placementDebugEnabled = !this.placementDebugEnabled;
			this.refreshPlacementDebugOverlay();
		});
	}

	private startAct1(): void {
		// Mirror the DOM dialogue into the canvas so __anima.record includes it.
		const onDialogue = (event: Event) => {
			const state = (event as CustomEvent<DialogueState | null>).detail;
			this.outputText.setColor(
				speakerColours[state?.speaker ?? "Narrator"] ?? "#f4f0df",
			);
			this.outputText.setText(
				state
					? [
							state.pendingArt ? `[${state.pendingArt}]` : "",
							`${state.speaker}: ${state.text}`,
							...state.choices.map((c) => `${c.index + 1}. ${c.text}`),
						]
							.filter(Boolean)
							.join("\n")
					: this.storyVisualScene === "bus_interior"
						? "[bus interior pending] — select a labelled hotspot"
						: "Click a hotspot to interact. Click the ground to walk.",
			);
			if (this.katSeatedSprite?.visible)
				this.katSeatedSprite.play(
					`${KAT_SEATED_TEXTURE}-${state?.speaker === "kat" ? "talk" : "idle"}`,
					true,
				);
		};
		window.addEventListener("anima:dialogue-state", onDialogue);
		this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
			window.removeEventListener("anima:dialogue-state", onDialogue),
		);
		this.dialogue = new StoryDialogue(
			this.runtime,
			API_BASE_URL,
			(locked) => {
				this.dialogueLocked = locked;
				if (locked) this.hermesMotor?.stop();
			},
			async (snapshot) => {
				this.snapshot = snapshot;
				const id = snapshot.scene?.originalId ?? "";
				if (this.storyVisualScene !== id) {
					this.storyVisualScene = id;
					if (id === "bus_station" || id === "bus_interior") {
						const kat = REVIEW_SCENES.inside.characters.kat;
						if (kat)
							this.reviewCharacterOverrides.inside = {
								kat: {
									...kat,
									visible: true,
									states: {
										seatedIdle: { ...kat.states?.seatedIdle, visible: true },
										seatedTalk: { ...kat.states?.seatedTalk, visible: true },
									},
								},
							};
						await this.enterLocation("inside");
					} else if (id === "innsmouth_streets") {
						await this.enterLocation("place-d3fc732744430e25f7c1");
					}
				}
				this.renderSceneHotspots(this.activeScene());
				this.titleText.setText(snapshot.scene?.location ?? id);
				this.stateText.setText(
					`Inventory: ${snapshot.state.inventory.join(", ") || "empty"}`,
				);
				this.outputText.setText(
					id === "bus_interior"
						? "[bus interior pending] — select a labelled hotspot"
						: "Click a hotspot to interact. Click the ground to walk.",
				);
				return id === "bus_interior" ? "bus interior pending" : undefined;
			},
		);
		this.events.once(Phaser.Scenes.Events.SHUTDOWN, () =>
			this.dialogue?.destroy(),
		);
		void this.dialogue.present(this.snapshot);
	}

	private async performStoryAction(
		id: string,
		verb: StoryVerb,
		point: ScenePoint,
	): Promise<void> {
		if (this.dialogueLocked || !this.dialogue) return;
		this.dialogueLocked = true;
		this.hermesMotor?.stop();
		await this.hermesMotor?.facePoint(point);
		if (
			id === "exit" &&
			this.snapshot.scene?.originalId === "bus_station" &&
			this.reviewSceneId === "inside"
		) {
			await this.enterLocation("outside");
			this.dialogueLocked = false;
			return;
		}
		this.dialogue.perform(id, verb);
	}

	private createLayout(): void {
		const { width, height } = this.scale;

		this.add.rectangle(0, 0, width, height, 0x0f1115).setOrigin(0, 0);
		this.background = this.add.image(width / 2, height / 2, "bus-station");
		this.fitBackgroundToScreen();
		this.background.setAlpha(1);

		this.add
			.rectangle(0, 0, width, TITLE_BAR_HEIGHT, 0x050608, 0.72)
			.setOrigin(0, 0)
			.setDepth(PANEL_DEPTH);
		this.titleText = this.add.text(28, 22, "", {
			color: "#f8e7b8",
			fontFamily: '"Courier New", monospace',
			fontSize: "22px",
			fontStyle: "bold",
		});
		this.titleText.setDepth(PANEL_DEPTH + 1);

		this.stateText = this.add.text(width - 420, 22, "", {
			align: "right",
			color: "#b7c3c8",
			fontFamily: '"Courier New", monospace',
			fontSize: "13px",
			wordWrap: { width: 390 },
		});
		this.stateText.setDepth(PANEL_DEPTH + 1);
		this.stateText.setVisible(SHOW_DEBUG_OVERLAY);

		this.add
			.rectangle(
				0,
				TITLE_BAR_HEIGHT,
				width,
				OUTPUT_PANEL_HEIGHT,
				0x050608,
				0.76,
			)
			.setOrigin(0, 0)
			.setDepth(PANEL_DEPTH);
		this.outputText = this.add.text(28, TITLE_BAR_HEIGHT + 16, "", {
			color: "#f4f0df",
			fontFamily: '"Courier New", monospace',
			fontSize: "16px",
			lineSpacing: 5,
			wordWrap: { width: width - 56 },
		});
		this.outputText.setDepth(PANEL_DEPTH + 1);

		this.placementDebugGraphics = this.add.graphics();
		this.placementDebugGraphics.setDepth(PANEL_DEPTH - 1);
	}

	private createCharacterSprites(): void {
		this.createWalkAnimation(KAT_TEXTURE, 30);
		this.createSeatedKatAnimations();

		for (const texture of [
			HERMES_AWAY_TEXTURE,
			"hermes-passing-stand-side",
			"hermes-passing-stand-away",
			"hermes-passing-stand-away-right",
			"hermes-passing-stand-toward",
			"hermes-passing-stand-toward-right",
			HERMES_TOWARD_TEXTURE,
			HERMES_AWAY_DIAGONAL_TEXTURE,
			HERMES_TOWARD_DIAGONAL_TEXTURE,
		]) {
			const meta = this.cache.json.get(`${texture}-meta`);
			if (!this.anims.exists(`${texture}-walk`))
				this.anims.create({
					key: `${texture}-walk`,
					frames: this.anims.generateFrameNumbers(texture, {
						start: 0,
						end: meta.frameCount - 1,
					}),
					frameRate: meta.fps,
					repeat: -1,
				});
		}

		const hermesAnimConfig: CharacterAnimConfig = {
			walk: {
				key: `${HERMES_TEXTURE}-walk`,
				frames: { start: 0, end: 29 },
				frameRate: 24,
			},
			idle: {
				key: `${HERMES_TEXTURE}-idle`,
				texture: HERMES_IDLE_TEXTURE,
				frames: { start: 0, end: 0 },
				frameRate: 12,
			},
			talk: {
				key: `${HERMES_TEXTURE}-talk`,
				texture: HERMES_TALK_TEXTURE,
				frames: { start: 0, end: 5 },
				frameRate: 12,
			},
			facesLeft: true,
		};
		this.hermesSprite = new Character(
			this,
			650,
			850,
			HERMES_TEXTURE,
			hermesAnimConfig,
			0.4,
			"hermes",
		);
		this.hermesSprite.setDepth(CHARACTER_DEPTH);
		this.hermesSprite.setWorldBoundsCollision(false);

		this.katSprite = this.add
			.sprite(1080, 820, KAT_TEXTURE, 0)
			.setOrigin(0.5, 1)
			.setScale(0.24)
			.setDepth(CHARACTER_DEPTH);
		this.katSprite.play(`${KAT_TEXTURE}-loop`);

		this.katSeatedSprite = this.add
			.sprite(1110, 890, KAT_SEATED_TEXTURE, 0)
			.setOrigin(0.5, 1)
			.setScale(0.47)
			.setDepth(CHARACTER_DEPTH)
			.setVisible(false);
	}

	private createWalkAnimation(textureKey: string, lastFrame: number): void {
		const animationKey = `${textureKey}-loop`;
		if (this.anims.exists(animationKey)) return;
		this.anims.create({
			key: animationKey,
			frames: this.anims.generateFrameNumbers(textureKey, {
				start: 0,
				end: lastFrame,
			}),
			frameRate: 16,
			repeat: -1,
		});
	}

	private createSeatedKatAnimations(): void {
		if (!this.anims.exists(`${KAT_SEATED_TEXTURE}-idle`)) {
			this.anims.create({
				key: `${KAT_SEATED_TEXTURE}-idle`,
				frames: [{ key: KAT_SEATED_TEXTURE, frame: 0 }],
				frameRate: 1,
				repeat: -1,
			});
		}
		if (!this.anims.exists(`${KAT_SEATED_TEXTURE}-talk`)) {
			this.anims.create({
				key: `${KAT_SEATED_TEXTURE}-talk`,
				frames: this.anims.generateFrameNumbers(KAT_SEATED_TEXTURE, {
					start: 0,
					end: 1,
				}),
				frameRate: 4,
				repeat: -1,
			});
		}
	}

	override update(_time: number, delta: number): void {
		super.update(_time, delta);
		const wasWalking = this.hermesMotor?.walking;
		this.hermesMotor?.update(delta);
		if (this.hermesSprite) {
			for (const layer of this.objectLayers)
				layer.image.setDepth(
					renderDepthForOccluder(
						layer.data,
						this.hermesMotor?.anchor ?? this.hermesSprite,
					),
				);
			// Scene update follows Phaser's normal pre-update depth sort. Flush
			// changed baselines now so this captured frame uses its own order.
			this.children.depthSort();
			const state = exitForFrame({
				anchor: this.hermesMotor?.anchor ?? this.hermesSprite,
				exits: this.sceneExits,
				requested: this.requestedExit,
				latch: this.exitLatch,
				arrival: this.hermesMotor?.snapshot().arrival,
				wasWalking: !!wasWalking,
				approachingObject: this.approachingObject,
				arriving: this.arrivingExit,
				busy: this.openWorldBusy,
			});
			this.exitLatch = state.latch;
			if (state.trigger) {
				this.exitLatch = state.trigger.id;
				this.hermesMotor?.stop();
				void this.triggerExit(state.trigger);
			}
		}
		this.updateReviewHotspotHover();
		this.refreshPlacementDebugOverlay();
	}

	private renderSnapshot(): void {
		const scene = this.snapshot.scene;
		if (!scene) return;

		const backgroundKey = BACKGROUNDS[scene.originalId] ?? "innsmouth-plaza";
		this.setSceneBackground(backgroundKey);
		this.titleText.setText(scene.location || scene.originalId);
		this.stateText.setText([
			`Scene: ${scene.originalId}`,
			`Inventory: ${this.snapshot.state.inventory.join(", ") || "empty"}`,
			"S save  L load  R restart",
		]);

		this.outputText.setText(this.snapshot.output.slice(-8).join("\n"));
		this.renderCharactersForScene(scene.originalId);
		this.renderCommands();
		this.saveState();
	}

	private activeScene(): ReviewScene {
		if (!this.generatedPlace) return REVIEW_SCENES[this.reviewSceneId];
		const p = this.generatedPlace;
		const spawn = p.ground.groundLine.points[2];
		const point = { ...spawn, y: Math.min(spawn.y, MAX_FEET_Y) };
		return {
			id: this.reviewSceneId,
			title: p.description.split(/[.!?]/)[0] || "Uncharted place",
			description: p.description,
			background: `open-world:${API_BASE_URL.replace(/\/api$/, "")}${p.background}`,
			groundLine: p.ground.groundLine,
			freeWalkBounds: p.ground.freeWalkBounds,
			freeWalkRanges: p.ground.freeWalkRanges,
			output: [],
			characters: {
				hermes: { ...point, scale: p.ground.baseScale, visible: true },
			},
			hotspots: [],
		};
	}
	private locationId(): string {
		return this.generatedPlace?.id ?? this.reviewSceneId;
	}
	public async enterLocation(id: string): Promise<void> {
		const alreadyBusy = this.openWorldBusy;
		// Do not expose the authored default spawn while floor geometry and
		// the actual entry position are still loading.
		this.hermesSprite?.setVisible(false);
		this.openWorldBusy = true;
		try {
			this.interactables = [];
			if (id === "outside" || id === "inside") {
				this.generatedPlace = undefined;
				this.reviewSceneId = id;
			} else {
				const response = await fetch(`${API_BASE_URL}/places/${id}`);
				if (!response.ok) throw new Error("Unable to load place");
				const place = (await response.json()) as GeneratedPlace;
				// Erode physical floor before clipping the artificial caption boundary.
				this.generatedPlace = place;
				this.reviewSceneId =
					this.generatedPlace.template === "interior" ? "inside" : "outside";
				await this.swapBackgroundTexture(
					`${API_BASE_URL.replace(/\/api$/, "")}${this.generatedPlace.background}`,
				);
			}
			await this.patchWorld({ location: id });
			this.reviewOutput = [];
			this.renderReviewScene();
			this.hermesSprite?.setVisible(false);
			await this.restoreLocationImage();
			if (this.travellingExit)
				await this.arriveThroughExit(this.travellingExit);
			commitSceneRoute(id);
			localStorage.setItem(REVIEW_SCENE_KEY, id);
			window.dispatchEvent(
				new CustomEvent("anima:location-changed", { detail: id }),
			);
		} finally {
			this.hermesSprite?.setVisible(this.geometryReady);
			this.openWorldBusy = alreadyBusy;
		}
	}

	private renderReviewScene(): void {
		const scene = this.activeScene();
		this.geometryGeneration++;
		this.geometryReady = false;
		for (const layer of this.objectLayers) layer.image.destroy();
		this.objectLayers = [];
		this.sceneExits = [];
		this.hoveredInteractableName = undefined;
		this.applySceneGroundLine(scene);
		const ground =
			this.generatedPlace?.ground ??
			(this.reviewSceneId === "outside" ? exteriorGround : undefined);
		const floor = sceneFloor(ground, scene, MAX_FEET_Y);
		this.walkArea = floor.area;
		this.visibleFloor = floor.visible;
		if (this.hermesSprite) {
			this.hermesMotor?.detach();
			const { cycle, current, show } = spriteFootBinding(
				() => this.hermesSprite,
				(texture) => this.cache.json.get(`${texture}-meta`),
				"Hermes unavailable",
			);
			this.hermesMotor = new CharacterMotor(
				this.hermesSprite,
				this.walkArea,
				(state, heading) => {
					this.hermesMotionState = state;
					this.hermesWalkDirection = heading;
					this.hermesFacing = heading.endsWith("right") ? 1 : -1;
					this.hermesSprite?.anims.stop();
				},
				hermesFootAnimation(cycle, current, show),
				HERMES_WALK,
			);
		}
		this.setSceneBackground(
			this.locationImages.get(this.locationId()) ?? scene.background,
		);
		this.titleText.setText(scene.title);
		this.stateText.setText([
			`Review scene: ${scene.id}`,
			"Playable hotspots enabled",
			"Use the panel to switch scenes",
		]);
		this.reviewOutput =
			this.reviewOutput.length > 0 ? this.reviewOutput : scene.output;
		this.outputText.setText(
			[`## ${scene.title}`, ...this.reviewOutput].join("\n"),
		);
		this.placeReviewCharacters(scene);
		for (const object of this.commandObjects) object.destroy();
		this.commandObjects = [];
		this.renderSceneHotspots(scene);
		this.refreshPlacementDebugOverlay();
	}

	private clearPlacementDebugLabels(): void {
		for (const label of this.placementDebugLabels) label.destroy();
		this.placementDebugLabels = [];
	}

	private addPlacementDebugLabel(
		x: number,
		y: number,
		text: string,
		color = "#9ff7ff",
	): void {
		const label = this.add.text(x, y, text, {
			backgroundColor: "rgba(4, 8, 12, 0.74)",
			color,
			fontFamily: '"Courier New", monospace',
			fontSize: "12px",
			padding: { x: 4, y: 2 },
		});
		label.setDepth(PANEL_DEPTH + 2);
		this.placementDebugLabels.push(label);
	}

	private refreshPlacementDebugOverlay(): void {
		refreshPlacementDebugOverlay(
			{
				placementDebugGraphics: this.placementDebugGraphics,
				placementDebugEnabled: this.placementDebugEnabled,
				reviewSceneId: this.reviewSceneId,
				activeScene: () => this.activeScene(),
				clearPlacementDebugLabels: () => this.clearPlacementDebugLabels(),
				addPlacementDebugLabel: (x, y, text, color) =>
					this.addPlacementDebugLabel(x, y, text, color),
				sceneExits: this.sceneExits,
				objectLayers: this.objectLayers,
				hermesSprite: this.hermesSprite,
				hermesMotionState: this.hermesMotionState,
				scale: this.scale,
			},
			TITLE_BAR_HEIGHT,
		);
	}

	private renderSceneHotspots(scene: ReviewScene): void {
		for (const hotspot of this.hotspots) hotspot.destroy();
		this.hotspots = [];
		if (this.act1 && this.snapshot.scene) {
			for (const object of this.commandObjects) object.destroy();
			this.commandObjects = [];
			for (const hotspot of act1Hotspots(
				this.snapshot.scene,
				this.reviewSceneId === "outside" && !this.generatedPlace,
			)) {
				const { bounds } = hotspot;
				const verbs = VERBS.filter((verb) => hotspot.actions[verb]?.length);
				const perform = (verb: StoryVerb) => {
					void this.performStoryAction(hotspot.id, verb, {
						x: bounds.x + bounds.width / 2,
						y: bounds.y + bounds.height / 2,
					});
				};
				this.addHotspot({
					id: hotspot.id,
					name: hotspot.name,
					...bounds,
					verbs: verbs.map((v) => v.toLowerCase() as HotspotVerb),
					onInteract: (verb) => perform(this.toStoryVerb(verb)),
				});
				if (this.snapshot.scene.originalId === "bus_interior")
					this.addButton(bounds.x, bounds.y, 230, hotspot.name, () =>
						perform(
							verbs.includes("TALK")
								? "TALK"
								: verbs.includes("USE")
									? "USE"
									: "LOOK",
						),
					);
			}
			return;
		}

		for (const hotspot of scene.hotspots) {
			if (!hotspot.bounds) continue;
			this.addHotspot({
				id: hotspot.id,
				name: hotspot.name,
				x: hotspot.bounds.x,
				y: hotspot.bounds.y,
				width: hotspot.bounds.width,
				height: hotspot.bounds.height,
				verbs: this.getHotspotVerbs(hotspot),
				onInteract: (verb) => {
					void this.performReviewAction(scene, hotspot, this.toStoryVerb(verb));
				},
			});
		}
	}

	private getHotspotVerbs(hotspot: ReviewHotspot): HotspotVerb[] {
		return VERBS.filter((verb) => hotspot.actions[verb]).map((verb) =>
			verb.toLowerCase(),
		) as HotspotVerb[];
	}

	private setSceneBackground(textureKey: string): void {
		this.background?.setTexture(textureKey);
		this.fitBackgroundToScreen();
	}

	private fitBackgroundToScreen(): void {
		const { width, height } = this.scale;
		this.background
			?.setPosition(width / 2, height / 2)
			.setDisplaySize(width, height);
	}

	private getDefaultVerb(hotspot: ReviewHotspot): StoryVerb | undefined {
		if (hotspot.actions.TALK) return "TALK";
		if (hotspot.actions.USE) return "USE";
		if (hotspot.actions.LOOK) return "LOOK";
		return undefined;
	}

	private toStoryVerb(verb: HotspotVerb): StoryVerb {
		return verb.toUpperCase() as StoryVerb;
	}

	private renderCharactersForScene(sceneId: string): void {
		if (sceneId === "bus_station") {
			this.hermesSprite
				?.setVisible(true)
				.setPosition(460, 890)
				.setScale(0.43)
				.setFlipX(false);
			this.setHermesMotionState("idle");
			this.katSprite?.setVisible(false);
			this.katSeatedSprite?.setVisible(false);
			return;
		}

		this.hermesSprite?.setVisible(true);
		this.setHermesMotionState("idle");
		this.katSprite?.setVisible(false);
		this.katSeatedSprite?.setVisible(false);
	}

	private placeReviewCharacters(scene: ReviewScene): void {
		const characters = this.getSceneCharacters(scene);
		const hermes = characters.hermes;
		if (hermes) {
			this.hermesSprite?.setBaseScale(hermes.scale);
			this.hermesSprite
				?.setVisible(hermes.visible !== false)
				.setFlipX(hermes.flipX ?? this.hermesFacing === -1);
			if (this.hermesMotor) this.hermesMotor.heading = "away";
			this.hermesMotor?.place(hermes);
			this.setHermesMotionState(hermes.state === "talk" ? "talk" : "idle");
		} else {
			this.hermesSprite?.setVisible(false);
		}

		const kat = characters.kat;
		if (kat) {
			this.placeKat(kat);
		} else {
			this.katSprite?.setVisible(false);
			this.katSeatedSprite?.setVisible(false);
		}
	}

	private getSceneCharacters(scene: ReviewScene): ReviewScene["characters"] {
		return {
			...scene.characters,
			...(this.reviewCharacterOverrides[scene.id] ?? {}),
		};
	}

	private applySceneGroundLine(scene: ReviewScene): void {
		this.groundLineManager?.setGroundLine(scene.groundLine);
	}

	private placeKat(basePlacement: SceneCharacterPlacement): void {
		const placement = this.resolveCharacterPlacement("kat", basePlacement);
		const state = placement.state ?? "idle";
		this.katSprite?.setVisible(false);
		this.katSeatedSprite?.setVisible(false);

		const target =
			state === "seatedTalk" || state === "seatedIdle"
				? this.katSeatedSprite
				: this.katSprite;
		if (!target) return;

		target
			.setVisible(placement.visible !== false)
			.setPosition(placement.x, placement.y)
			.setScale(placement.scale)
			.setDepth(10 + placement.y / 20)
			.setFlipX(placement.flipX ?? false);

		if (target === this.katSeatedSprite) {
			const animationKey =
				state === "seatedTalk"
					? `${KAT_SEATED_TEXTURE}-talk`
					: `${KAT_SEATED_TEXTURE}-idle`;
			if (target.anims.currentAnim?.key !== animationKey) {
				target.play(animationKey);
			}
		}
	}

	private resolveCharacterPlacement(
		characterId: ReviewCharacterId,
		basePlacement: SceneCharacterPlacement,
	): SceneCharacterPlacement {
		const state =
			this.activeCharacterStates[characterId] ?? basePlacement.state;
		const statePlacement = state ? basePlacement.states?.[state] : undefined;
		return {
			...basePlacement,
			...statePlacement,
			state,
		};
	}

	protected override handlePointerDown(pointer: Phaser.Input.Pointer): void {
		if (
			!this.hermesSprite?.visible ||
			this.inputBlocked ||
			this.openWorldBusy ||
			this.dialogueLocked
		)
			return;
		if (pointer.y < TITLE_BAR_HEIGHT || pointer.y > MAX_FEET_Y) return;
		if (this.act1) {
			const hotspot = this.findHotspotAtPoint(pointer.x, pointer.y);
			if (hotspot) {
				const verb = hotspot.verbs.includes("talk")
					? "talk"
					: hotspot.verbs.includes("use")
						? "use"
						: "look";
				hotspot.interact(verb);
				return;
			}
			if (this.snapshot.scene?.originalId === "bus_interior") return;
		}
		if (exitAt(pointer, this.sceneExits)) {
			void this.walkGenerated(pointer.x, pointer.y);
			return;
		}
		if (WALKING_PREVIEW) {
			void this.walkGenerated(pointer.x, pointer.y);
			return;
		}
		const scene = this.activeScene();
		if (
			this.visibleFloor &&
			floorPixel(this.visibleFloor, pointer.x, pointer.y)
		) {
			void this.walkGenerated(pointer.x, pointer.y);
			return;
		}
		const interactable = this.findInteractableAtPoint(pointer.x, pointer.y);
		if (interactable) {
			void this.approachObject(interactable, pointer.x);
			return;
		}
		const hotspot =
			this.visibleFloor && floorPixel(this.visibleFloor, pointer.x, pointer.y)
				? undefined
				: this.findHotspotAtPoint(pointer.x, pointer.y);
		if (hotspot) {
			const reviewHotspot = scene.hotspots.find(
				(item) => item.id === hotspot.id,
			);
			if (!reviewHotspot) return;
			const verb = this.getDefaultVerb(reviewHotspot);
			if (verb) hotspot.interact(verb.toLowerCase() as HotspotVerb);
			return;
		}
		if (pointer.y < TITLE_BAR_HEIGHT || pointer.y > MAX_FEET_Y) {
			return;
		}
		void this.walkGenerated(pointer.x, pointer.y);
	}

	/** Read-only path preview for editor and click-to-walk verification. */
	public previewWalk(x: number, y: number): ScenePoint[] {
		// Route from the ground point under the feet, not the sprite origin: the
		// origin sits below the soles, and starting there bends every walk downhill.
		const start = this.hermesMotor?.anchor ?? this.hermesSprite;
		if (!this.walkArea || !start) return [];
		// Round route corners so a detour ramps perspective smoothly instead of kinking.
		return roundCorners(
			this.walkArea.mask,
			findWalkPath(this.walkArea, start, { x, y }),
			80,
		);
	}
	/** Both authored and generated free walks use the same navigation. */
	public async walkGenerated(x: number, y: number): Promise<void> {
		const area = this.walkArea,
			sprite = this.hermesSprite;
		if (
			!area ||
			!sprite ||
			this.inputBlocked ||
			this.arrivingExit ||
			!this.geometryReady
		)
			return;
		const exit = exitAt({ x, y }, this.sceneExits);
		const destination = exit?.approach ?? { x, y };
		const path = this.previewWalk(destination.x, destination.y);
		this.requestedExit = exit?.id;
		try {
			await this.walkHermesPath(path);
		} finally {
			this.requestedExit = undefined;
		}
	}

	private updateReviewHotspotHover(): void {
		if (this.act1) return;
		if (WALKING_PREVIEW) {
			this.stateText.setText(
				"Click the ground to walk. Use Scenes to change location.",
			);
			return;
		}
		const scene = this.activeScene();
		const pointer = this.input.activePointer;
		const interactable = this.findInteractableAtPoint(pointer.x, pointer.y);
		if (interactable?.name !== this.hoveredInteractableName) {
			this.hoveredInteractableName = interactable?.name;
			this.outputText.setText(
				interactable
					? interactable.name
					: [`## ${scene.title}`, ...this.reviewOutput].join("\n"),
			);
		}
		if (interactable) {
			this.stateText.setText([
				`Review scene: ${scene.id}`,
				`Object: ${interactable.name}`,
				"Click to ask the narrator",
			]);
			return;
		}
		const hotspot =
			this.visibleFloor && floorPixel(this.visibleFloor, pointer.x, pointer.y)
				? undefined
				: this.findHotspotAtPoint(pointer.x, pointer.y);
		if (hotspot) {
			this.stateText.setText([
				`Review scene: ${scene.id}`,
				`Hotspot: ${hotspot.name}`,
				"Click scene hotspots or use the panel",
			]);
			return;
		}
		this.stateText.setText([
			`Review scene: ${scene.id}`,
			"Playable hotspots enabled",
			"Click scene hotspots or use the panel",
		]);
	}

	private findInteractableAtPoint(
		x: number,
		y: number,
	): SceneInteractable | undefined {
		return objectAtPoint(
			this.interactables,
			this.objectLayers,
			this.visibleFloor,
			x,
			y,
			this.scale.width,
			this.scale.height,
		);
	}

	private async restoreWorld(): Promise<void> {
		this.openWorldBusy = true;
		try {
			this.worldSessionId =
				localStorage.getItem("anima.world.session") ?? crypto.randomUUID();
			localStorage.setItem("anima.world.session", this.worldSessionId);
			const response = await fetch(
				`${API_BASE_URL}/world/${this.worldSessionId}`,
			);
			if (!response.ok) throw new Error("Unable to restore world");
			this.world = (await response.json()) as WorldState;
			if (this.world.location === "inside" || this.world.location === "outside")
				this.reviewSceneId = this.world.location;
			Object.assign(this.snapshot.state.flags, this.world.flags);
			await this.enterLocation(readSceneRoute() ?? this.world.location);
		} catch (error) {
			this.emitOpenWorldState({ status: "error", message: String(error) });
			window.dispatchEvent(new Event("anima:scene-load-error"));
		} finally {
			this.openWorldBusy = false;
		}
	}
	private async patchWorld(patch: unknown): Promise<void> {
		const response = await fetch(
			`${API_BASE_URL}/world/${this.worldSessionId}`,
			{
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify(patch),
			},
		);
		if (!response.ok) throw new Error("Unable to save world");
		this.world = (await response.json()) as WorldState;
	}

	private async restoreLocationImage(): Promise<void> {
		this.currentImage = this.generatedPlace
			? `${API_BASE_URL.replace(/\/api$/, "")}${this.generatedPlace.background}`
			: undefined;
		const visual = this.world?.visual[this.locationId()];
		if (visual) {
			const response = await fetch(
				`${API_BASE_URL}/scene-image?scene=${this.locationId()}${this.generatedPlace ? `&baseBackground=${encodeURIComponent(this.generatedPlace.background)}` : ""}&visualState=${encodeURIComponent(JSON.stringify(visual))}`,
			);
			if (!response.ok) throw new Error("Unable to restore scene image");
			const image = (await response.json()) as { url: string | null };
			if (image.url) await this.swapBackgroundTexture(image.url);
		}
		await this.loadInteractables();
	}

	private async loadInteractables(): Promise<void> {
		try {
			const response = await fetch(
				`${API_BASE_URL}/interactables/${this.reviewSceneId}${this.currentImage ? `?image=${encodeURIComponent(this.currentImage)}` : ""}`,
			);
			if (!response.ok) {
				throw new Error(`Interactables request failed: ${response.status}`);
			}
			const payload = (await response.json()) as {
				interactables?: SceneInteractable[];
			};
			this.interactables = payload.interactables ?? [];
			await this.loadObjectGeometry();
			this.geometryReady = true;
			this.optionsCache.clear();
			if (this.dwellTimer) clearTimeout(this.dwellTimer);
			if (WALKING_PREVIEW || this.act1) return;
			const location = this.locationId();
			this.dwellTimer = setTimeout(() => {
				if (location !== this.locationId()) return;
				const area = (box: SceneInteractable) =>
					(box.bounds[2] - box.bounds[0]) * (box.bounds[3] - box.bounds[1]);
				for (const item of [...this.interactables]
					.sort((a, b) => area(b) - area(a))
					.slice(0, 3))
					void this.fetchOptions(item).catch(() =>
						this.optionsCache.delete(item.name),
					);
			}, 2000);
		} catch (error) {
			this.geometryReady = false;
			this.hermesMotor?.stop();
			if (this.walkArea)
				this.walkArea.mask = {
					...this.walkArea.mask,
					data: this.walkArea.mask.data.map(() => 0),
				};
			this.emitOpenWorldState({
				status: "error",
				message:
					error instanceof Error
						? error.message
						: "Unable to identify scene objects",
			});
		}
	}

	private async loadObjectGeometry(): Promise<void> {
		const generation = this.geometryGeneration;
		const response = await fetch(
			`${API_BASE_URL}/occluders/${this.locationId()}${this.currentImage ? `?image=${encodeURIComponent(this.currentImage)}` : ""}`,
		);
		if (!response.ok)
			throw new Error(`Occluders request failed: ${response.status}`);
		const data = (await response.json()) as {
			occluders: Occluder[];
			floor: FloorMask;
			exits: Exit[];
		};
		const base =
			this.currentImage ??
			`${window.location.origin}/backgrounds/${this.reviewSceneId === "outside" ? "bus-station-flat-v1" : "arkham-bus-depot-flat-2d"}.png`;
		const loaded = await loadOccluderImages(data.occluders, base);
		if (generation !== this.geometryGeneration) return;
		for (const layer of this.objectLayers) layer.image.destroy();
		this.objectLayers = [];
		this.objectLayers = createOccluderLayers(this, this.walkArea, loaded);
		if (this.visibleFloor && this.walkArea) {
			applySceneFootprints(
				this.walkArea,
				this.visibleFloor,
				!this.generatedPlace && this.reviewSceneId !== "outside"
					? data.floor
					: undefined,
				this.objectLayers,
				MAX_FEET_Y,
				this.katSeatedSprite,
			);
			const raw = this.walkArea.rawMask ?? this.walkArea.mask;
			this.visibleFloor = { ...raw, data: [...raw.data] };
		}
		this.sceneExits = data.exits;
		const connectionResponse = await fetch(
			`${API_BASE_URL}/connections/${this.locationId()}`,
		);
		if (!connectionResponse.ok)
			throw new Error("Unable to load exit connections");
		this.connections = await connectionResponse.json();
		if (!this.walkArea) throw new Error("Walk area unavailable");
		const { exits, exitMask, approachMask } = sceneExitApproaches(
			this.sceneExits,
			this.connections,
			this.walkArea,
			!this.generatedPlace ? this.activeScene().hotspots : undefined,
			MAX_FEET_Y,
		);
		this.sceneExits = exits;
		// Geometry may shrink after perception loads. Enter on an interior floor
		// cell, away from travel gates, instead of spawning on a clipped edge.
		if (this.hermesSprite && this.hermesMotor && exitMask) {
			const spawnMask = approachMask?.data.some(Boolean)
				? approachMask
				: exitMask;
			const point = interiorSpawn(
				spawnMask,
				this.sceneExits,
				this.hermesSprite,
			);
			if (point) this.hermesMotor.place(point);
		}
		this.exitLatch = this.hermesSprite
			? exitAt(this.hermesSprite, this.sceneExits)?.id
			: undefined;
	}

	private async approachObject(
		object: SceneInteractable,
		x: number,
	): Promise<void> {
		const generation = this.geometryGeneration;
		if (!this.walkArea || !this.hermesSprite) return;
		const path = objectApproach(
			this.walkArea,
			this.hermesMotor?.anchor ?? this.hermesSprite,
			this.objectLayers.map((l) => l.data),
			object,
			x,
		);
		if (!path.length) {
			this.emitOpenWorldState({
				status: "error",
				message: "There is no reachable floor in front of this object.",
			});
			return;
		}
		this.approachingObject = true;
		try {
			await this.walkHermesPath(path);
		} finally {
			this.approachingObject = false;
		}
		if (generation === this.geometryGeneration && !this.openWorldBusy)
			await this.requestNarrationOptions(object);
	}

	private async arriveThroughExit(travel: {
		from: string;
		exit: Exit;
	}): Promise<void> {
		if (!this.hermesMotor || !this.walkArea)
			throw new Error("Arrival floor unavailable");
		const { existing, entry, kind } = resolveReturnExit(
			this.walkArea,
			this.sceneExits,
			this.connections,
			travel,
			MAX_FEET_Y,
		);
		if (!existing) {
			const response = await fetch(`${API_BASE_URL}/connections`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					from: {
						scene: travel.from,
						exit: travel.exit.id,
						kind: travel.exit.kind,
					},
					to: { scene: this.locationId(), exit: entry.id, kind: entry.kind },
				}),
			});
			if (!response.ok)
				throw new Error(
					`Could not save return connection: ${await response.text()}`,
				);
		}
		entry.to = travel.from;
		const path = beginArrival(
			this.hermesMotor,
			this.walkArea,
			entry,
			kind,
			MAX_FEET_Y,
		);
		this.exitLatch = entry.id;
		// A walk-in can cross another nearby gate (the depot door beside its
		// right edge). Do not chain a second journey during the arrival itself.
		this.arrivingExit = true;
		void this.walkHermesPath(path, {
			initialHeading:
				kind === "near" ? "away" : kind === "far" ? "toward" : undefined,
		}).finally(() => {
			this.arrivingExit = false;
		});
	}

	private async triggerExit(exit: Exit): Promise<void> {
		// Disconnected pieces of one image edge share a single journey.
		if (exit.kind === "edge-left" || exit.kind === "edge-right") {
			const primary = this.sceneExits.find((e) => e.kind === exit.kind);
			if (primary) exit = { ...exit, id: primary.id, to: primary.to };
		}
		if (WALKING_PREVIEW && !exit.to) return;
		const from = this.locationId();
		this.travellingExit = { from, exit };
		try {
			if (exit.to) {
				await this.enterLocation(exit.to);
				return;
			}
			const destination =
				from === "outside" && exit.kind === "edge-left"
					? "the road out of town"
					: from === "outside" && exit.kind === "edge-right"
						? "along the harbour"
						: (exit.label ??
							(exit.kind === "edge-left"
								? "the road to the left"
								: exit.kind === "edge-right"
									? "the road to the right"
									: "the passage ahead"));
			this.selectedInteractable = { name: destination, bounds: [0, 0, 1, 1] };
			await this.resolveNarration(
				`I continue through this exit to ${destination}.`,
			);
			if (this.locationId() === from)
				throw new Error("Exit narration did not complete travel");
		} catch (error) {
			this.travellingExit = undefined;
			if (this.locationId() !== from) await this.enterLocation(from);
			this.emitOpenWorldState({ status: "error", message: String(error) });
		} finally {
			this.travellingExit = undefined;
		}
	}

	private fetchOptions(
		interactable: SceneInteractable,
	): Promise<[string, string, string]> {
		const cached = this.optionsCache.get(interactable.name);
		if (cached) return cached;
		const scene = this.activeScene();
		const promise = fetch(`${API_BASE_URL}/narrate`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				scene: this.locationId(),
				sessionId: this.worldSessionId,
				sceneDescription: scene.description,
				object: interactable.name,
				flags: this.world?.flags ?? {},
				mode: "options",
			}),
		}).then(async (response) => {
			if (!response.ok)
				throw new Error(`Narrator options failed: ${response.status}`);
			return ((await response.json()) as { options: [string, string, string] })
				.options;
		});
		this.optionsCache.set(interactable.name, promise);
		return promise;
	}
	private async requestNarrationOptions(
		interactable: SceneInteractable,
	): Promise<void> {
		this.openWorldBusy = true;
		this.selectedInteractable = interactable;
		if (this.hermesMotor) {
			await this.hermesMotor.facePoint(objectFacingPoint(interactable));
		}
		this.emitOpenWorldState({ status: "loading", object: interactable.name });
		try {
			const options = await this.fetchOptions(interactable);
			this.emitOpenWorldState({
				status: "options",
				object: interactable.name,
				options,
			});
		} catch (error) {
			this.optionsCache.delete(interactable.name);
			this.emitOpenWorldState({ status: "error", message: String(error) });
		} finally {
			this.openWorldBusy = false;
		}
	}

	private async resolveNarration(choice: string): Promise<void> {
		if (WALKING_PREVIEW || this.act1) return;
		const interactable = this.selectedInteractable;
		const physicalExit = Boolean(this.travellingExit);
		if (!interactable || this.openWorldBusy) return;
		this.openWorldBusy = true;
		this.emitOpenWorldState({
			status: "resolving",
			object: interactable.name,
		});

		try {
			const scene = this.activeScene();
			const response = await fetch(`${API_BASE_URL}/narrate`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					scene: this.locationId(),
					sessionId: this.worldSessionId,
					sceneDescription: scene.description,
					object: interactable.name,
					choice,
					exit: this.travellingExit?.exit.id,
					flags: this.world?.flags ?? this.snapshot.state.flags,
					mode: "resolve",
				}),
			});
			if (!response.ok) {
				throw new Error(`Narrator resolution failed: ${await response.text()}`);
			}
			const resolution = (await response.json()) as NarrationResolution;
			this.lastResolution = resolution;
			this.optionsCache.clear();
			this.captionVoice?.stop();
			this.captionVoice = speakCaption(
				resolution.caption,
				API_BASE_URL,
				isAudioMuted(),
			);
			const { first: firstSentence, full: fullCaption } = this.captionVoice;
			this.reviewOutput = [resolution.caption];
			this.lastOpenWorldCaption = resolution.caption;
			this.outputText.setText(resolution.caption);
			this.emitOpenWorldState({
				status: "resolved",
				object: interactable.name,
				caption: resolution.caption,
			});
			await this.patchWorld({
				statePatch: resolution.statePatch,
				visualStatePatch: resolution.travel
					? undefined
					: resolution.visualStatePatch,
				action: {
					object: interactable.name,
					choice,
					caption: resolution.caption,
				},
			});
			Object.assign(this.snapshot.state.flags, this.world?.flags);
			this.reviewOutput = [resolution.caption];
			this.lastOpenWorldCaption = resolution.caption;
			this.outputText.setText(resolution.caption);
			this.lastOpenWorldImagePrompt = undefined;
			this.lastImageEditMs = undefined;

			if (resolution.visual.delta === "new" && !resolution.travel) {
				this.lastOpenWorldImagePrompt = resolution.visual.imagePrompt;
				const startedAt = performance.now();
				const imageResponse = await fetch(`${API_BASE_URL}/scene-image`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						scene: this.locationId(),
						imagePrompt: resolution.visual.imagePrompt,
						visualState: this.world?.visual[this.locationId()],
						baseBackground: this.generatedPlace?.background,
						sourceImage: this.currentImage,
					}),
				});
				if (!imageResponse.ok) {
					throw new Error(`Scene image failed: ${imageResponse.status}`);
				}
				const image = (await imageResponse.json()) as { url: string };
				await firstSentence;
				await this.swapBackgroundTexture(image.url);
				await this.loadInteractables();
				this.lastImageEditMs = Math.round(performance.now() - startedAt);
			}

			if (resolution.travel) {
				const travel = resolution.travel;
				const narrativeDeparture = !this.travellingExit;
				if (narrativeDeparture) {
					const departure = findNarrativeDeparture(
						this.sceneExits,
						travel.to,
						this.locationId() === "outside" ? "edge-left" : "far",
					);
					if (departure)
						this.travellingExit = { from: this.locationId(), exit: departure };
				}
				if (travel.kind === "existing") {
					await firstSentence;
					await this.enterLocation(travel.to);
				} else if (travel.kind === "anchor") {
					if (travel.to !== "outside" && travel.to !== "inside")
						throw new Error("Unknown anchor");
					await firstSentence;
					await this.enterLocation(travel.to);
				} else {
					this.background?.setAlpha(0.35);
					const placeResponse = await fetch(`${API_BASE_URL}/places`, {
						method: "POST",
						headers: { "Content-Type": "application/json" },
						body: JSON.stringify({
							parent: this.locationId(),
							to: travel.to,
							template: travel.template ?? "exterior",
							description: travel.description ?? travel.to,
						}),
					});
					if (!placeResponse.ok)
						throw new Error(
							`Place creation failed: ${await placeResponse.text()}`,
						);
					const place = (await placeResponse.json()) as GeneratedPlace;
					await firstSentence;
					await this.enterLocation(place.id);
					this.background?.setAlpha(1);
				}
				if (narrativeDeparture) this.travellingExit = undefined;
			}
			await fullCaption;
			this.saveState();
			this.emitOpenWorldState({
				status: "resolved",
				object: interactable.name,
				caption: resolution.caption,
				imagePrompt: this.lastOpenWorldImagePrompt,
				imageEditMs: this.lastImageEditMs,
			});
		} catch (error) {
			this.emitOpenWorldState({
				status: "error",
				message:
					error instanceof Error ? error.message : "Narrator resolution failed",
			});
			if (physicalExit) throw error;
		} finally {
			if (!physicalExit) this.travellingExit = undefined;
			this.openWorldBusy = false;
		}
	}

	private async swapBackgroundTexture(url: string): Promise<void> {
		const textureKey = `open-world:${url}`;
		if (!this.textures.exists(textureKey)) {
			// ponytail: plain <img> instead of the Phaser loader — the loader can be
			// mid-batch here and silently drops files queued while it's PROCESSING.
			const img = new Image();
			img.crossOrigin = "anonymous"; // served by the api origin; WebGL needs untainted pixels
			await new Promise<void>((resolve, reject) => {
				img.onload = () => resolve();
				img.onerror = () =>
					reject(new Error(`Failed to load scene image ${url}`));
				img.src = url;
			});
			this.textures.addImage(textureKey, img);
		}

		await new Promise<void>((resolve) => {
			this.cameras.main.fadeOut(
				250,
				0,
				0,
				0,
				(_camera: Phaser.Cameras.Scene2D.Camera, progress: number) => {
					if (progress !== 1) return;
					this.setSceneBackground(textureKey);
					this.currentImage = url;
					this.locationImages.set(this.locationId(), textureKey);
					this.cameras.main.fadeIn(250);
					resolve();
				},
			);
		});
	}

	private emitOpenWorldState(detail: OpenWorldUiState): void {
		window.dispatchEvent(new CustomEvent("anima:open-world-state", { detail }));
	}

	private setHermesMotionState(state: CharacterAnimationState): void {
		this.hermesMotionState = state;
		const sprite = this.hermesSprite;
		if (!sprite) return;
		if (this.hermesMotor) {
			if (state !== "walk") this.hermesMotor.stop();
			return;
		}
		const pose = hermesStanding(this.hermesWalkDirection);
		sprite.anims.stop();
		sprite.setTexture(pose.texture, 0).setFlipX(pose.flipX);
	}

	private async walkHermesTo(
		x: number,
		y: number,
		options: { allowOffscreen?: boolean; hideOnArrival?: boolean } = {},
	): Promise<void> {
		if (options.allowOffscreen) await this.walkHermesPath([{ x, y }], options);
		else await this.walkGenerated(x, y);
	}

	private exitHermesTo(
		x: number,
		y: number,
		options: { hideOnArrival?: boolean; initialHeading?: WalkDirection } = {},
	): Promise<void> {
		const hermesSprite = this.hermesSprite;
		if (!hermesSprite) return Promise.resolve();
		return this.walkHermesTo(x, y, {
			allowOffscreen: true,
			hideOnArrival: options.hideOnArrival,
		});
	}

	/** Scripted exits may leave the free floor; motion still has one owner. */
	private async walkHermesPath(
		points: ScenePoint[],
		options: { hideOnArrival?: boolean; initialHeading?: WalkDirection } = {},
	): Promise<void> {
		if (!this.hermesMotor || !this.hermesSprite || !points.length) return;
		this.inputBlocked = true;
		this.hermesSprite.setWorldBoundsCollision(false);
		try {
			await this.hermesMotor.walk(points, options.initialHeading);
			if (options.hideOnArrival) this.hermesSprite.setVisible(false);
		} finally {
			this.inputBlocked = false;
		}
	}

	private async performReviewAction(
		scene: ReviewScene,
		hotspot: ReviewHotspot,
		verb: StoryVerb,
	): Promise<void> {
		const action = getReviewAction(scene, hotspot.id, verb);
		if (!action) return;

		const route =
			action.route ??
			[action.moveTo ?? hotspot.approach].filter((point): point is ScenePoint =>
				Boolean(point),
			);
		if (route.length > 0) {
			if (action.offGroundLine) {
				const path = action.exitTo ? [...route, action.exitTo] : route;
				await this.walkHermesPath(path, {
					hideOnArrival: action.hideOnExit,
				});
			} else {
				for (const point of route) {
					await this.walkHermesTo(point.x, point.y, {
						allowOffscreen: Boolean(action.exitTo),
					});
				}
				if (action.exitTo) {
					await this.exitHermesTo(action.exitTo.x, action.exitTo.y, {
						hideOnArrival: action.hideOnExit,
					});
				}
			}
			const hermes = this.getSceneCharacters(scene).hermes;
			if (hermes && this.hermesSprite) {
				// Position-only override: never carry a previous "talk" state forward
				const { state: _previousState, ...hermesPlacement } = hermes;
				this.reviewCharacterOverrides[scene.id] = {
					...(this.reviewCharacterOverrides[scene.id] ?? {}),
					hermes: {
						...hermesPlacement,
						x: this.hermesSprite.x,
						y: this.hermesSprite.y,
						scale: hermes.scale,
						visible: this.hermesSprite.visible,
						flipX: this.hermesSprite.flipX,
					},
				};
			}
		}
		this.activeCharacterStates = {};
		if (action.talkingCharacter) {
			this.activeCharacterStates[action.talkingCharacter] =
				action.talkingState ?? "seatedTalk";
		}
		if (verb === "TALK") {
			this.setHermesMotionState("talk");
			const hermes = this.getSceneCharacters(scene).hermes;
			if (hermes) {
				this.reviewCharacterOverrides[scene.id] = {
					...(this.reviewCharacterOverrides[scene.id] ?? {}),
					hermes: {
						...hermes,
						x: this.hermesSprite?.x ?? hermes.x,
						y: this.hermesSprite?.y ?? hermes.y,
						scale: hermes.scale,
						visible: this.hermesSprite?.visible ?? hermes.visible,
						flipX: this.hermesSprite?.flipX ?? hermes.flipX,
						state: "talk",
					},
				};
			}
		}

		this.reviewOutput = action.lines;

		if (action.transitionTo) {
			if (this.hermesSprite) {
				this.lastReviewTransition = {
					from: scene.id,
					to: action.transitionTo,
					exitX: Math.round(this.hermesSprite.x),
					exitY: Math.round(this.hermesSprite.y),
					hiddenBeforeTransition: !this.hermesSprite.visible,
				};
			}
			this.transitionReviewScene(action.transitionTo, action.spawn);
			return;
		}

		this.renderReviewScene();
	}

	private transitionReviewScene(
		sceneId: ReviewSceneId,
		spawn: ReviewScene["characters"] = {},
	): void {
		this.generatedPlace = undefined;
		const scene = REVIEW_SCENES[sceneId];
		this.reviewSceneId = sceneId;
		this.activeCharacterStates = {};
		this.reviewOutput =
			this.reviewOutput.length > 0 ? this.reviewOutput : scene.output;
		localStorage.setItem(REVIEW_SCENE_KEY, sceneId);
		if (this.world)
			void this.patchWorld({ location: sceneId }).then(() =>
				this.restoreLocationImage(),
			);

		for (const [characterId, placement] of Object.entries(spawn)) {
			if (!placement) continue;
			this.reviewCharacterOverrides[sceneId] = {
				...(this.reviewCharacterOverrides[sceneId] ?? {}),
				[characterId]: placement,
			};
		}

		this.renderReviewScene();
	}

	private bindReviewEvents(): void {
		// Native document navigation gives each scene a fresh motor, animations,
		// and pending asset requests. History traversal must do the same.
		const onHistory = () => window.location.reload();
		window.addEventListener("popstate", onHistory);
		this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
			window.removeEventListener("popstate", onHistory);
		});
		const onSceneChange = (event: Event) => {
			const sceneId = (event as CustomEvent<string>).detail;
			if (typeof sceneId !== "string") return;
			if (sceneId === "outside" || sceneId === "inside") {
				delete this.reviewCharacterOverrides[sceneId];
			}
			this.setHermesMotionState("idle");
			this.emitOpenWorldState({ status: "idle" });
			void this.enterLocation(sceneId).catch((error: unknown) => {
				this.emitOpenWorldState({ status: "error", message: String(error) });
				window.dispatchEvent(new Event("anima:scene-load-error"));
			});
		};

		window.addEventListener("anima:review-scene", onSceneChange);
		this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
			window.removeEventListener("anima:review-scene", onSceneChange);
		});
	}

	private bindOpenWorldEvents(): void {
		const onChoice = (event: Event) => {
			const choice = (event as CustomEvent<{ choice?: string }>).detail.choice;
			if (typeof choice === "string" && choice.length > 0) {
				void this.resolveNarration(choice);
			}
		};

		window.addEventListener("anima:open-world-choice", onChoice);
		this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
			window.removeEventListener("anima:open-world-choice", onChoice);
			if (this.dwellTimer) clearTimeout(this.dwellTimer);
			this.captionVoice?.stop();
		});
	}

	private loadReviewSceneId(): ReviewSceneId {
		const stored = localStorage.getItem(REVIEW_SCENE_KEY);
		return stored === "inside" || stored === "outside" ? stored : "outside";
	}

	public setPlacementDebugEnabled(enabled: boolean): void {
		this.placementDebugEnabled = enabled;
		this.refreshPlacementDebugOverlay();
	}

	public reviewPlaceHermesAt(
		x: number,
		options: {
			sceneId?: ReviewSceneId;
			flipX?: boolean;
			motionState?: CharacterAnimationState;
		} = {},
	) {
		if (options.sceneId && options.sceneId !== this.reviewSceneId) {
			this.reviewSceneId = options.sceneId;
			this.reviewOutput = [];
			delete this.reviewCharacterOverrides[options.sceneId];
			localStorage.setItem(REVIEW_SCENE_KEY, options.sceneId);
			this.renderReviewScene();
		}

		const scene = this.activeScene();
		const hermes = this.getSceneCharacters(scene).hermes;
		this.hermesMotor?.place({ x, y: this.hermesSprite?.y ?? hermes?.y ?? 890 });
		this.hermesSprite
			?.setVisible(true)
			.setFlipX(options.flipX ?? this.hermesSprite.flipX);
		this.setHermesMotionState(options.motionState ?? "idle");
		this.refreshPlacementDebugOverlay();
		return this.getReviewQaSnapshot();
	}

	public getReviewQaSnapshot() {
		const scene = this.activeScene();
		const hermesBounds = this.hermesSprite?.getBounds();
		return {
			story: this.act1 ? this.snapshot : undefined,
			dialogue: this.dialogue?.state ?? null,
			dialogueLocked: this.dialogueLocked,
			reviewSceneId: this.reviewSceneId,
			location: this.locationId(),
			generatedPlace: this.generatedPlace,
			background: scene.background,
			backgroundTextureKey: this.background?.texture.key ?? null,
			interactables: this.interactables,
			openWorld: {
				busy: this.openWorldBusy,
				sessionId: this.worldSessionId,
				world: this.world,
				resolution: this.lastResolution,
				muted: isAudioMuted(),
				voice: this.captionVoice?.status,
				selectedObject: this.selectedInteractable?.name ?? null,
				caption: this.lastOpenWorldCaption ?? null,
				imagePrompt: this.lastOpenWorldImagePrompt ?? null,
				imageEditMs: this.lastImageEditMs ?? null,
			},
			hermes: this.hermesSprite
				? {
						x: Math.round(this.hermesSprite.x),
						y: Math.round(this.hermesSprite.y),
						scale: Number(this.hermesSprite.scaleX.toFixed(4)),
						baseScale: Number(this.hermesSprite.getBaseScale().toFixed(4)),
						className: this.hermesSprite.constructor.name,
						motionState: this.hermesMotionState,
						animationState: this.hermesSprite.getAnimationState(),
						animationKey: this.hermesSprite.anims.currentAnim?.key ?? null,
						textureKey: this.hermesSprite.texture.key,
						displayHeight: Math.round(this.hermesSprite.displayHeight),
						bounds: hermesBounds
							? {
									x: Math.round(hermesBounds.x),
									y: Math.round(hermesBounds.y),
									width: Math.round(hermesBounds.width),
									height: Math.round(hermesBounds.height),
								}
							: null,
					}
				: null,
			kat: {
				visible: Boolean(
					this.katSprite?.visible || this.katSeatedSprite?.visible,
				),
				seatedVisible: Boolean(this.katSeatedSprite?.visible),
				standingVisible: Boolean(this.katSprite?.visible),
			},
			katState: this.activeCharacterStates.kat ?? scene.characters.kat?.state,

			lastTransition: this.lastReviewTransition,
			hotspots: this.getHotspots().map((hotspot) => ({
				id: hotspot.id,
				name: hotspot.name,
				bounds: {
					x: hotspot.bounds.x,
					y: hotspot.bounds.y,
					width: hotspot.bounds.width,
					height: hotspot.bounds.height,
				},
				verbs: hotspot.verbs,
			})),
			groundLine: this.groundLineManager?.getPoints() ?? [],
			placementDebug: {
				enabled: this.placementDebugEnabled,
				labelCount: this.placementDebugLabels.length,
			},
			output: this.reviewOutput,
		};
	}

	private renderCommands(): void {
		for (const object of this.commandObjects) object.destroy();
		this.commandObjects = [];

		if (this.snapshot.ended) {
			this.addButton(28, 124, 260, "Restart", () => {
				localStorage.removeItem(SAVE_KEY);
				this.scene.restart();
			});
			return;
		}

		if (this.snapshot.choices.length > 0) {
			this.snapshot.choices.forEach((choice, index) => {
				this.addButton(28, 124 + index * 54, 820, choice.text, () => {
					this.snapshot = this.runtime.choose(choice.index);
					this.renderSnapshot();
				});
			});
			return;
		}

		this.addButton(28, 124, 168, "Look around", () => {
			this.snapshot = this.runtime.look();
			this.renderSnapshot();
		});

		let y = 190;
		for (const hotspot of this.snapshot.scene?.hotspots ?? []) {
			this.addLabel(28, y, hotspot.name);
			let x = 300;
			for (const verb of VERBS) {
				if (!hotspot.actions[verb]?.length) continue;
				this.addButton(x, y - 8, 120, verb.toLowerCase(), () => {
					this.snapshot = this.runtime.perform(hotspot.id, verb);
					this.renderSnapshot();
				});
				x += 132;
			}
			y += 54;
		}
	}

	private addLabel(x: number, y: number, text: string): void {
		const label = this.add.text(x, y, text, {
			color: "#f8e7b8",
			fontFamily: '"Courier New", monospace',
			fontSize: "20px",
		});
		label.setDepth(PANEL_DEPTH + 1);
		this.commandObjects.push(label);
	}

	private addButton(
		x: number,
		y: number,
		width: number,
		text: string,
		onClick: () => void,
	): void {
		const rect = this.add
			.rectangle(x, y, width, 38, 0x15242a, 0.94)
			.setOrigin(0, 0);
		rect.setStrokeStyle(1, 0x7aa6a8, 0.85);
		rect.setInteractive({ useHandCursor: true });
		rect.on("pointerover", () => rect.setFillStyle(0x254149, 0.98));
		rect.on("pointerout", () => rect.setFillStyle(0x15242a, 0.94));
		rect.on("pointerdown", onClick);
		rect.setDepth(PANEL_DEPTH + 1);

		const label = this.add.text(x + 14, y + 9, text, {
			color: "#f4f0df",
			fontFamily: '"Courier New", monospace',
			fontSize: "16px",
			wordWrap: { width: width - 28 },
		});
		label.setDepth(PANEL_DEPTH + 2);
		this.commandObjects.push(rect, label);
	}

	private saveState(): void {
		localStorage.setItem(SAVE_KEY, JSON.stringify(this.snapshot.state));
		void this.saveStateToApi();
	}

	private loadState(): StoryRuntimeSnapshot["state"] | undefined {
		const raw = localStorage.getItem(SAVE_KEY);
		if (!raw) return undefined;
		try {
			return JSON.parse(raw) as StoryRuntimeSnapshot["state"];
		} catch {
			return undefined;
		}
	}

	private async saveStateToApi(): Promise<void> {
		try {
			const sessionId = await this.getSessionId();
			await fetch(`${API_BASE_URL}/session/${sessionId}`, {
				method: "PATCH",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ save: this.snapshot.state }),
			});
		} catch {
			// Local storage is the offline/dev fallback. API save is best-effort.
		}
	}

	private async getSessionId(): Promise<string> {
		const existing = localStorage.getItem(SESSION_KEY);
		if (existing) return existing;

		const response = await fetch(`${API_BASE_URL}/session`, { method: "POST" });
		if (!response.ok) throw new Error("Unable to create save session");
		const session = (await response.json()) as { id: string };
		localStorage.setItem(SESSION_KEY, session.id);
		return session.id;
	}
}
