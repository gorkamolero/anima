import type {
	FootAnimation,
	FootCycle,
	WalkArea,
	WalkDirection,
	WalkMotor,
} from "@anima/footfall";
import {
	CharacterMotor,
	findWalkPath,
	roundCorners,
	scaleAt,
} from "@anima/footfall";
import { spriteFootBinding } from "@anima/footfall/phaser/spriteFootBinding";
import type Phaser from "phaser";
import { characterWalkSheets, HERMES_WALK, walkSheetFor } from "../hermesWalk";

/** Where the companion keeps station, in ground-plane pixels at scale 1
 * (about a metre): beside him on a depth walk, a step behind and to one side
 * on a lateral walk so the two figures do not overlap. `SLACK_PX` is how far
 * off station she may drift before she walks again. */
const BESIDE_PX = 110;
const BEHIND_PX = 90;
const OFFSET_PX = 50;
const SLACK_PX = 35;
const REPLAN_MS = 250;

type SheetSet = ReturnType<typeof characterWalkSheets>["walk"];

/** Fill a sheet set's gaps from the nearest painted heading, so a character
 * whose toward or diagonal cycles are not yet generated still walks. */
function withFallbacks(
	sheets: SheetSet,
	exists: (texture: string) => boolean,
): SheetSet {
	const has = (t: string) => (exists(t) ? t : undefined);
	const side = sheets.side;
	const away = has(sheets.away) ?? has(sheets.awayDiagonal) ?? side;
	const toward = has(sheets.toward) ?? has(sheets.towardDiagonal) ?? side;
	return {
		side,
		away,
		toward,
		awayDiagonal: has(sheets.awayDiagonal) ?? away,
		towardDiagonal: has(sheets.towardDiagonal) ?? toward,
	};
}

/** A second character walking on the same floor with the same gait rules as
 * Hermes, following him a station to one side. Built for characters that come
 * out of `make-character.mjs`; `?companion=kat` turns it on in the depot. */
export class Companion {
	readonly sprite: Phaser.GameObjects.Sprite;
	private motor?: WalkMotor;
	private area?: WalkArea;
	private leader?: WalkMotor;
	private sinceReplan = 0;
	private side = -1;
	private loaded = false;

	constructor(
		private readonly scene: Phaser.Scene,
		readonly name: string,
	) {
		const sheets = characterWalkSheets(name);
		this.sprite = scene.add
			.sprite(0, 0, sheets.stand.side)
			.setOrigin(0.5, 1)
			.setVisible(false);
		this.load(sheets);
	}

	/** Fetch the sheets that exist and register them as textures directly, so
	 * the scene's own loader never sees a missing heading. */
	private load(sheets: ReturnType<typeof characterWalkSheets>): void {
		const textures = [
			...Object.values(sheets.walk),
			...Object.values(sheets.stand),
		];
		void Promise.all(textures.map((texture) => this.loadSheet(texture))).then(
			() => {
				this.loaded = true;
			},
		);
	}

	private async loadSheet(texture: string): Promise<void> {
		const base = `assets/sprites/${this.name}/${texture}`;
		const response = await fetch(`${base}.json`).catch(() => undefined);
		if (!response?.ok) return;
		const meta = (await response.json().catch(() => undefined)) as
			| FootCycle
			| undefined;
		if (!meta?.frameWidth || !meta.frameHeight || !meta.contacts) return;
		const image = new Image();
		const ready = new Promise<boolean>((resolve) => {
			image.onload = () => resolve(true);
			image.onerror = () => resolve(false);
		});
		image.src = `${base}.png`;
		if (!(await ready)) return;
		if (!this.scene.textures.exists(texture))
			this.scene.textures.addSpriteSheet(texture, image, {
				frameWidth: meta.frameWidth,
				frameHeight: meta.frameHeight,
			});
		this.scene.cache.json.add(`${texture}-meta`, meta);
	}

	private animation(): FootAnimation {
		const exists = (t: string) => this.scene.textures.exists(t);
		const sheets = characterWalkSheets(this.name);
		const walk = withFallbacks(sheets.walk, exists);
		const stand = withFallbacks(sheets.stand, exists);
		const { cycle, current, show } = spriteFootBinding(
			() => this.sprite,
			(texture) => this.scene.cache.json.get(`${texture}-meta`),
			`${this.name} unavailable`,
		);
		const pick = (set: SheetSet, direction: WalkDirection) => {
			const chosen = walkSheetFor(set, direction);
			// A side sheet standing in for a depth heading still faces the way
			// the character is going.
			if (chosen.texture === set.side && !/^(left|right)$/.test(direction))
				chosen.flipX = direction.endsWith("right");
			return chosen;
		};
		return {
			current,
			show,
			select(direction) {
				const { texture, flipX } = pick(walk, direction);
				return { cycle: cycle(texture), flipX };
			},
			standing(direction) {
				const { texture, flipX } = pick(stand, direction);
				return { cycle: cycle(texture), frame: 0, flipX };
			},
		};
	}

	/** Bind to a floor and a leader; called again whenever the scene changes.
	 * The motor itself is built on the next update, once the sheets are in. */
	attach(area: WalkArea, leader: WalkMotor): void {
		this.area = area;
		this.leader = leader;
		this.motor?.detach();
		this.motor = undefined;
		this.sprite.setVisible(false);
	}

	private ensureMotor(): WalkMotor | undefined {
		if (this.motor) return this.motor;
		const area = this.area;
		const leader = this.leader;
		if (!this.loaded || !area || !leader) return undefined;
		const motor = new CharacterMotor(
			this.sprite,
			area,
			() => {
				this.sprite.anims.stop();
			},
			this.animation(),
			HERMES_WALK,
		);
		try {
			motor.place(this.station(leader.anchor, leader.heading));
		} catch {
			// No floor at the station yet (the scene may still be settling):
			// stand where the leader stands and take station on the next plan.
			try {
				motor.place(leader.anchor);
			} catch {
				motor.detach();
				return undefined;
			}
		}
		motor.face(leader.heading);
		this.sprite.setVisible(true);
		this.motor = motor;
		return motor;
	}

	private station(
		anchor: { x: number; y: number },
		heading: WalkDirection,
	): { x: number; y: number } {
		const area = this.area;
		if (!area) return anchor;
		const s =
			area.baseScale * scaleAt(area.perspective, anchor, area.scaleClamp);
		// Keep to the side she is already on; never cross in front of him.
		if (this.motor) this.side = Math.sign(this.motor.anchor.x - anchor.x) || -1;
		let offset: { x: number; y: number };
		if (heading === "left" || heading === "right") {
			const ahead = heading === "right" ? 1 : -1;
			offset = { x: -ahead * BEHIND_PX, y: this.side * OFFSET_PX };
		} else {
			offset = { x: this.side * BESIDE_PX, y: 0 };
		}
		return { x: anchor.x + offset.x * s, y: anchor.y + offset.y * s };
	}

	update(delta: number): void {
		const motor = this.ensureMotor();
		const leader = this.leader;
		const area = this.area;
		if (!motor || !leader || !area) return;
		motor.update(delta);
		this.sinceReplan += delta;
		if (this.sinceReplan < REPLAN_MS) return;
		this.sinceReplan = 0;
		const target = this.station(leader.anchor, leader.heading);
		const s =
			area.baseScale * scaleAt(area.perspective, target, area.scaleClamp);
		const off = Math.hypot(
			target.x - motor.anchor.x,
			target.y - motor.anchor.y,
		);
		if (off > SLACK_PX * s) {
			const path = roundCorners(
				area.mask,
				findWalkPath(area, motor.anchor, target),
				80,
			);
			if (path.length) void motor.walk(path);
		} else if (!motor.walking && motor.heading !== leader.heading) {
			motor.face(leader.heading);
		}
	}

	destroy(): void {
		this.motor?.detach();
		this.sprite.destroy();
	}
}
