/**
 * Vitest setup file for @anima/engine tests
 */

import { vi } from "vitest";

// Mock Phaser globally for all tests
vi.mock("phaser", async () => {
	const mocks = await import("./__mocks__/phaser");
	return {
		...mocks,
		default: mocks,
	};
});

// Reset all mocks between tests
beforeEach(() => {
	vi.clearAllMocks();
});
