/**
 * Phaser 3 mock for unit testing
 * Provides minimal implementations of Phaser classes used by Anima
 */

import { vi } from "vitest";

// Mock Game Objects
export class MockGameObject {
	x = 0;
	y = 0;
	depth = 0;
	visible = true;
	displayWidth = 100;
	displayHeight = 100;

	setPosition = vi.fn().mockReturnThis();
	setDepth = vi.fn().mockReturnThis();
	setVisible = vi.fn().mockReturnThis();
	setOrigin = vi.fn().mockReturnThis();
	setScale = vi.fn().mockReturnThis();
	setScrollFactor = vi.fn().mockReturnThis();
	setAlpha = vi.fn().mockReturnThis();
	setTexture = vi.fn().mockReturnThis();
	destroy = vi.fn();
}

export class MockImage extends MockGameObject {}

export class MockSprite extends MockGameObject {
	anims = {
		play: vi.fn().mockReturnThis(),
		stop: vi.fn().mockReturnThis(),
	};
	setFrame = vi.fn().mockReturnThis();
	play = vi.fn().mockReturnThis();
	setFlipX = vi.fn().mockReturnThis();
	originY = 1;
	texture = { key: "mock-texture" };
	body?: {
		setCollideWorldBounds: ReturnType<typeof vi.fn>;
		setVelocity: ReturnType<typeof vi.fn>;
	};
}

export class MockTileSprite extends MockGameObject {
	tilePositionX = 0;
	tilePositionY = 0;
}

export class MockGraphics extends MockGameObject {
	clear = vi.fn().mockReturnThis();
	fillStyle = vi.fn().mockReturnThis();
	fillRect = vi.fn().mockReturnThis();
	fillCircle = vi.fn().mockReturnThis();
	strokeRect = vi.fn().mockReturnThis();
	strokeCircle = vi.fn().mockReturnThis();
	lineStyle = vi.fn().mockReturnThis();
	lineTo = vi.fn().mockReturnThis();
	moveTo = vi.fn().mockReturnThis();
	beginPath = vi.fn().mockReturnThis();
	closePath = vi.fn().mockReturnThis();
	strokePath = vi.fn().mockReturnThis();
	fillPath = vi.fn().mockReturnThis();
}

export class MockText extends MockGameObject {
	setText = vi.fn().mockReturnThis();
	setStyle = vi.fn().mockReturnThis();
	setWordWrapWidth = vi.fn().mockReturnThis();
	setColor = vi.fn().mockReturnThis();
	width = 100;
	height = 20;
}

export class MockContainer extends MockGameObject {
	add = vi.fn().mockReturnThis();
	remove = vi.fn().mockReturnThis();
	list: MockGameObject[] = [];
}

export class MockSound {
	play = vi.fn();
	pause = vi.fn();
	resume = vi.fn();
	stop = vi.fn();
	destroy = vi.fn();
	setVolume = vi.fn();
	once = vi.fn();
	isPlaying = false;
}

// Mock Rectangle (for bounds)
export class MockRectangle {
	x: number;
	y: number;
	width: number;
	height: number;

	constructor(x = 0, y = 0, width = 100, height = 100) {
		this.x = x;
		this.y = y;
		this.width = width;
		this.height = height;
	}

	get centerX() {
		return this.x + this.width / 2;
	}
	get centerY() {
		return this.y + this.height / 2;
	}

	contains(px: number, py: number): boolean {
		return (
			px >= this.x &&
			px <= this.x + this.width &&
			py >= this.y &&
			py <= this.y + this.height
		);
	}

	setTo(x: number, y: number, width: number, height: number): this {
		this.x = x;
		this.y = y;
		this.width = width;
		this.height = height;
		return this;
	}
}

// Mock Phaser.Scene
export class MockScene {
	add = {
		image: vi.fn(() => new MockImage()),
		sprite: vi.fn(() => new MockSprite()),
		graphics: vi.fn(() => new MockGraphics()),
		text: vi.fn(() => new MockText()),
		tileSprite: vi.fn(() => new MockTileSprite()),
		container: vi.fn(() => new MockContainer()),
		existing: vi.fn((obj: MockGameObject) => obj),
	};

	load = {
		audio: vi.fn(),
		image: vi.fn(),
		spritesheet: vi.fn(),
		start: vi.fn(),
		once: vi.fn((_event: string, callback: () => void) => callback()),
	};

	sound = {
		add: vi.fn(() => new MockSound()),
		play: vi.fn(),
	};

	cache = {
		audio: {
			exists: vi.fn(() => true),
		},
	};

	input = {
		on: vi.fn(),
		activePointer: { x: 0, y: 0, wasTouch: false, isDown: false },
		mouse: { disableContextMenu: vi.fn() },
	};

	cameras = {
		main: {
			scrollX: 0,
			scrollY: 0,
			width: 1920,
			height: 1080,
			setBounds: vi.fn(),
			fadeIn: vi.fn(),
			fadeOut: vi.fn(),
		},
	};

	physics = {
		world: {
			setBounds: vi.fn(),
		},
		add: {
			existing: vi.fn((obj: MockSprite) => {
				// Add mock physics body
				obj.body = {
					setCollideWorldBounds: vi.fn(),
					setVelocity: vi.fn(),
				};
				return obj;
			}),
		},
	};

	scale = {
		width: 1920,
		height: 1080,
	};

	tweens = {
		add: vi.fn((config: { onComplete?: () => void; onUpdate?: () => void }) => {
			// Immediately call onComplete to avoid timeout issues
			if (config.onUpdate) config.onUpdate();
			if (config.onComplete) config.onComplete();
			return { destroy: vi.fn() };
		}),
	};

	events = {
		on: vi.fn(),
		once: vi.fn(),
		off: vi.fn(),
		emit: vi.fn(),
	};

	scene = {
		start: vi.fn(),
		restart: vi.fn(),
		settings: { data: {} },
	};

	game = {
		canvas: {
			width: 1920,
			height: 1080,
			clientWidth: 1920,
			clientHeight: 1080,
		},
	};

	time = {
		delayedCall: vi.fn(),
	};

	anims = {
		exists: vi.fn(() => false),
		create: vi.fn(),
		generateFrameNumbers: vi.fn(() => []),
	};
}

// Export mock Scene as default "Scene" class
export const Scene = MockScene;

// Namespaced mocks matching Phaser structure
export const Geom = {
	Rectangle: MockRectangle,
};

export const GameObjects = {
	Image: MockImage,
	Sprite: MockSprite,
	Graphics: MockGraphics,
	Text: MockText,
	TileSprite: MockTileSprite,
	Container: MockContainer,
};

export const Scenes = {
	Events: {
		POST_UPDATE: "postupdate",
	},
};

export const Math = {
	Clamp: (value: number, min: number, max: number) =>
		window.Math.min(window.Math.max(value, min), max),
};

// Helper to create a mock scene instance
export function createMockScene(): MockScene {
	return new MockScene();
}
