import {
	BaseScene,
	baselineYAt,
	bridgeOccluders,
	Character,
	type CharacterAnimationState,
	type CharacterAnimConfig,
	CharacterMotor,
	cellPoint,
	type Exit,
	erode,
	exitAt,
	findPath,
	floorPixel,
	type HotspotVerb,
	nearestReachable,
	type Occluder,
	refineMask,
	type SceneConfig,
	scaleAt,
	type WalkArea,
	type WalkDirection,
	walkAreaFromAnchor,
} from "@anima/engine";
import {
	parseStoryScript,
	StoryRuntime,
	type StoryRuntimeSnapshot,
	type StoryVerb,
	validateStoryGraph,
} from "@anima/storyscript";
import exteriorLandmarks from "../../../public/backgrounds/bus-station-kat-seated-composite-v1.landmarks.json";
import fullGameStory from "../../../story/full_game.story?raw";
import { isAudioMuted, speakCaption } from "../narratorVoice";
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
import { clipFloorBelow, type FloorMask } from "./worldGeometry";

const SAVE_KEY = "anima.shadow-over-innsmouth.save";
const SESSION_KEY = "anima.shadow-over-innsmouth.session";
const REVIEW_SCENE_KEY = "anima.shadow-over-innsmouth.review-scene";
const API_BASE_URL =
	import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001/api";
const VERBS: StoryVerb[] = ["LOOK", "TALK", "USE"];
const PANEL_DEPTH = 100;
const CHARACTER_DEPTH = 24;
// Vehicles cut out of the exterior composite, redrawn as an overlay.
// Depth is y-sorted per frame: on the dock (feet at y >= VEHICLE_GROUND_Y)
// Hermes walks IN FRONT of the vehicles and covers them; deeper than their
// ground contact he passes BEHIND and the overlay occludes him.
const VEHICLE_GROUND_Y = 910;
const VEHICLE_OVERLAY_DEPTH = 10 + VEHICLE_GROUND_Y / 20;
const TITLE_BAR_HEIGHT = 56;
const OUTPUT_PANEL_HEIGHT = 116;
// Lowest feet position: keeps Hermes clear of the caption panel.
const MAX_FEET_Y = 1080 - OUTPUT_PANEL_HEIGHT - 16;
const SHOW_DEBUG_OVERLAY =
	typeof window !== "undefined" &&
	new URLSearchParams(window.location.search).get("debug") === "1";
const HERMES_TEXTURE = "hermes-fal-veo-transparent-loop";
const HERMES_AWAY_TEXTURE = "hermes-walk-away";
const HERMES_TOWARD_TEXTURE = "hermes-walk-toward";
const HERMES_IDLE_TEXTURE = "hermes-idle-v2-normalized";
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
		kind: "anchor" | "new";
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
	private snapshot!: StoryRuntimeSnapshot;
	private background?: Phaser.GameObjects.Image;
	private vehicleOverlay?: Phaser.GameObjects.Image;
	private outputText!: Phaser.GameObjects.Text;
	private titleText!: Phaser.GameObjects.Text;
	private stateText!: Phaser.GameObjects.Text;
	private hermesSprite?: Character;
	private katSprite?: Phaser.GameObjects.Sprite;
	private katSeatedSprite?: Phaser.GameObjects.Sprite;
	private hermesFacing: 1 | -1 = 1;
	private walkArea?: WalkArea;
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
	private rootFrame = "";
	private objectLayers: {
		data: Occluder;
		image: Phaser.GameObjects.Image;
		alpha: (x: number, y: number) => boolean;
	}[] = [];
	private sceneExits: Exit[] = [];
	private exitLatch?: string;
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
			"bus-station-kat-seated",
			"backgrounds/bus-station-kat-seated-composite-v1.png",
		);
		this.load.image(
			"bus-station-vehicle-overlay",
			"backgrounds/bus-station-vehicle-overlay-v1.png",
		);
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
		this.load.spritesheet(
			HERMES_TEXTURE,
			"assets/sprites/hermes/hermes-fal-veo-transparent-loop.png",
			{ frameWidth: 612, frameHeight: 1059 },
		);
		this.load.json(
			`${HERMES_TEXTURE}-meta`,
			`assets/sprites/hermes/${HERMES_TEXTURE}.json`,
		);
		for (const texture of [HERMES_AWAY_TEXTURE, HERMES_TOWARD_TEXTURE]) {
			this.load.json(
				`${texture}-meta`,
				`assets/sprites/hermes/${texture}.json`,
			);
			this.load.spritesheet(texture, `assets/sprites/hermes/${texture}.png`, {
				frameWidth: 612,
				frameHeight: 1059,
			});
		}
		this.load.spritesheet(
			HERMES_IDLE_TEXTURE,
			"assets/sprites/hermes/hermes-idle-v2-normalized.png",
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
		const graph = parseStoryScript(fullGameStory);
		const diagnostics = validateStoryGraph(graph);
		const savedState = this.loadState();

		this.runtime = new StoryRuntime(graph, savedState);
		this.snapshot = this.runtime.start();
		if (diagnostics.length > 0) {
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
		void this.restoreWorld();

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

	private createLayout(): void {
		const { width, height } = this.scale;

		this.add.rectangle(0, 0, width, height, 0x0f1115).setOrigin(0, 0);
		this.background = this.add.image(width / 2, height / 2, "bus-station");
		this.vehicleOverlay = this.add
			.image(width / 2, height / 2, "bus-station-vehicle-overlay")
			.setDepth(VEHICLE_OVERLAY_DEPTH)
			.setVisible(false);
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
				height - OUTPUT_PANEL_HEIGHT,
				width,
				OUTPUT_PANEL_HEIGHT,
				0x050608,
				0.76,
			)
			.setOrigin(0, 0)
			.setDepth(PANEL_DEPTH);
		this.outputText = this.add.text(28, height - OUTPUT_PANEL_HEIGHT + 16, "", {
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

		for (const texture of [HERMES_AWAY_TEXTURE, HERMES_TOWARD_TEXTURE]) {
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
				frames: { start: 0, end: 5 },
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
					10 + baselineYAt(layer.data, this.hermesSprite.x) / 20 - 0.001,
				);
			// Scene update follows Phaser's normal pre-update depth sort. Flush
			// changed baselines now so this captured frame uses its own order.
			this.children.depthSort();
			const exit = exitAt(this.hermesSprite, this.sceneExits);
			if (!exit) this.exitLatch = undefined;
			if (
				exit &&
				exit.id !== this.exitLatch &&
				wasWalking &&
				!this.approachingObject &&
				!this.openWorldBusy
			) {
				this.exitLatch = exit.id;
				this.hermesMotor.stop();
				void this.triggerExit(exit);
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
			await this.restoreLocationImage();
		} finally {
			this.openWorldBusy = alreadyBusy;
		}
	}

	private renderReviewScene(): void {
		const scene = this.activeScene();
		this.geometryGeneration++;
		for (const layer of this.objectLayers) layer.image.destroy();
		this.objectLayers = [];
		this.sceneExits = [];
		this.hoveredInteractableName = undefined;
		this.applySceneGroundLine(scene);
		const ground = this.generatedPlace?.ground;
		this.walkArea = ground
			? {
					mask: refineMask(ground.floor),
					perspective: {
						horizonY: ground.horizonY,
						slope: ground.scaleSlope,
						pixelsPerMetre: (ground.baseScale * 1059) / 1.75,
					},
					baseScale: ground.baseScale,
					scaleClamp: { min: 0.18, max: 1.5 },
				}
			: walkAreaFromAnchor(
					scene,
					this.reviewSceneId === "outside" ? exteriorLandmarks : {},
					1080,
				);
		this.visibleFloor = {
			...this.walkArea.mask,
			data: [...this.walkArea.mask.data],
		};
		this.walkArea.mask = clipFloorBelow(
			erode(this.walkArea.mask, this.walkArea.perspective),
			MAX_FEET_Y,
		);
		if (this.hermesSprite) {
			this.hermesMotor?.detach();
			this.hermesMotor = new CharacterMotor(
				this.hermesSprite,
				this.walkArea,
				(state, heading, rate) => {
					this.hermesWalkDirection = heading;
					this.hermesFacing = heading === "right" ? 1 : -1;
					this.setHermesMotionState(state);
					if (this.hermesSprite) this.hermesSprite.anims.timeScale = rate;
				},
			);
			this.hermesMotor.rootStep = (_direction, tangent) => {
				const sprite = this.hermesSprite;
				if (!sprite) return 0;
				const key = sprite.texture.key;
				const frame = Number(sprite.frame.name);
				const token = `${key}:${frame}`;
				if (token === this.rootFrame) return 0;
				this.rootFrame = token;
				const metadata = this.cache.json.get(`${key}-meta`) as {
					rootMotion?: { dx: number; dy: number }[];
				};
				const motion = metadata?.rootMotion?.[frame];
				if (!motion) return 0;
				const sign = sprite.flipX ? -1 : 1;
				let pixels =
					(motion.dx * sign * tangent.x + motion.dy * tangent.y) *
					sprite.scaleX;
				// Account for the contact's offset from the bottom-centred sprite origin
				// when perspective changes scale during this very frame.
				const contact = (
					metadata as { footContacts?: { x: number; y: number }[] }
				).footContacts?.[frame];
				if (contact && this.walkArea) {
					for (let i = 0; i < 3; i++) {
						const nextScale =
							this.walkArea.baseScale *
							scaleAt(
								this.walkArea.perspective,
								{
									x: sprite.x + tangent.x * pixels,
									y: sprite.y + tangent.y * pixels,
								},
								this.walkArea.scaleClamp,
							);
						pixels =
							(motion.dx * sign * tangent.x + motion.dy * tangent.y) *
								sprite.scaleX -
							((contact.x - 306) * sign * tangent.x +
								(contact.y - 1059) * tangent.y) *
								(nextScale - sprite.scaleX);
					}
				}
				return pixels;
			};
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
		const graphics = this.placementDebugGraphics;
		if (!graphics) return;
		graphics.clear();
		this.clearPlacementDebugLabels();
		if (!this.placementDebugEnabled || !this.reviewSceneId) return;

		const scene = this.activeScene();
		const points = scene.groundLine.points;
		graphics.lineStyle(2, 0xff66dd, 0.9);
		for (const exit of this.sceneExits) {
			graphics.strokePoints(exit.region, true);
			if (exit.region[0])
				this.addPlacementDebugLabel(
					exit.region[0].x,
					exit.region[0].y,
					exit.id,
					"#ff66dd",
				);
		}
		for (const layer of this.objectLayers)
			graphics.strokePoints(layer.data.baseline, false);
		if (points.length > 1) {
			graphics.lineStyle(3, 0x4de8ff, 0.88);
			graphics.beginPath();
			graphics.moveTo(points[0].x, points[0].y);
			for (const point of points.slice(1)) graphics.lineTo(point.x, point.y);
			graphics.strokePath();
		}

		for (const point of points) {
			graphics.fillStyle(0xffd166, 0.94);
			graphics.fillCircle(point.x, point.y, 7);
			graphics.lineStyle(2, 0x111111, 0.82);
			graphics.strokeCircle(point.x, point.y, 7);
			this.addPlacementDebugLabel(
				point.x + 10,
				point.y - 28,
				`${point.x},${point.y} x${(point.scaleFactor ?? 1).toFixed(3)}`,
				"#ffe7a3",
			);
		}

		const hermes = this.hermesSprite;
		if (hermes?.visible) {
			const bounds = hermes.getBounds();
			graphics.lineStyle(2, 0x7cff80, 0.92);
			graphics.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
			graphics.lineStyle(2, 0xff4d6d, 0.92);
			graphics.lineBetween(hermes.x - 22, hermes.y, hermes.x + 22, hermes.y);
			graphics.lineBetween(hermes.x, hermes.y - 22, hermes.x, hermes.y + 22);
			this.addPlacementDebugLabel(
				Math.min(hermes.x + 18, this.scale.width - 280),
				Math.max(bounds.y + 8, TITLE_BAR_HEIGHT + 8),
				[
					`Hermes ${Math.round(hermes.x)},${Math.round(hermes.y)}`,
					`scale ${hermes.scaleX.toFixed(4)} base ${hermes.getBaseScale().toFixed(3)}`,
					`h ${Math.round(hermes.displayHeight)} ${this.hermesMotionState}`,
					`anim ${hermes.anims.currentAnim?.key ?? "none"}`,
				].join("\n"),
				"#b9ffbf",
			);
		}
	}

	private renderSceneHotspots(scene: ReviewScene): void {
		for (const hotspot of this.hotspots) hotspot.destroy();
		this.hotspots = [];

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
		this.vehicleOverlay?.setVisible(textureKey === "bus-station-kat-seated");
		this.fitBackgroundToScreen();
	}

	private fitBackgroundToScreen(): void {
		const { width, height } = this.scale;
		this.background
			?.setPosition(width / 2, height / 2)
			.setDisplaySize(width, height);
		// Same full-canvas stretch as the background so the cutout stays
		// pixel-aligned with the vehicles it was cut from.
		this.vehicleOverlay
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
		if (!this.hermesSprite?.visible || this.inputBlocked || this.openWorldBusy)
			return;
		if (pointer.y < TITLE_BAR_HEIGHT || pointer.y > MAX_FEET_Y) return;
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
		if (
			pointer.y < TITLE_BAR_HEIGHT ||
			pointer.y > this.scale.height - OUTPUT_PANEL_HEIGHT
		) {
			return;
		}
		void this.walkGenerated(pointer.x, pointer.y);
	}

	/** Read-only path preview for editor and click-to-walk verification. */
	public previewWalk(x: number, y: number): ScenePoint[] {
		return this.walkArea && this.hermesSprite
			? findPath(this.walkArea.mask, this.hermesSprite, { x, y })
			: [];
	}
	/** Both authored and generated free walks use the same navigation. */
	public async walkGenerated(x: number, y: number): Promise<void> {
		const area = this.walkArea,
			sprite = this.hermesSprite;
		if (!area || !sprite || this.inputBlocked) return;
		const path = this.previewWalk(x, y);
		await this.walkHermesPath(path);
	}

	private updateReviewHotspotHover(): void {
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
		if (this.visibleFloor && floorPixel(this.visibleFloor, x, y))
			return undefined;
		const normalizedX = x / this.scale.width;
		const normalizedY = y / this.scale.height;
		return this.interactables.find(({ name, bounds }) => {
			const layer = this.objectLayers.find(
				(l) => l.data.label.toLowerCase() === name.toLowerCase(),
			);
			if (layer) return layer.alpha(x, y);
			const [x0, y0, x1, y1] = bounds;
			return (
				normalizedX >= x0 &&
				normalizedX <= x1 &&
				normalizedY >= y0 &&
				normalizedY <= y1
			);
		});
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
			await this.enterLocation(this.world.location);
		} catch (error) {
			this.emitOpenWorldState({ status: "error", message: String(error) });
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
			this.optionsCache.clear();
			if (this.dwellTimer) clearTimeout(this.dwellTimer);
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
			exits: Exit[];
		};
		const base =
			this.currentImage ??
			`${window.location.origin}/backgrounds/${this.reviewSceneId === "outside" ? "bus-station-kat-seated-composite-v1" : "arkham-bus-depot-flat-2d"}.png`;
		const loaded = await Promise.all(
			data.occluders.map(async (object) => {
				const url = new URL(object.png, base).href;
				const img = new Image();
				img.crossOrigin = "anonymous";
				await new Promise<void>((resolve, reject) => {
					img.onload = () => resolve();
					img.onerror = () =>
						reject(new Error(`Occluder image failed: ${object.id}`));
					img.src = url;
				});
				const canvas = document.createElement("canvas");
				canvas.width = img.width;
				canvas.height = img.height;
				const context = canvas.getContext("2d");
				if (!context) throw new Error("No mask context");
				context.drawImage(img, 0, 0);
				const pixels = context.getImageData(0, 0, img.width, img.height).data;
				const alpha = (x: number, y: number) => {
					const cx = Math.floor(
							((x - object.bbox.x) * img.width) / object.bbox.w,
						),
						cy = Math.floor(((y - object.bbox.y) * img.height) / object.bbox.h);
					return (
						cx >= 0 &&
						cy >= 0 &&
						cx < img.width &&
						cy < img.height &&
						pixels[(cy * img.width + cx) * 4 + 3] > 127
					);
				};
				return { object, url, img, alpha };
			}),
		);
		if (generation !== this.geometryGeneration) return;
		for (const layer of this.objectLayers) layer.image.destroy();
		this.objectLayers = [];
		this.vehicleOverlay?.setVisible(false);
		const layerArea = this.walkArea;
		for (const { object, url, img, alpha } of loaded) {
			const canOverlap =
				!layerArea ||
				layerArea.mask.data.some((v, i) => {
					if (!v) return false;
					const p = cellPoint(layerArea.mask, i);
					const scale =
						layerArea.baseScale *
						scaleAt(layerArea.perspective, p, layerArea.scaleClamp);
					return (
						p.y >= object.bbox.y &&
						p.y - 1059 * scale <= object.bbox.y + object.bbox.h &&
						p.x + 306 * scale >= object.bbox.x &&
						p.x - 306 * scale <= object.bbox.x + object.bbox.w
					);
				});
			if (!this.textures.exists(url)) this.textures.addImage(url, img);
			this.objectLayers.push({
				data: object,
				alpha,
				image: this.add
					.image(object.bbox.x, object.bbox.y, url)
					.setOrigin(0)
					.setDisplaySize(object.bbox.w, object.bbox.h)
					.setVisible(canOverlap),
			});
		}
		if (this.visibleFloor && this.walkArea) {
			const bridged = {
				...this.visibleFloor,
				data: [...this.visibleFloor.data],
			};
			bridgeOccluders(bridged, this.objectLayers);
			this.walkArea.mask = clipFloorBelow(
				erode(bridged, this.walkArea.perspective),
				MAX_FEET_Y,
			);
		}
		this.sceneExits = data.exits;
		if (!this.generatedPlace) {
			for (const hotspot of this.activeScene().hotspots) {
				const action = hotspot.actions.USE;
				if (!action?.transitionTo || !hotspot.approach) continue;
				const point = action.moveTo ?? hotspot.approach;
				this.sceneExits = this.sceneExits.filter((e) => e.kind !== "door");
				this.sceneExits.unshift({
					id: hotspot.id,
					kind: "door",
					label: hotspot.name,
					to: action.transitionTo,
					region: [
						{ x: point.x - 10, y: point.y - 10 },
						{ x: point.x + 10, y: point.y - 10 },
						{ x: point.x + 10, y: point.y + 10 },
						{ x: point.x - 10, y: point.y + 10 },
					],
				});
			}
		}
		// Caption clipping and footprint erosion can put a raw threshold just
		// outside the navigable mask. Its reachable approach is the trigger.
		const exitMask = this.walkArea?.mask;
		if (exitMask)
			this.sceneExits = this.sceneExits.map((exit) => {
				const center = {
					x: exit.region.reduce((n, p) => n + p.x, 0) / exit.region.length,
					y: exit.region.reduce((n, p) => n + p.y, 0) / exit.region.length,
				};
				// Authored doors stay at their doorway. Generated return edges
				// need an approach in the player's reachable floor component.
				const cell = nearestReachable(
					exitMask,
					exit.kind === "door" ? center : (this.hermesSprite ?? center),
					center,
				);
				if (cell < 0) return exit;
				const point = cellPoint(exitMask, cell);
				return {
					...exit,
					region: [
						{ x: point.x - 8, y: point.y - 8 },
						{ x: point.x + 8, y: point.y - 8 },
						{ x: point.x + 8, y: point.y + 8 },
						{ x: point.x - 8, y: point.y + 8 },
					],
				};
			});
		this.exitLatch = this.hermesSprite
			? exitAt(this.hermesSprite, this.sceneExits)?.id
			: undefined;
	}

	private async approachObject(
		object: SceneInteractable,
		x: number,
	): Promise<void> {
		const layer = this.objectLayers.find(
			(l) => l.data.label.toLowerCase() === object.name.toLowerCase(),
		);
		const generation = this.geometryGeneration;
		const y = layer
			? baselineYAt(layer.data, x) + 5
			: object.bounds[3] * 1080 + 5;
		const mask = this.walkArea?.mask;
		if (!mask) return;
		const candidates = mask.data
			.flatMap((v, i) => (v ? [cellPoint(mask, i)] : []))
			.filter((p) => !layer || p.y >= baselineYAt(layer.data, p.x));
		candidates.sort(
			(a, b) => Math.hypot(a.x - x, a.y - y) - Math.hypot(b.x - x, b.y - y),
		);
		let path: ScenePoint[] = [];
		for (const point of candidates.slice(0, 128)) {
			const candidate = this.previewWalk(point.x, point.y);
			const end = candidate[candidate.length - 1];
			if (end && Math.hypot(end.x - point.x, end.y - point.y) < 1) {
				path = candidate;
				break;
			}
		}
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

	private async triggerExit(exit: Exit): Promise<void> {
		try {
			if (exit.to) {
				await this.enterLocation(exit.to);
				return;
			}
			if (exit.kind === "edge-left" || exit.kind === "edge-right") {
				if (this.generatedPlace)
					await this.enterLocation(
						this.generatedPlace.neighbours?.[exit.kind] ??
							this.generatedPlace.parent,
					);
				return;
			}
			if (exit.kind === "far") {
				this.selectedInteractable = {
					name: exit.label ?? "road ahead",
					bounds: [0, 0, 1, 1],
				};
				await this.resolveNarration(
					"I continue down the road to the next place.",
				);
			}
		} catch (error) {
			this.emitOpenWorldState({ status: "error", message: String(error) });
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
		const interactable = this.selectedInteractable;
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
				if (travel.kind === "anchor") {
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
		} finally {
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
		const direction = this.hermesWalkDirection;
		const texture =
			direction === "away"
				? HERMES_AWAY_TEXTURE
				: direction === "toward"
					? HERMES_TOWARD_TEXTURE
					: HERMES_TEXTURE;
		if (state === "walk") {
			sprite.playAnimationState(state, `${texture}-walk`);
			sprite.setFlipX(direction === "right");
		} else {
			sprite.anims.timeScale = 1;
			sprite.playAnimationState(state);
			if (
				state === "idle" &&
				(direction === "away" || direction === "toward")
			) {
				sprite.anims.stop();
				sprite.setTexture(texture, 0).setFlipX(false);
			} else sprite.setFlipX(direction === "right");
		}
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
		options: { hideOnArrival?: boolean } = {},
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
		options: { hideOnArrival?: boolean } = {},
	): Promise<void> {
		if (!this.hermesMotor || !this.hermesSprite || !points.length) return;
		this.inputBlocked = true;
		this.hermesSprite.setWorldBoundsCollision(false);
		try {
			await this.hermesMotor.walk(points);
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
		const setScene = (sceneId: ReviewSceneId) => {
			this.generatedPlace = undefined;
			this.reviewSceneId = sceneId;
			this.reviewOutput = [];
			delete this.reviewCharacterOverrides[sceneId];
			this.setHermesMotionState("idle");
			localStorage.setItem(REVIEW_SCENE_KEY, sceneId);
			if (this.world)
				void this.patchWorld({ location: sceneId }).then(() =>
					this.restoreLocationImage(),
				);
			this.renderReviewScene();
		};
		const onSceneChange = (event: Event) => {
			const sceneId = (event as CustomEvent<ReviewSceneId>).detail;
			if (sceneId === "outside" || sceneId === "inside") setScene(sceneId);
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
						textureKey:
							this.hermesSprite.anims.currentFrame?.textureKey ??
							this.hermesSprite.texture.key,
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
			vehicleOverlay: this.vehicleOverlay
				? {
						visible: this.vehicleOverlay.visible,
						depth: this.vehicleOverlay.depth,
					}
				: null,
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
