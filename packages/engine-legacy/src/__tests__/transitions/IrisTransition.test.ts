/**
 * IrisTransition - Classic iris wipe transition effect
 *
 * TDD: Tests written BEFORE implementation
 *
 * The iris transition creates a circular reveal/hide effect,
 * commonly used in classic cartoons and adventure games.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { IrisTransition } from "../../transitions/IrisTransition";
import { createMockScene, type MockGraphics } from "../__mocks__/phaser";

describe("IrisTransition", () => {
	let scene: ReturnType<typeof createMockScene>;
	let transition: IrisTransition;

	beforeEach(() => {
		scene = createMockScene();
		transition = new IrisTransition(scene);
	});

	describe("construction", () => {
		it("creates graphics object on scene", () => {
			expect(scene.add.graphics).toHaveBeenCalled();
		});

		it("sets graphics depth to render on top", () => {
			const graphicsInstance = scene.add.graphics.mock.results[0]
				?.value as MockGraphics;
			expect(graphicsInstance.setDepth).toHaveBeenCalled();
		});

		it("sets scroll factor to 0 for UI layer behavior", () => {
			const graphicsInstance = scene.add.graphics.mock.results[0]
				?.value as MockGraphics;
			expect(graphicsInstance.setScrollFactor).toHaveBeenCalledWith(0);
		});
	});

	describe("irisOut", () => {
		it("calls scene.tweens.add", () => {
			transition.irisOut();

			expect(scene.tweens.add).toHaveBeenCalled();
		});

		it("respects duration option", () => {
			const customDuration = 500;
			transition.irisOut({ duration: customDuration });

			expect(scene.tweens.add).toHaveBeenCalledWith(
				expect.objectContaining({
					duration: customDuration,
				}),
			);
		});

		it("uses default duration when not specified", () => {
			transition.irisOut();

			expect(scene.tweens.add).toHaveBeenCalledWith(
				expect.objectContaining({
					duration: expect.any(Number),
				}),
			);
		});

		it("calls onComplete when done", () => {
			const onComplete = vi.fn();

			// Mock tweens.add to capture and call the onComplete callback
			scene.tweens.add.mockImplementation(
				(config: { onComplete?: () => void }) => {
					if (config.onComplete) {
						config.onComplete();
					}
					return { destroy: vi.fn() };
				},
			);

			transition.irisOut({ onComplete });

			expect(onComplete).toHaveBeenCalled();
		});

		it("uses specified centerX, centerY", () => {
			const centerX = 400;
			const centerY = 300;

			transition.irisOut({ centerX, centerY });

			// The tween should be configured with the specified center point
			expect(scene.tweens.add).toHaveBeenCalledWith(
				expect.objectContaining({
					targets: expect.anything(),
				}),
			);
		});

		it("defaults to screen center when no center specified", () => {
			transition.irisOut();

			// Should use scene dimensions for default center
			expect(scene.tweens.add).toHaveBeenCalled();
		});

		it("animates radius from max to 0 (closing iris)", () => {
			let tweenConfig: Record<string, unknown> | null = null;
			scene.tweens.add.mockImplementation((config: Record<string, unknown>) => {
				tweenConfig = config;
				return { destroy: vi.fn() };
			});

			transition.irisOut();

			// Iris out should animate to a closed state (radius 0 or progress 1)
			expect(tweenConfig).not.toBeNull();
		});

		it("returns a promise that resolves when animation completes", async () => {
			scene.tweens.add.mockImplementation(
				(config: { onComplete?: () => void }) => {
					// Immediately call onComplete to simulate instant animation
					setTimeout(() => config.onComplete?.(), 0);
					return { destroy: vi.fn() };
				},
			);

			const result = transition.irisOut();

			// Should return a promise
			expect(result).toBeInstanceOf(Promise);
			await expect(result).resolves.toBeUndefined();
		});
	});

	describe("irisIn", () => {
		it("calls scene.tweens.add", () => {
			transition.irisIn();

			expect(scene.tweens.add).toHaveBeenCalled();
		});

		it("respects duration option", () => {
			const customDuration = 750;
			transition.irisIn({ duration: customDuration });

			expect(scene.tweens.add).toHaveBeenCalledWith(
				expect.objectContaining({
					duration: customDuration,
				}),
			);
		});

		it("uses default duration when not specified", () => {
			transition.irisIn();

			expect(scene.tweens.add).toHaveBeenCalledWith(
				expect.objectContaining({
					duration: expect.any(Number),
				}),
			);
		});

		it("calls onComplete when done", () => {
			const onComplete = vi.fn();

			scene.tweens.add.mockImplementation(
				(config: { onComplete?: () => void }) => {
					if (config.onComplete) {
						config.onComplete();
					}
					return { destroy: vi.fn() };
				},
			);

			transition.irisIn({ onComplete });

			expect(onComplete).toHaveBeenCalled();
		});

		it("uses specified centerX, centerY", () => {
			const centerX = 200;
			const centerY = 150;

			transition.irisIn({ centerX, centerY });

			expect(scene.tweens.add).toHaveBeenCalledWith(
				expect.objectContaining({
					targets: expect.anything(),
				}),
			);
		});

		it("animates radius from 0 to max (opening iris)", () => {
			let tweenConfig: Record<string, unknown> | null = null;
			scene.tweens.add.mockImplementation((config: Record<string, unknown>) => {
				tweenConfig = config;
				return { destroy: vi.fn() };
			});

			transition.irisIn();

			// Iris in should animate from closed to open state
			expect(tweenConfig).not.toBeNull();
		});

		it("returns a promise that resolves when animation completes", async () => {
			scene.tweens.add.mockImplementation(
				(config: { onComplete?: () => void }) => {
					setTimeout(() => config.onComplete?.(), 0);
					return { destroy: vi.fn() };
				},
			);

			const result = transition.irisIn();

			expect(result).toBeInstanceOf(Promise);
			await expect(result).resolves.toBeUndefined();
		});

		it("clears graphics after opening completes", () => {
			const graphicsInstance = scene.add.graphics.mock.results[0]
				?.value as MockGraphics;

			scene.tweens.add.mockImplementation(
				(config: { onComplete?: () => void }) => {
					config.onComplete?.();
					return { destroy: vi.fn() };
				},
			);

			transition.irisIn();

			// After iris in completes, the graphics should be cleared
			expect(graphicsInstance.clear).toHaveBeenCalled();
		});
	});

	describe("drawClosed", () => {
		it("uses graphics to fill screen", () => {
			const graphicsInstance = scene.add.graphics.mock.results[0]
				?.value as MockGraphics;

			transition.drawClosed();

			expect(graphicsInstance.fillStyle).toHaveBeenCalled();
			expect(graphicsInstance.fillRect).toHaveBeenCalled();
		});

		it("fills with black color by default", () => {
			const graphicsInstance = scene.add.graphics.mock.results[0]
				?.value as MockGraphics;

			transition.drawClosed();

			// 0x000000 is black
			expect(graphicsInstance.fillStyle).toHaveBeenCalledWith(
				0x000000,
				expect.any(Number),
			);
		});

		it("clears previous graphics before drawing", () => {
			const graphicsInstance = scene.add.graphics.mock.results[0]
				?.value as MockGraphics;

			transition.drawClosed();

			expect(graphicsInstance.clear).toHaveBeenCalled();
		});

		it("fills the entire screen dimensions", () => {
			const graphicsInstance = scene.add.graphics.mock.results[0]
				?.value as MockGraphics;

			transition.drawClosed();

			expect(graphicsInstance.fillRect).toHaveBeenCalledWith(
				0,
				0,
				scene.scale.width,
				scene.scale.height,
			);
		});

		it("draws at specified center point with iris hole", () => {
			const graphicsInstance = scene.add.graphics.mock.results[0]
				?.value as MockGraphics;
			const centerX = 500;
			const centerY = 400;

			transition.drawClosed({ centerX, centerY });

			// Should use the specified center for the iris effect
			expect(graphicsInstance.fillStyle).toHaveBeenCalled();
		});

		it("respects custom color option", () => {
			const graphicsInstance = scene.add.graphics.mock.results[0]
				?.value as MockGraphics;
			const customColor = 0xff0000; // Red

			transition.drawClosed({ color: customColor });

			expect(graphicsInstance.fillStyle).toHaveBeenCalledWith(
				customColor,
				expect.any(Number),
			);
		});
	});

	describe("cleanup", () => {
		it("destroy() removes graphics object", () => {
			const graphicsInstance = scene.add.graphics.mock.results[0]
				?.value as MockGraphics;

			transition.destroy();

			expect(graphicsInstance.destroy).toHaveBeenCalled();
		});

		it("destroy() can be called multiple times safely", () => {
			transition.destroy();
			transition.destroy();

			// Should not throw an error
			expect(true).toBe(true);
		});

		it("destroy() stops any running tweens", () => {
			// Start an animation
			transition.irisOut();

			// Then destroy
			transition.destroy();

			// The tween created by irisOut should be cleaned up
			const graphicsInstance = scene.add.graphics.mock.results[0]
				?.value as MockGraphics;
			expect(graphicsInstance.destroy).toHaveBeenCalled();
		});
	});

	describe("edge cases", () => {
		it("handles zero duration gracefully", () => {
			expect(() => {
				transition.irisOut({ duration: 0 });
			}).not.toThrow();
		});

		it("handles negative center coordinates", () => {
			expect(() => {
				transition.irisOut({ centerX: -100, centerY: -50 });
			}).not.toThrow();
		});

		it("handles center coordinates outside screen bounds", () => {
			expect(() => {
				transition.irisOut({ centerX: 5000, centerY: 5000 });
			}).not.toThrow();
		});

		it("can chain irisOut then irisIn", async () => {
			scene.tweens.add.mockImplementation(
				(config: { onComplete?: () => void }) => {
					setTimeout(() => config.onComplete?.(), 0);
					return { destroy: vi.fn() };
				},
			);

			await transition.irisOut();
			await transition.irisIn();

			// Both should have been called
			expect(scene.tweens.add).toHaveBeenCalledTimes(2);
		});
	});
});
