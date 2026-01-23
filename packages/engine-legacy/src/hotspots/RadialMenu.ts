import type { Scene } from "phaser";
import type { Hotspot, HotspotVerb } from "./Hotspot";

interface RadialSegment {
	verb: HotspotVerb;
	startAngle: number;
	endAngle: number;
	graphics: Phaser.GameObjects.Graphics;
	text: Phaser.GameObjects.Text;
	label: Phaser.GameObjects.Text;
}

const DESKTOP_BREAKPOINT = 1024;

/**
 * Radial verb selection menu for hotspot interactions.
 * Shows available verbs in a circular menu centered on the hotspot.
 */
export class RadialMenu {
	private scene: Scene;
	private container: Phaser.GameObjects.Container;
	private segments: RadialSegment[] = [];
	private currentHotspot: Hotspot | null = null;
	private onVerbSelect?: (verb: HotspotVerb) => void;
	private backdrop: Phaser.GameObjects.Graphics | null = null;

	private get scale(): number {
		return window.innerWidth < DESKTOP_BREAKPOINT ? 2 : 1;
	}

	private get radius(): number {
		return 90 * this.scale;
	}

	private get innerRadius(): number {
		return 35 * this.scale;
	}

	private get iconSize(): number {
		return this.scale === 2 ? 48 : 28;
	}

	private get labelSize(): number {
		return this.scale === 2 ? 16 : 9;
	}

	private verbIcons: Record<HotspotVerb, string> = {
		look: "\u{1F441}",
		talk: "\u{1F4AC}",
		use: "\u{270B}",
		pickup: "\u{1F4E6}",
	};

	private verbLabels: Record<HotspotVerb, string> = {
		look: "LOOK",
		talk: "TALK",
		use: "USE",
		pickup: "TAKE",
	};

	constructor(scene: Scene, onVerbSelect?: (verb: HotspotVerb) => void) {
		this.scene = scene;
		this.onVerbSelect = onVerbSelect;

		this.container = scene.add.container(0, 0);
		this.container.setDepth(1001);
		this.container.setVisible(false);
	}

	public show(hotspot: Hotspot): void {
		this.currentHotspot = hotspot;
		this.clear();

		// Fullscreen backdrop for click-outside-to-close
		this.backdrop = this.scene.add.graphics();
		this.backdrop.fillStyle(0x000000, 0.25);
		this.backdrop.fillRect(-5000, -5000, 10000, 10000);
		this.backdrop.setInteractive(
			new Phaser.Geom.Rectangle(-5000, -5000, 10000, 10000),
			Phaser.Geom.Rectangle.Contains,
		);
		this.backdrop.on("pointerdown", () => {
			this.hide();
		});
		this.container.add(this.backdrop);

		// Center ring background
		const centerBg = this.scene.add.graphics();
		centerBg.fillStyle(0x000000, 0.5);
		centerBg.lineStyle(2, 0x22d3ee, 0.5);
		centerBg.fillCircle(0, 0, this.innerRadius - 2);
		centerBg.strokeCircle(0, 0, this.innerRadius - 2);
		this.container.add(centerBg);

		// Center at hotspot
		const centerX = hotspot.bounds.x + hotspot.bounds.width / 2;
		const centerY = hotspot.bounds.y + hotspot.bounds.height / 2;
		this.container.setPosition(centerX, centerY);

		const verbs = hotspot.verbs;
		const angleStep = (Math.PI * 2) / verbs.length;

		verbs.forEach((verb, index) => {
			const startAngle = angleStep * index - Math.PI / 2;
			const endAngle = startAngle + angleStep;
			this.createSegment(verb, startAngle, endAngle);
		});

		this.container.setVisible(true);
	}

	private createSegment(
		verb: HotspotVerb,
		startAngle: number,
		endAngle: number,
	): void {
		const graphics = this.scene.add.graphics();
		this.drawSegment(graphics, startAngle, endAngle, false);

		const midAngle = (startAngle + endAngle) / 2;
		const textRadius = (this.radius + this.innerRadius) / 2;
		const textX = Math.cos(midAngle) * textRadius;
		const textY = Math.sin(midAngle) * textRadius;

		const iconOffset = this.scale === 2 ? 12 : 6;
		const labelOffset = this.scale === 2 ? 28 : 14;

		const text = this.scene.add.text(
			textX,
			textY - iconOffset,
			this.verbIcons[verb],
			{
				fontSize: `${this.iconSize}px`,
				color: "#22d3ee",
			},
		);
		text.setOrigin(0.5);

		const label = this.scene.add.text(
			textX,
			textY + labelOffset,
			this.verbLabels[verb],
			{
				fontSize: `${this.labelSize}px`,
				color: "#22d3ee",
				fontFamily: "'Courier New', monospace",
			},
		);
		label.setOrigin(0.5);
		label.setAlpha(0.8);

		// Interactive hit area
		const numPoints = 20;
		const points: { x: number; y: number }[] = [];

		for (let i = 0; i <= numPoints; i++) {
			const angle = startAngle + (endAngle - startAngle) * (i / numPoints);
			points.push({
				x: Math.cos(angle) * this.radius,
				y: Math.sin(angle) * this.radius,
			});
		}

		for (let i = numPoints; i >= 0; i--) {
			const angle = startAngle + (endAngle - startAngle) * (i / numPoints);
			points.push({
				x: Math.cos(angle) * this.innerRadius,
				y: Math.sin(angle) * this.innerRadius,
			});
		}

		const hitArea = new Phaser.Geom.Polygon(points);
		graphics.setInteractive(hitArea, Phaser.Geom.Polygon.Contains);

		graphics.on("pointerover", () => {
			this.drawSegment(graphics, startAngle, endAngle, true);
			text.setColor("#fde047");
			text.setScale(1.1);
			label.setColor("#fde047");
			label.setAlpha(1);
		});

		graphics.on("pointerout", () => {
			this.drawSegment(graphics, startAngle, endAngle, false);
			text.setColor("#22d3ee");
			text.setScale(1);
			label.setColor("#22d3ee");
			label.setAlpha(0.8);
		});

		graphics.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
			pointer.event.stopPropagation();
			if (this.onVerbSelect && this.currentHotspot) {
				this.onVerbSelect(verb);
				this.currentHotspot.interact(verb);
			}
			this.scene.time.delayedCall(10, () => {
				this.hide();
			});
		});

		this.container.add(graphics);
		this.container.add(text);
		this.container.add(label);

		this.segments.push({
			verb,
			startAngle,
			endAngle,
			graphics,
			text,
			label,
		});
	}

	private drawSegment(
		graphics: Phaser.GameObjects.Graphics,
		startAngle: number,
		endAngle: number,
		hovered: boolean,
	): void {
		graphics.clear();

		if (hovered) {
			graphics.fillStyle(0xfde047, 0.2);
			graphics.lineStyle(2, 0xfde047, 0.8);
		} else {
			graphics.fillStyle(0x000000, 0.5);
			graphics.lineStyle(2, 0x22d3ee, 0.4);
		}

		graphics.beginPath();
		graphics.arc(0, 0, this.radius, startAngle, endAngle, false);
		graphics.arc(0, 0, this.innerRadius, endAngle, startAngle, true);
		graphics.closePath();
		graphics.fillPath();
		graphics.strokePath();

		if (hovered) {
			graphics.lineStyle(1, 0xfde047, 0.4);
			graphics.beginPath();
			graphics.arc(
				0,
				0,
				this.radius - 4,
				startAngle + 0.05,
				endAngle - 0.05,
				false,
			);
			graphics.strokePath();
		}
	}

	private clear(): void {
		this.segments.forEach((segment) => {
			segment.graphics.destroy();
			segment.text.destroy();
			segment.label.destroy();
		});
		this.segments = [];
		if (this.backdrop) {
			this.backdrop.destroy();
			this.backdrop = null;
		}
		this.container.removeAll();
	}

	public hide(): void {
		this.container.setVisible(false);
		this.currentHotspot = null;
	}

	public isVisible(): boolean {
		return this.container.visible;
	}

	public destroy(): void {
		this.clear();
		this.container.destroy();
	}
}
