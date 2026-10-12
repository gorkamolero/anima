import { afterEach, describe, expect, it, vi } from "vitest";
import type { BaseScene } from "../scenes/BaseScene";
import { type AgentDebugApi, installAgentDebug } from "./AgentDebug";

afterEach(() => vi.restoreAllMocks());

describe("render-synchronous telemetry", () => {
	it("samples before transition microtasks can change visibility", async () => {
		let simulatedFrame = 0;
		let capturedFrame = -1;
		let visible = true;
		let sampledVisible: boolean | undefined;
		let pending: ((image: HTMLImageElement) => void) | undefined;
		const game = {
			loop: {
				lastTime: 0,
				smoothStep: true,
				sleep: vi.fn(),
				wake: vi.fn(),
				step: () => {
					simulatedFrame++;
					queueMicrotask(() => {
						visible = false;
					});
					if (pending) {
						capturedFrame = simulatedFrame;
						const callback = pending;
						pending = undefined;
						callback({ width: 1920, height: 1080 } as HTMLImageElement);
					}
				},
			},
			renderer: {
				snapshot: (callback: (image: HTMLImageElement) => void) => {
					pending = callback;
				},
			},
		};
		vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
			drawImage: vi.fn(),
		} as unknown as CanvasRenderingContext2D);
		vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(
			"data:image/png;base64,test",
		);
		installAgentDebug({ game } as unknown as BaseScene);
		const api = (window as unknown as { __anima: AgentDebugApi }).__anima;
		await api.captureFrame({
			stepMs: 1000 / 24,
			format: "png",
			onFrame: () => {
				sampledVisible = visible;
			},
		});
		expect(visible).toBe(false);
		expect(sampledVisible).toBe(true);
		expect(simulatedFrame).toBe(3);
		expect(capturedFrame).toBe(simulatedFrame);
		await api.captureFrame({ stepMs: 1000 / 24, format: "png" });
		expect(simulatedFrame).toBe(6);
		expect(capturedFrame).toBe(simulatedFrame);
		expect(game.loop.sleep).toHaveBeenCalledTimes(1);
	});
});
