import {
	BaseScene,
	Character,
	type CharacterAnimConfig,
	Hotspot,
	type HotspotVerb,
	RadialMenu,
	type SceneConfig,
	SpeechText,
} from "@anima/engine";

/**
 * Test scene using alley backgrounds from Will.
 * Demonstrates: parallax layers, character movement, hotspots.
 */
export class TestScene extends BaseScene {
	protected readonly config: SceneConfig = {
		sceneName: "TestScene",
		displayName: "TEST ALLEY",
		worldWidth: 4000,
		playerSpawn: { x: 164, y: 1027, scale: 0.85 },
		playerLeftBoundary: 100,
		playerRightBoundary: 3900,
		playerSpeed: 300,
		groundLine: {
			points: [
				{ x: 100, y: 920 },
				{ x: 2000, y: 900 },
				{ x: 3900, y: 910 },
			],
			perspectiveScale: {
				foregroundY: 920,
				backgroundY: 880,
				minScale: 0.85,
			},
		},
	};

	private radialMenu!: RadialMenu;
	private debugHotspots = false;

	constructor() {
		super({ key: "TestScene" });
	}

	preload(): void {
		// Load alley backgrounds
		this.load.image("sky", "assets/alley/alley-layer1-sky.png");
		this.load.image("walls", "assets/alley/alley-layer2-walls.png");
		this.load.image("ground", "assets/alley/alley-layer4-ground.png");

		// Load Ashley spritesheet (trimmed to content: 301x467)
		this.load.spritesheet("ashley", "assets/sprites/ashley-spritesheet.png", {
			frameWidth: 301,
			frameHeight: 467,
		});
	}

	create(): void {
		// Layer 1: Sky
		this.addParallaxLayer({
			key: "sky",
			scrollFactor: 0.2,
			y: -291,
			depth: 0,
			tileSprite: true,
			height: 600,
		});

		// Layer 2: Walls
		const wall = this.add.image(0, 207, "walls");
		wall.setOrigin(0, 0);
		wall.setScrollFactor(0.85);
		wall.setDepth(1);

		const wall2 = this.add.image(1926, 207, "walls");
		wall2.setOrigin(0, 0);
		wall2.setScrollFactor(0.85);
		wall2.setDepth(1);

		// Layer 4: Ground
		this.addParallaxLayer({
			key: "ground",
			scrollFactor: 1,
			y: 850,
			depth: 3,
			tileSprite: true,
			height: 424,
		});

		super.create();

		// Create player
		const animConfig: CharacterAnimConfig = {
			walk: {
				key: "ashley-walk",
				frames: { start: 1, end: 27 },
				frameRate: 24,
			},
			idle: {
				key: "ashley-idle",
				frames: { start: 0, end: 0 },
				frameRate: 1,
			},
			facesLeft: true,
		};

		const { x, y, scale } = this.config.playerSpawn;
		this.player = new Character(this, x, y, "ashley", animConfig, scale);
		this.player.setDepth(50);

		// Create UI systems
		this.speechText = new SpeechText(this);
		this.radialMenu = new RadialMenu(this, (verb) => {
			console.log(`Selected verb: ${verb}`);
		});

		// Create hotspots
		this.createHotspots();

		// Input handling
		this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
			this.handlePointerDown(pointer);
		});

		// Toggle hotspot debug with H key
		this.input.keyboard?.on("keydown-H", () => {
			this.debugHotspots = !this.debugHotspots;
			this.hotspots.forEach((h) => h.setDebugDraw(this.debugHotspots));
		});

		this.fadeInScene(500);
	}

	private createHotspots(): void {
		// Door hotspot (right side of scene)
		const door = new Hotspot(this, {
			id: "door",
			name: "Door",
			x: 1522,
			y: 539,
			width: 159,
			height: 304,
			verbs: ["look", "use"],
			icon: "door",
			onInteract: (verb) => this.handleDoorInteract(verb),
		});
		this.hotspots.push(door);

		// Graffiti hotspot (the pink graffiti on the wall)
		const graffiti = new Hotspot(this, {
			id: "graffiti",
			name: "Graffiti",
			x: 660,
			y: 365,
			width: 741,
			height: 493,
			verbs: ["look"],
			onInteract: (verb) => this.handleGraffitiInteract(verb),
		});
		this.hotspots.push(graffiti);
	}

	private handleDoorInteract(verb: HotspotVerb): void {
		if (verb === "look") {
			this.showDialogue(
				"ASHLEY",
				"A rusty metal door. Looks like an exit.",
				"#F472B6",
			);
		} else if (verb === "use") {
			this.showDialogue(
				"ASHLEY",
				"It's locked. I need to find another way.",
				"#F472B6",
			);
		}
	}

	private handleGraffitiInteract(verb: HotspotVerb): void {
		if (verb === "look") {
			this.showDialogue(
				"ASHLEY",
				"This street art is pretty cool. Someone put a lot of work into this.",
				"#F472B6",
			);
		}
	}

	private showDialogue(speaker: string, text: string, color: string): void {
		if (!this.speechText || !this.player) return;
		this.speechText.show(
			speaker,
			text,
			this.player as unknown as Phaser.GameObjects.Sprite,
			color,
		);

		// Hide after 3 seconds or on click
		this.time.delayedCall(3000, () => {
			this.speechText?.hide();
		});
	}

	protected override handlePointerDown(pointer: Phaser.Input.Pointer): void {
		// If editor consumed the click, don't process game interactions
		if (this.editor?.consumedClick()) {
			return;
		}

		// If radial menu is showing, let it handle the click
		if (this.radialMenu.isVisible()) {
			return;
		}

		// If dialogue is showing, hide it and return
		if (this.speechText?.isVisible()) {
			this.speechText.hide();
			return;
		}

		const worldX = pointer.x + this.cameras.main.scrollX;
		const worldY = pointer.y + this.cameras.main.scrollY;

		// Check hotspots (last match wins for overlapping)
		let clickedHotspot: Hotspot | null = null;
		for (const hotspot of this.hotspots) {
			if (hotspot.bounds.contains(worldX, worldY)) {
				clickedHotspot = hotspot;
			}
		}

		if (clickedHotspot) {
			// Show radial menu for hotspot
			this.radialMenu.show(clickedHotspot);
		} else if (this.player) {
			// Move player to click location
			const clampedX = this.clampMovement(worldX);
			this.player.moveTo(clampedX);
		}
	}

	update(time: number, delta: number): void {
		super.update(time, delta);

		// Update hotspot hover states
		const pointer = this.input.activePointer;
		const worldPointer = {
			x: pointer.x + this.cameras.main.scrollX,
			y: pointer.y + this.cameras.main.scrollY,
		};

		for (const hotspot of this.hotspots) {
			hotspot.checkHover(worldPointer);
		}
	}
}
