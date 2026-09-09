import { GameObjects, Geom } from "phaser";
import { Character } from "../characters/Character";
import type { BaseScene } from "../scenes/BaseScene";
import {
	type ArtReport,
	type LandmarksFile,
	verifySceneArt,
} from "../verification/ArtLandmarks";

/**
 * Snapshot of everything an agent needs to reason about a running scene.
 * All coordinates are in game space (1920x1080 by convention).
 */
export interface AgentSceneSnapshot {
	sceneKey: string;
	displayName: string;
	camera: { scrollX: number; scrollY: number };
	characters: Array<{
		id: string;
		x: number;
		y: number;
		scale: number;
		baseScale: number;
		depth: number;
		visible: boolean;
		flipX: boolean;
		displayHeight: number;
		animationState: string;
		animationKey: string | null;
		textureKey: string;
		bounds: { x: number; y: number; width: number; height: number };
	}>;
	hotspots: Array<{
		id: string;
		name: string;
		verbs: string[];
		bounds: { x: number; y: number; width: number; height: number };
	}>;
	groundLine: Array<{ x: number; y: number; scaleFactor?: number }>;
	inputBlocked: boolean;
}

/**
 * Agent-facing debug API, installed on `window.__anima` by BaseScene.
 *
 * Exists because agents (and CI) usually drive the game from a hidden or
 * headless tab where requestAnimationFrame never fires, and where synthetic
 * PointerEvents are ignored by Phaser (it listens for mouse/touch events).
 * Everything here works without RAF and without a visible tab.
 */
export interface AgentDebugApi {
	/** The active BaseScene (last one to run create()). */
	scene: BaseScene;
	/** Advance the game loop by `ms` of virtual time, frame by frame. */
	step(ms: number): void;
	/** Click at game coordinates. Dispatches the mouse events Phaser listens for. */
	click(x: number, y: number): void;
	/** Move the pointer to game coordinates (hover). */
	hover(x: number, y: number): void;
	/** Structured dump of the active scene. */
	snapshot(): AgentSceneSnapshot;
	/**
	 * Pump virtual frames until `predicate(snapshot)` is true.
	 * Yields to the microtask queue between frames so awaited game logic
	 * (walk promises, transitions) can progress. Rejects after `timeoutMs`
	 * of virtual time.
	 */
	waitUntil(
		predicate: (snapshot: AgentSceneSnapshot) => boolean,
		options?: { timeoutMs?: number; stepMs?: number },
	): Promise<AgentSceneSnapshot>;
	/**
	 * Verify the live scene against a background's landmarks file
	 * (`backgrounds/<name>.landmarks.json`). Pass the file contents, or a
	 * URL to fetch it from. Reports every scale/bounds disagreement with
	 * the value to use instead.
	 */
	verifyArt(
		landmarks: LandmarksFile | string,
		options?: {
			characterHeightsM?: Record<string, number>;
			defaultHeightM?: number;
			referenceCharacterId?: string;
		},
	): Promise<ArtReport>;
	/**
	 * Advance one output frame of virtual time and capture the rendered
	 * canvas as a JPEG data URL. Deterministic: N calls at stepMs=33.33
	 * produce exactly N frames of 30fps video regardless of tab visibility.
	 * Feed the frames to ffmpeg for an mp4 (see scripts/record-journey.mjs).
	 */
	captureFrame(options?: {
		stepMs?: number;
		width?: number;
		quality?: number;
	}): Promise<string>;
	/**
	 * Visibility oracle: how much of a character the player can actually
	 * see, computed from geometry + texture alpha — no rendering, no
	 * screenshots. Samples the character's own silhouette (its alpha over
	 * its bounds), then tests each body point against every visible,
	 * higher-depth textured object. Staging claims ("hidden behind the
	 * bus", "head shows above the car") become numeric assertions on the
	 * returned fraction instead of eyeballed video frames.
	 */
	visibility(characterId: string): {
		fraction: number;
		bodyPoints: number;
		occluders: string[];
	};
}

/**
 * Alpha of a textured object at a world point (0 if outside its bounds).
 * Maps world -> frame-local pixels through the object's bounds, honoring
 * flip, so stretched overlays and spritesheet frames both work.
 */
function textureAlphaAt(
	object: GameObjects.Image | GameObjects.Sprite,
	worldX: number,
	worldY: number,
): number {
	const bounds = object.getBounds();
	if (!bounds.contains(worldX, worldY)) return 0;
	const frame = object.frame;
	let frameX = ((worldX - bounds.x) / bounds.width) * frame.width;
	let frameY = ((worldY - bounds.y) / bounds.height) * frame.height;
	if (object.flipX) frameX = frame.width - frameX;
	if (object.flipY) frameY = frame.height - frameY;
	return (
		object.scene.textures.getPixelAlpha(
			Math.floor(frameX),
			Math.floor(frameY),
			frame.texture.key,
			frame.name,
		) ?? 0
	);
}

function measureVisibility(
	scene: BaseScene,
	characterId: string,
): { fraction: number; bodyPoints: number; occluders: string[] } {
	const character = scene.children
		.getAll()
		.find(
			(child): child is Character =>
				child instanceof Character && child.getCharacterId() === characterId,
		);
	if (!character || !character.visible) {
		return { fraction: 0, bodyPoints: 0, occluders: [] };
	}

	const bounds = character.getBounds();
	const occluders = scene.children
		.getAll()
		.filter(
			(child): child is GameObjects.Image | GameObjects.Sprite =>
				child !== character &&
				(child instanceof GameObjects.Image ||
					child instanceof GameObjects.Sprite) &&
				child.visible &&
				child.depth > character.depth &&
				Geom.Rectangle.Overlaps(child.getBounds(), bounds),
		);

	const COLS = 7;
	const ROWS = 12;
	let bodyPoints = 0;
	let visiblePoints = 0;
	const hitOccluders = new Set<string>();
	for (let row = 0; row < ROWS; row++) {
		for (let col = 0; col < COLS; col++) {
			const worldX = bounds.x + ((col + 0.5) / COLS) * bounds.width;
			const worldY = bounds.y + ((row + 0.5) / ROWS) * bounds.height;
			// Only points on the character's actual silhouette count as body.
			if (textureAlphaAt(character, worldX, worldY) < 64) continue;
			bodyPoints++;
			const coveredBy = occluders.find(
				(occluder) => textureAlphaAt(occluder, worldX, worldY) > 64,
			);
			if (coveredBy) {
				hitOccluders.add(coveredBy.texture.key);
			} else {
				visiblePoints++;
			}
		}
	}

	return {
		fraction: bodyPoints > 0 ? visiblePoints / bodyPoints : 0,
		bodyPoints,
		occluders: [...hitOccluders],
	};
}

function rect(bounds: Phaser.Geom.Rectangle) {
	return {
		x: Math.round(bounds.x),
		y: Math.round(bounds.y),
		width: Math.round(bounds.width),
		height: Math.round(bounds.height),
	};
}

function buildSnapshot(scene: BaseScene): AgentSceneSnapshot {
	const characters = scene.children
		.getAll()
		.filter((child): child is Character => child instanceof Character)
		.map((character) => ({
			id: character.getCharacterId(),
			x: Math.round(character.x),
			y: Math.round(character.y),
			scale: Number(character.scaleX.toFixed(4)),
			baseScale: Number(character.getBaseScale().toFixed(4)),
			depth: character.depth,
			visible: character.visible,
			flipX: character.flipX,
			displayHeight: Math.round(character.displayHeight),
			animationState: character.getAnimationState(),
			animationKey: character.anims.currentAnim?.key ?? null,
			textureKey:
				character.anims.currentFrame?.textureKey ?? character.texture.key,
			bounds: rect(character.getBounds()),
		}));

	const config = scene.getConfig();
	return {
		sceneKey: scene.scene.key,
		displayName: config.displayName,
		camera: {
			scrollX: Math.round(scene.cameras.main.scrollX),
			scrollY: Math.round(scene.cameras.main.scrollY),
		},
		characters,
		hotspots: scene.getHotspots().map((hotspot) => ({
			id: hotspot.id,
			name: hotspot.name,
			verbs: hotspot.verbs,
			bounds: rect(hotspot.bounds),
		})),
		groundLine:
			scene
				.getGroundLineManager()
				?.getPoints()
				.map((point) => ({
					x: point.x,
					y: point.y,
					scaleFactor: point.scaleFactor,
				})) ?? [],
		inputBlocked: scene.isInputBlocked(),
	};
}

function dispatchMouse(
	canvas: HTMLCanvasElement,
	types: string[],
	gameX: number,
	gameY: number,
	gameWidth: number,
	gameHeight: number,
): void {
	const bounds = canvas.getBoundingClientRect();
	const clientX = bounds.left + (gameX / gameWidth) * bounds.width;
	const clientY = bounds.top + (gameY / gameHeight) * bounds.height;
	for (const type of types) {
		canvas.dispatchEvent(
			new MouseEvent(type, {
				bubbles: true,
				cancelable: true,
				clientX,
				clientY,
				button: 0,
				buttons: type === "mousedown" ? 1 : 0,
			}),
		);
	}
}

/**
 * Install `window.__anima` for the given scene. Called from BaseScene.create();
 * the most recently created scene wins, which matches "the active scene".
 */
export function installAgentDebug(scene: BaseScene): void {
	if (typeof window === "undefined") return;

	const game = scene.game;
	// React StrictMode double-mounts create a doomed first Game instance;
	// never let its scene claim the API or clicks go to a dead canvas.
	if ((game as unknown as { pendingDestroy?: boolean }).pendingDestroy) return;
	let virtualTime = performance.now();

	const step = (ms: number): void => {
		// Math.round, not ceil: 33.33/16.666 float-errors to 2.0001, and
		// ceiling it silently runs 3 frames per "2-frame" step - every
		// recording plays 1.5x fast.
		const frames = Math.max(1, Math.round(ms / 16.666));
		for (let i = 0; i < frames; i++) {
			virtualTime += 16.666;
			game.loop.step(virtualTime);
		}
	};

	// In zero-size viewports (collapsed/headless tabs) the canvas has no
	// geometry, so DOM mouse events can never map to game coords. Fall back
	// to emitting the pointer at the scene level. Limitation: only reaches
	// scene-level input listeners, not per-object setInteractive handlers.
	const viewportIsDegenerate = () => {
		const bounds = game.canvas.getBoundingClientRect();
		return bounds.width < 2 || bounds.height < 2;
	};
	const fakePointer = (x: number, y: number) => {
		const camera = scene.cameras.main;
		return Object.assign(Object.create(scene.input.activePointer), {
			x,
			y,
			worldX: x + camera.scrollX,
			worldY: y + camera.scrollY,
			button: 0,
		});
	};

	const api: AgentDebugApi = {
		scene,
		step,
		snapshot: () => buildSnapshot(scene),
		click(x, y) {
			if (viewportIsDegenerate()) {
				const pointer = fakePointer(x, y);
				scene.input.emit("pointerdown", pointer);
				scene.input.emit("pointerup", pointer);
				return;
			}
			dispatchMouse(
				game.canvas,
				["mousedown", "mouseup"],
				x,
				y,
				game.scale.gameSize.width,
				game.scale.gameSize.height,
			);
		},
		hover(x, y) {
			if (viewportIsDegenerate()) {
				Object.assign(scene.input.activePointer, { x, y });
				return;
			}
			dispatchMouse(
				game.canvas,
				["mousemove"],
				x,
				y,
				game.scale.gameSize.width,
				game.scale.gameSize.height,
			);
		},
		async waitUntil(predicate, options = {}) {
			const timeoutMs = options.timeoutMs ?? 10_000;
			const stepMs = options.stepMs ?? 100;
			let elapsed = 0;
			while (elapsed <= timeoutMs) {
				const snapshot = buildSnapshot(scene);
				if (predicate(snapshot)) return snapshot;
				step(stepMs);
				elapsed += stepMs;
				// Let awaited game logic (walk promises, fetches) progress.
				for (let i = 0; i < 5; i++) await Promise.resolve();
				await new Promise<void>((resolve) => {
					queueMicrotask(resolve);
				});
			}
			throw new Error(
				`waitUntil timed out after ${timeoutMs}ms of virtual time. Last snapshot: ${JSON.stringify(buildSnapshot(scene))}`,
			);
		},
		async verifyArt(landmarks, options = {}) {
			const file: LandmarksFile =
				typeof landmarks === "string"
					? await fetch(landmarks).then((response) => {
							if (!response.ok) {
								throw new Error(
									`Failed to fetch landmarks: ${landmarks} (${response.status})`,
								);
							}
							return response.json();
						})
					: landmarks;
			return verifySceneArt(buildSnapshot(scene), file, options);
		},
		async captureFrame(options = {}) {
			const stepMs = options.stepMs ?? 1000 / 30;
			const width = options.width ?? 960;
			const quality = options.quality ?? 0.8;
			// Filming needs exclusive clock ownership: if the tab's RAF is live,
			// the game ALSO advances in real time between captures and the
			// footage becomes a time-lapse. Sleeping once is not enough -
			// focus/visibility events (e.g. each agent-browser eval refocusing
			// the window) call loop.wake() and re-arm RAF. Neuter wake for the
			// rest of the page's life; manual step() still drives the game.
			const loop = game.loop as unknown as {
				sleep?: () => void;
				wake?: () => void;
				__animaFilming?: boolean;
			};
			if (!loop.__animaFilming) {
				loop.sleep?.();
				loop.wake = () => {};
				loop.__animaFilming = true;
			}
			// renderer.snapshot resolves during the render triggered by step(),
			// which is the only way to read a WebGL canvas without
			// preserveDrawingBuffer.
			const image = await new Promise<HTMLImageElement>((resolve) => {
				(
					game.renderer as unknown as {
						snapshot(callback: (img: HTMLImageElement) => void): void;
					}
				).snapshot(resolve);
				step(stepMs);
			});
			// Let awaited game logic (walk promises, transitions) progress.
			for (let i = 0; i < 5; i++) await Promise.resolve();
			const height = Math.round((width * image.height) / image.width);
			const canvas = document.createElement("canvas");
			canvas.width = width;
			canvas.height = height;
			const context = canvas.getContext("2d");
			if (!context) throw new Error("2d context unavailable for downscale");
			context.drawImage(image, 0, 0, width, height);
			return canvas.toDataURL("image/jpeg", quality);
		},
		visibility(characterId) {
			return measureVisibility(scene, characterId);
		},
	};

	(window as unknown as { __anima: AgentDebugApi }).__anima = api;
}
