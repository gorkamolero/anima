import {
	BaseScene,
	Character,
	type CharacterAnimationState,
	type CharacterAnimConfig,
	type HotspotVerb,
	type SceneConfig,
} from "@anima/engine";
import {
	parseStoryScript,
	StoryRuntime,
	type StoryRuntimeSnapshot,
	type StoryVerb,
	validateStoryGraph,
} from "@anima/storyscript";
import fullGameStory from "../../../story/full_game.story?raw";
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
const REVIEW_SCENE_KEY = "anima.shadow-over-innsmouth.review-scene";
const API_BASE_URL =
	import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001/api";
const VERBS: StoryVerb[] = ["LOOK", "TALK", "USE"];
const PANEL_DEPTH = 100;
const CHARACTER_DEPTH = 24;
const HERMES_WALK_SPEED = 300;
// Vehicles cut out of the exterior composite, redrawn as an overlay.
// Depth is y-sorted per frame: on the dock (feet at y >= VEHICLE_GROUND_Y)
// Hermes walks IN FRONT of the vehicles and covers them; deeper than their
// ground contact he passes BEHIND and the overlay occludes him.
const VEHICLE_OVERLAY_DEPTH = 60;
const HERMES_FRONT_DEPTH = VEHICLE_OVERLAY_DEPTH + 5;
const VEHICLE_GROUND_Y = 910;
const TITLE_BAR_HEIGHT = 56;
const OUTPUT_PANEL_HEIGHT = 116;
const HERMES_TEXTURE = "hermes-fal-veo-transparent-loop";
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

interface NarrationResolution {
	caption: string;
	statePatch: Record<string, string | boolean>;
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
	private hermesPathState?: {
		points: ScenePoint[];
		index: number;
		resolve: () => void;
	};
	private commandObjects: Phaser.GameObjects.GameObject[] = [];
	private placementDebugEnabled = true;
	private placementDebugGraphics?: Phaser.GameObjects.Graphics;
	private placementDebugLabels: Phaser.GameObjects.Text[] = [];
	private interactables: SceneInteractable[] = [];
	private hoveredInteractableName?: string;
	private selectedInteractable?: SceneInteractable;
	private openWorldBusy = false;
	private lastOpenWorldCaption?: string;
	private lastOpenWorldImagePrompt?: string;
	private lastImageEditMs?: number;

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
		void this.loadInteractables();

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

		const hermesAnimConfig: CharacterAnimConfig = {
			walk: {
				key: `${HERMES_TEXTURE}-walk`,
				frames: { start: 0, end: 29 },
				frameRate: 16,
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
		this.updateHermesPath(delta);
		// Y-sort against the vehicle overlay: on the dock he covers the
		// vehicles; deeper than their ground contact they cover him.
		this.hermesSprite?.setDepth(
			this.hermesSprite.y >= VEHICLE_GROUND_Y
				? HERMES_FRONT_DEPTH
				: CHARACTER_DEPTH,
		);
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

	private renderReviewScene(): void {
		const scene = REVIEW_SCENES[this.reviewSceneId];
		this.hoveredInteractableName = undefined;
		this.applySceneGroundLine(scene);
		this.setSceneBackground(scene.background);
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

		const scene = REVIEW_SCENES[this.reviewSceneId];
		const points = scene.groundLine.points;
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
			const linePosition = this.getGroundLinePosition(hermes.x, hermes.scale);
			this.hermesSprite?.setBaseScale(hermes.scale);
			this.hermesSprite
				?.setVisible(hermes.visible !== false)
				.setPosition(hermes.x, linePosition.y ?? hermes.y)
				.setScale(linePosition.scale ?? hermes.scale)
				.setFlipX(hermes.flipX ?? this.hermesFacing === -1);
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

	private getGroundLinePosition(
		x: number,
		baseScale: number,
	): { y?: number; scale?: number } {
		return (
			this.groundLineManager?.getGroundLine()?.getPositionData(x, baseScale) ??
			{}
		);
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
		const scene = REVIEW_SCENES[this.reviewSceneId];
		const interactable = this.findInteractableAtPoint(pointer.x, pointer.y);
		if (interactable) {
			void this.requestNarrationOptions(interactable);
			return;
		}
		const hotspot = this.findHotspotAtPoint(pointer.x, pointer.y);
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
		const freeWalkBounds = scene.freeWalkBounds ?? {
			minX: 140,
			maxX: this.scale.width - 140,
			minY: scene.id === "inside" ? 700 : 760,
			maxY: undefined,
		};
		const boundedX = Phaser.Math.Clamp(
			pointer.x,
			freeWalkBounds.minX,
			freeWalkBounds.maxX,
		);
		const targetX = this.snapToFreeWalkRange(scene, boundedX);
		const hermes = this.getSceneCharacters(scene).hermes;
		const targetY = Phaser.Math.Clamp(
			pointer.y,
			freeWalkBounds.minY ?? (scene.id === "inside" ? 700 : 760),
			freeWalkBounds.maxY ?? hermes?.y ?? 890,
		);
		void this.walkHermesTo(targetX, targetY);
	}

	private snapToFreeWalkRange(scene: ReviewScene, x: number): number {
		const ranges = scene.freeWalkRanges;
		if (!ranges || ranges.length === 0) return x;
		if (ranges.some((range) => x >= range.minX && x <= range.maxX)) return x;

		return ranges
			.flatMap((range) => [range.minX, range.maxX])
			.reduce((nearest, candidate) =>
				Math.abs(candidate - x) < Math.abs(nearest - x) ? candidate : nearest,
			);
	}

	private updateReviewHotspotHover(): void {
		const scene = REVIEW_SCENES[this.reviewSceneId];
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
		const hotspot = this.findHotspotAtPoint(pointer.x, pointer.y);
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
		if (this.reviewSceneId !== "outside") return undefined;
		const normalizedX = x / this.scale.width;
		const normalizedY = y / this.scale.height;
		return this.interactables.find(({ bounds }) => {
			const [x0, y0, x1, y1] = bounds;
			return (
				normalizedX >= x0 &&
				normalizedX <= x1 &&
				normalizedY >= y0 &&
				normalizedY <= y1
			);
		});
	}

	private async loadInteractables(): Promise<void> {
		try {
			const response = await fetch(`${API_BASE_URL}/interactables/outside`);
			if (!response.ok) {
				throw new Error(`Interactables request failed: ${response.status}`);
			}
			const payload = (await response.json()) as {
				interactables?: SceneInteractable[];
			};
			this.interactables = payload.interactables ?? [];
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

	private async requestNarrationOptions(
		interactable: SceneInteractable,
	): Promise<void> {
		this.openWorldBusy = true;
		this.selectedInteractable = interactable;
		this.emitOpenWorldState({
			status: "loading",
			object: interactable.name,
		});

		try {
			const scene = REVIEW_SCENES[this.reviewSceneId];
			const response = await fetch(`${API_BASE_URL}/narrate`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					scene: scene.id,
					sceneDescription: scene.description,
					object: interactable.name,
					flags: this.snapshot.state.flags,
					mode: "options",
				}),
			});
			if (!response.ok) {
				throw new Error(`Narrator options failed: ${response.status}`);
			}
			const payload = (await response.json()) as {
				options: [string, string, string];
			};
			this.emitOpenWorldState({
				status: "options",
				object: interactable.name,
				options: payload.options,
			});
		} catch (error) {
			this.emitOpenWorldState({
				status: "error",
				message:
					error instanceof Error ? error.message : "Narrator request failed",
			});
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
			const scene = REVIEW_SCENES[this.reviewSceneId];
			const response = await fetch(`${API_BASE_URL}/narrate`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					scene: scene.id,
					sceneDescription: scene.description,
					object: interactable.name,
					choice,
					flags: this.snapshot.state.flags,
					mode: "resolve",
				}),
			});
			if (!response.ok) {
				throw new Error(`Narrator resolution failed: ${response.status}`);
			}
			const resolution = (await response.json()) as NarrationResolution;
			Object.assign(this.snapshot.state.flags, resolution.statePatch);
			this.reviewOutput = [resolution.caption];
			this.lastOpenWorldCaption = resolution.caption;
			this.outputText.setText(resolution.caption);
			this.lastOpenWorldImagePrompt = undefined;
			this.lastImageEditMs = undefined;

			if (resolution.visual.delta === "new") {
				this.lastOpenWorldImagePrompt = resolution.visual.imagePrompt;
				const startedAt = performance.now();
				const imageResponse = await fetch(`${API_BASE_URL}/scene-image`, {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						scene: scene.id,
						imagePrompt: resolution.visual.imagePrompt,
					}),
				});
				if (!imageResponse.ok) {
					throw new Error(`Scene image failed: ${imageResponse.status}`);
				}
				const image = (await imageResponse.json()) as { url: string };
				await this.swapBackgroundTexture(image.url);
				this.lastImageEditMs = Math.round(performance.now() - startedAt);
			}

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
		if (this.hermesSprite?.getAnimationState() !== state) {
			this.hermesSprite?.playAnimationState(state);
		}
	}

	private async walkHermesTo(
		x: number,
		y: number,
		options: { allowOffscreen?: boolean; hideOnArrival?: boolean } = {},
	): Promise<void> {
		const hermesSprite = this.hermesSprite;
		if (!hermesSprite) return;
		const linePosition = this.getGroundLinePosition(
			x,
			hermesSprite.getBaseScale(),
		);
		this.setHermesMotionState("walk");
		this.hermesFacing = x < hermesSprite.x ? -1 : 1;
		hermesSprite.faceDirection(x);
		const body = hermesSprite.body as Phaser.Physics.Arcade.Body | null;
		const hadWorldBoundsCollision = body?.collideWorldBounds ?? false;
		if (options.allowOffscreen) hermesSprite.setWorldBoundsCollision(false);
		try {
			await hermesSprite.walkToPosition(x, 0);
			hermesSprite.setPosition(x, linePosition.y ?? y);
			if (linePosition.scale) hermesSprite.setScale(linePosition.scale);
			if (options.hideOnArrival) hermesSprite.setVisible(false);
		} finally {
			hermesSprite.setWorldBoundsCollision(hadWorldBoundsCollision);
			this.setHermesMotionState("idle");
		}
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

	/**
	 * Walk a scripted path with the groundline suspended: each point's y and
	 * scaleFactor (x base scale) are honored, so the path can go deeper into
	 * the scene — around and behind the vehicle overlay. Blocks input while
	 * the path plays; groundline control resumes afterwards.
	 *
	 * Movement is driven from update() with the game-loop delta, NOT Phaser
	 * tweens: TweenManager runs on Date.now() wall-clock time, which makes
	 * tweened motion invisible to virtual-clock playtests and recordings.
	 */
	private async walkHermesPath(
		points: ScenePoint[],
		options: { hideOnArrival?: boolean } = {},
	): Promise<void> {
		const hermesSprite = this.hermesSprite;
		if (!hermesSprite || points.length === 0) return;
		this.groundLineManager?.suspendCharacter("hermes");
		this.inputBlocked = true;
		this.setHermesMotionState("walk");
		hermesSprite.setWorldBoundsCollision(false);
		try {
			await new Promise<void>((resolve) => {
				this.hermesPathState = { points, index: 0, resolve };
			});
			if (options.hideOnArrival) hermesSprite.setVisible(false);
		} finally {
			this.hermesPathState = undefined;
			this.inputBlocked = false;
			this.groundLineManager?.resumeCharacter("hermes");
			this.setHermesMotionState("idle");
		}
	}

	/** Advance the scripted path by one frame. Called from update(). */
	private updateHermesPath(delta: number): void {
		const state = this.hermesPathState;
		const hermesSprite = this.hermesSprite;
		if (!state || !hermesSprite) return;

		// Screen speed scales with depth: a figure walking away covers fewer
		// screen px per second, keeping his apparent gait constant.
		const depthFactor = hermesSprite.scaleX / hermesSprite.getBaseScale();
		let budget = HERMES_WALK_SPEED * depthFactor * (delta / 1000);
		while (budget > 0 && state.index < state.points.length) {
			const point = state.points[state.index];
			// Per-segment hurry (e.g. fully-occluded hops behind the bus).
			const step = budget * (point.speedFactor ?? 1);
			const distance = Phaser.Math.Distance.Between(
				hermesSprite.x,
				hermesSprite.y,
				point.x,
				point.y,
			);
			const targetScale =
				(point.scaleFactor ?? 1) * hermesSprite.getBaseScale();
			hermesSprite.faceDirection(point.x);
			if (distance <= step) {
				hermesSprite.setPosition(point.x, point.y);
				hermesSprite.setScale(targetScale);
				state.index++;
				budget -= distance / (point.speedFactor ?? 1);
			} else {
				const fraction = step / distance;
				hermesSprite.setPosition(
					hermesSprite.x + (point.x - hermesSprite.x) * fraction,
					hermesSprite.y + (point.y - hermesSprite.y) * fraction,
				);
				hermesSprite.setScale(
					hermesSprite.scaleX + (targetScale - hermesSprite.scaleX) * fraction,
				);
				budget = 0;
			}
		}

		if (state.index >= state.points.length) {
			this.hermesPathState = undefined;
			state.resolve();
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
		const scene = REVIEW_SCENES[sceneId];
		this.reviewSceneId = sceneId;
		this.activeCharacterStates = {};
		this.reviewOutput =
			this.reviewOutput.length > 0 ? this.reviewOutput : scene.output;
		localStorage.setItem(REVIEW_SCENE_KEY, sceneId);

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
			this.reviewSceneId = sceneId;
			this.reviewOutput = [];
			delete this.reviewCharacterOverrides[sceneId];
			this.setHermesMotionState("idle");
			localStorage.setItem(REVIEW_SCENE_KEY, sceneId);
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

		const scene = REVIEW_SCENES[this.reviewSceneId];
		const hermes = this.getSceneCharacters(scene).hermes;
		const baseScale = this.hermesSprite?.getBaseScale() ?? hermes?.scale ?? 0.4;
		const linePosition = this.getGroundLinePosition(x, baseScale);
		this.hermesSprite
			?.setVisible(true)
			.setPosition(x, linePosition.y ?? hermes?.y ?? 890)
			.setScale(linePosition.scale ?? baseScale)
			.setFlipX(options.flipX ?? this.hermesSprite.flipX);
		this.setHermesMotionState(options.motionState ?? "idle");
		this.refreshPlacementDebugOverlay();
		return this.getReviewQaSnapshot();
	}

	public getReviewQaSnapshot() {
		const scene = REVIEW_SCENES[this.reviewSceneId];
		const hermesBounds = this.hermesSprite?.getBounds();
		return {
			reviewSceneId: this.reviewSceneId,
			background: scene.background,
			backgroundTextureKey: this.background?.texture.key ?? null,
			interactables: this.interactables,
			openWorld: {
				busy: this.openWorldBusy,
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
