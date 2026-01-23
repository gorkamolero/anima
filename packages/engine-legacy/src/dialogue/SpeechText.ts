import type { Scene } from "phaser";

/**
 * Monkey Island-style floating dialogue text above characters.
 */
export class SpeechText {
	private scene: Scene;
	private container: Phaser.GameObjects.Container;
	private text: Phaser.GameObjects.Text;
	private speakerLabel: Phaser.GameObjects.Text;
	private visible = false;

	private static readonly FALLBACK_COLORS: Record<string, string> = {
		PLAYER: "#06B6D4",
	};
	private static readonly DEFAULT_COLOR = "#ffffff";
	private static readonly MAX_WIDTH = 500;
	private static readonly PADDING_ABOVE_SPRITE = 30;
	private static readonly FONT_SIZE = "28px";
	private static readonly SPEAKER_FONT_SIZE = "18px";
	private static readonly STROKE_WIDTH = 5;
	private static readonly LINE_SPACING = 6;

	constructor(scene: Scene) {
		this.scene = scene;

		this.container = scene.add.container(0, 0);
		this.container.setDepth(100);
		this.container.setVisible(false);

		this.speakerLabel = scene.add.text(0, 0, "", {
			fontFamily: '"Courier New", monospace',
			fontSize: SpeechText.SPEAKER_FONT_SIZE,
			color: "#ffffff",
			stroke: "#000000",
			strokeThickness: 3,
			align: "center",
		});
		this.speakerLabel.setOrigin(0.5, 1);
		this.container.add(this.speakerLabel);

		this.text = scene.add.text(0, 0, "", {
			fontFamily: '"Courier New", monospace',
			fontSize: SpeechText.FONT_SIZE,
			color: "#ffffff",
			stroke: "#000000",
			strokeThickness: SpeechText.STROKE_WIDTH,
			align: "center",
			wordWrap: { width: SpeechText.MAX_WIDTH, useAdvancedWrap: true },
			lineSpacing: SpeechText.LINE_SPACING,
		});
		this.text.setOrigin(0.5, 1);
		this.container.add(this.text);
	}

	/**
	 * Show dialogue text above a character sprite
	 */
	public show(
		speaker: string,
		dialogueText: string,
		sprite?: Phaser.GameObjects.Sprite,
		color?: string,
	): void {
		const textColor =
			color ||
			SpeechText.FALLBACK_COLORS[speaker.toUpperCase()] ||
			SpeechText.DEFAULT_COLOR;

		this.speakerLabel.setText(speaker);
		this.speakerLabel.setColor(textColor);
		this.text.setText(dialogueText);
		this.text.setColor(textColor);

		if (sprite) {
			const spriteTop = sprite.y - sprite.displayHeight * sprite.originY;
			const spriteCenter = sprite.x;
			this.container.setPosition(
				spriteCenter,
				spriteTop - SpeechText.PADDING_ABOVE_SPRITE,
			);
		} else {
			const camera = this.scene.cameras.main;
			this.container.setPosition(
				camera.scrollX + camera.width / 2,
				camera.scrollY + 200,
			);
		}

		this.speakerLabel.setPosition(0, -this.text.height - 5);
		this.clampToScreen();

		this.container.setVisible(true);
		this.visible = true;
	}

	public hide(): void {
		this.container.setVisible(false);
		this.visible = false;
	}

	public isVisible(): boolean {
		return this.visible;
	}

	public updatePosition(sprite: Phaser.GameObjects.Sprite): void {
		if (!this.visible) return;

		const spriteTop = sprite.y - sprite.displayHeight * sprite.originY;
		const spriteCenter = sprite.x;

		this.container.setPosition(
			spriteCenter,
			spriteTop - SpeechText.PADDING_ABOVE_SPRITE,
		);

		this.clampToScreen();
	}

	private clampToScreen(): void {
		const camera = this.scene.cameras.main;
		const textWidth = Math.max(this.text.width, this.speakerLabel.width);
		const textHeight = this.text.height + this.speakerLabel.height + 10;

		const minX = camera.scrollX + textWidth / 2 + 10;
		const maxX = camera.scrollX + camera.width - textWidth / 2 - 10;
		const minY = camera.scrollY + textHeight + 10;
		const maxY = camera.scrollY + camera.height - 100;

		this.container.x = Phaser.Math.Clamp(this.container.x, minX, maxX);
		this.container.y = Phaser.Math.Clamp(this.container.y, minY, maxY);
	}

	public destroy(): void {
		this.container.destroy();
	}
}
