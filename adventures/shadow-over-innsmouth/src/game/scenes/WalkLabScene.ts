import {
	BaseScene,
	Character,
	type CharacterAnimConfig,
	type SceneConfig,
} from "@anima/engine";
import {
	type FloorMask,
	type FootCycle,
	type FootPose,
	findWalkPath,
	type WalkArea,
	type WalkDirection,
	WalkMotor,
} from "@anima/footfall";
import { spriteFootBinding } from "@anima/footfall/phaser/spriteFootBinding";
import { hermesFootAnimation } from "./hermesFootAnimation";

/** The lab can swap the side cycle (`&sheet=`) to compare candidate sheets. */
function labFootAnimation(
	cycle: (texture: string) => FootCycle,
	current: () => FootPose,
	show: (pose: FootPose) => void,
	sideSheet: string,
) {
	const base = hermesFootAnimation(cycle, current, show);
	return {
		...base,
		select(direction: WalkDirection) {
			if (direction === "left" || direction === "right")
				return { cycle: cycle(sideSheet), flipX: direction === "right" };
			return base.select(direction);
		},
	};
}

/**
 * Walk lab: a black field, one white line, Hermes and nothing else.
 * Open with `?lab=1`. Click anywhere to walk along the line; `&bob=0.5`
 * lets some of the drawing's vertical bob through, `&speed=1.2` sets
 * metres per second, `&y=700` moves the line (and so the perspective scale).
 */
export class WalkLabScene extends BaseScene {
	protected readonly config: SceneConfig = {
		sceneName: "WalkLabScene",
		displayName: "WALK LAB",
		worldWidth: 1920,
		playerSpawn: { x: 400, y: 900, scale: 0.4 },
		playerSpeed: 250,
		groundLine: {
			points: [
				{ x: 0, y: 900 },
				{ x: 1920, y: 900 },
			],
			perspectiveScale: { foregroundY: 900, backgroundY: 880, minScale: 1 },
		},
	};
	private hermes?: Character;
	private motor?: WalkMotor;
	private params = new URLSearchParams(window.location.search);

	constructor() {
		super({ key: "WalkLabScene" });
	}

	private get sideSheet(): string {
		return this.params.get("sheet") ?? "hermes-walk-side-v2-4x";
	}

	private get lineY(): number {
		return Number(this.params.get("y")) || 900;
	}

	preload(): void {
		const sheets = [
			this.sideSheet,
			"hermes-walk-away-4x",
			"hermes-walk-toward-4x",
			"hermes-walk-away-right-4x",
			"hermes-walk-toward-right-4x",
			"hermes-passing-stand-side",
			"hermes-passing-stand-away",
			"hermes-passing-stand-toward",
			"hermes-passing-stand-away-right",
			"hermes-passing-stand-toward-right",
		];
		for (const texture of sheets) {
			this.load.once(`filecomplete-json-${texture}-meta`, () => {
				const meta = this.cache.json.get(`${texture}-meta`) as FootCycle;
				this.load.spritesheet(texture, `assets/sprites/hermes/${texture}.png`, {
					frameWidth: meta.frameWidth,
					frameHeight: meta.frameHeight,
				});
			});
			this.load.json(
				`${texture}-meta`,
				`assets/sprites/hermes/${texture}.json`,
			);
		}
	}

	create(): void {
		this.add.rectangle(960, 540, 1920, 1080, 0x000000).setDepth(0);
		const y = this.lineY;
		this.add.rectangle(960, y, 1920, 4, 0xffffff).setDepth(1);
		for (let x = 0; x <= 1920; x += 100)
			this.add.rectangle(x, y, 1, 12, 0x666666).setDepth(1);
		super.create();

		const animConfig: CharacterAnimConfig = {
			walk: {
				key: "lab-walk",
				frames: { start: 0, end: 0 },
				frameRate: 1,
			},
			idle: {
				key: "lab-idle",
				texture: "hermes-passing-stand-side",
				frames: { start: 0, end: 0 },
				frameRate: 1,
			},
			facesLeft: true,
		};
		this.hermes = new Character(
			this,
			400,
			y,
			"hermes-passing-stand-side",
			animConfig,
			0.4,
			"hermes",
		);
		this.hermes.setDepth(10);
		this.hermes.setWorldBoundsCollision(false);

		// One walkable row: every click resolves to a point on the line.
		const mask: FloorMask = {
			width: 192,
			height: 108,
			data: new Array(192 * 108).fill(0),
		};
		const row = Math.min(107, Math.max(0, Math.round(y / 10)));
		for (let c = 0; c < 192; c++) mask.data[row * 192 + c] = 1;
		const area: WalkArea = {
			mask,
			perspective: { horizonY: 300, slope: 0.0012, pixelsPerMetre: 300 },
			baseScale: 0.5,
			scaleClamp: { min: 0.1, max: 2 },
		};
		const { cycle, current, show } = spriteFootBinding(
			() => this.hermes,
			(texture) => this.cache.json.get(`${texture}-meta`),
		);
		this.motor = new WalkMotor(
			this.hermes,
			area,
			() => this.hermes?.anims.stop(),
			labFootAnimation(cycle, current, show, this.sideSheet),
			{
				speedMetresPerSecond: Number(this.params.get("speed")) || undefined,
				verticalBob: Number(this.params.get("bob")) || 0,
				gaitRate: Number(this.params.get("gait")) || 1,
				bobMode: this.params.get("mode") === "drawing" ? "drawing" : "pendulum",
			},
		);
		this.motor.heading = "right";
		this.motor.place({ x: 400, y });

		this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
			if (!this.motor) return;
			void this.motor.walk(
				findWalkPath(area, this.motor.anchor, { x: pointer.worldX, y }),
			);
		});
		(window as unknown as { __lab: unknown }).__lab = {
			motor: this.motor,
			area,
		};
	}

	override update(time: number, delta: number): void {
		super.update(time, delta);
		this.motor?.update(delta);
	}
}
