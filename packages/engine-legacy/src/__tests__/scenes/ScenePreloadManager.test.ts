/**
 * ScenePreloadManager - Scene preloading and dependency management singleton
 *
 * TDD: Tests written BEFORE implementation
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ScenePreloadManager } from "../../scenes/ScenePreloadManager";

describe("ScenePreloadManager", () => {
	beforeEach(() => {
		// Reset singleton for test isolation
		ScenePreloadManager.resetInstance();
	});

	afterEach(() => {
		// Ensure clean state after each test
		ScenePreloadManager.resetInstance();
	});

	describe("singleton", () => {
		it("getInstance returns same instance", () => {
			const instance1 = ScenePreloadManager.getInstance();
			const instance2 = ScenePreloadManager.getInstance();

			expect(instance1).toBe(instance2);
		});

		it("resetInstance clears instance for test isolation", () => {
			const instance1 = ScenePreloadManager.getInstance();

			// Set some state on the first instance
			instance1.setDependencies({
				sceneA: ["sceneB", "sceneC"],
			});

			ScenePreloadManager.resetInstance();

			const instance2 = ScenePreloadManager.getInstance();

			// After reset, dependency graph should be cleared
			expect(instance2.getDependencies("sceneA")).toEqual([]);
		});
	});

	describe("dependency graph", () => {
		it("setDependencies stores scene relationships", () => {
			const manager = ScenePreloadManager.getInstance();

			const graph = {
				lobby: ["hallway", "office"],
				hallway: ["lobby", "storage"],
				office: ["lobby"],
			};

			manager.setDependencies(graph);

			expect(manager.getDependencies("lobby")).toEqual(["hallway", "office"]);
			expect(manager.getDependencies("hallway")).toEqual(["lobby", "storage"]);
			expect(manager.getDependencies("office")).toEqual(["lobby"]);
		});

		it("getDependencies returns dependent scenes array", () => {
			const manager = ScenePreloadManager.getInstance();

			manager.setDependencies({
				kitchen: ["dining_room", "pantry", "backyard"],
			});

			const dependencies = manager.getDependencies("kitchen");

			expect(dependencies).toEqual(["dining_room", "pantry", "backyard"]);
			expect(dependencies).toHaveLength(3);
		});

		it("getNextScenesForPreload returns scenes to preload based on graph", () => {
			const manager = ScenePreloadManager.getInstance();

			manager.setDependencies({
				entrance: ["lobby", "garden"],
				lobby: ["office", "restroom"],
			});

			const scenesToPreload = manager.getNextScenesForPreload("entrance");

			expect(scenesToPreload).toEqual(["lobby", "garden"]);
		});

		it("returns empty array for leaf scenes (no dependencies)", () => {
			const manager = ScenePreloadManager.getInstance();

			manager.setDependencies({
				lobby: ["office"],
				office: [], // Leaf scene - no outgoing connections
			});

			expect(manager.getDependencies("office")).toEqual([]);
			expect(manager.getNextScenesForPreload("office")).toEqual([]);
		});

		it("returns empty array for unknown scenes", () => {
			const manager = ScenePreloadManager.getInstance();

			manager.setDependencies({
				lobby: ["office"],
			});

			expect(manager.getDependencies("unknown_scene")).toEqual([]);
			expect(manager.getNextScenesForPreload("unknown_scene")).toEqual([]);
		});
	});

	describe("preload state", () => {
		it("preloadScene marks scene as loading", () => {
			const manager = ScenePreloadManager.getInstance();

			manager.preloadScene("lobby");

			expect(manager.isSceneLoading("lobby")).toBe(true);
		});

		it("isSceneLoaded returns false initially", () => {
			const manager = ScenePreloadManager.getInstance();

			expect(manager.isSceneLoaded("lobby")).toBe(false);
			expect(manager.isSceneLoaded("office")).toBe(false);
			expect(manager.isSceneLoaded("any_scene")).toBe(false);
		});

		it("isSceneLoaded returns true after markSceneLoaded", () => {
			const manager = ScenePreloadManager.getInstance();

			manager.markSceneLoaded("lobby");

			expect(manager.isSceneLoaded("lobby")).toBe(true);
		});

		it("isSceneLoading returns true while loading", () => {
			const manager = ScenePreloadManager.getInstance();

			expect(manager.isSceneLoading("lobby")).toBe(false);

			manager.preloadScene("lobby");

			expect(manager.isSceneLoading("lobby")).toBe(true);
		});

		it("isSceneLoading returns false after loaded", () => {
			const manager = ScenePreloadManager.getInstance();

			manager.preloadScene("lobby");
			expect(manager.isSceneLoading("lobby")).toBe(true);

			manager.markSceneLoaded("lobby");

			expect(manager.isSceneLoading("lobby")).toBe(false);
			expect(manager.isSceneLoaded("lobby")).toBe(true);
		});

		it("multiple scenes can be loading simultaneously", () => {
			const manager = ScenePreloadManager.getInstance();

			manager.preloadScene("lobby");
			manager.preloadScene("office");
			manager.preloadScene("hallway");

			expect(manager.isSceneLoading("lobby")).toBe(true);
			expect(manager.isSceneLoading("office")).toBe(true);
			expect(manager.isSceneLoading("hallway")).toBe(true);

			// Mark one as loaded, others still loading
			manager.markSceneLoaded("office");

			expect(manager.isSceneLoading("lobby")).toBe(true);
			expect(manager.isSceneLoading("office")).toBe(false);
			expect(manager.isSceneLoaded("office")).toBe(true);
			expect(manager.isSceneLoading("hallway")).toBe(true);
		});
	});

	describe("async waiting", () => {
		it("waitForScene returns immediately if already loaded", async () => {
			const manager = ScenePreloadManager.getInstance();

			manager.markSceneLoaded("lobby");

			const startTime = Date.now();
			await manager.waitForScene("lobby");
			const elapsed = Date.now() - startTime;

			// Should return immediately (within a few ms)
			expect(elapsed).toBeLessThan(50);
		});

		it("waitForScene waits until scene is loaded", async () => {
			const manager = ScenePreloadManager.getInstance();

			manager.preloadScene("lobby");

			// Start waiting in background
			const waitPromise = manager.waitForScene("lobby");

			// Simulate loading completion after a short delay
			setTimeout(() => {
				manager.markSceneLoaded("lobby");
			}, 50);

			await waitPromise;

			expect(manager.isSceneLoaded("lobby")).toBe(true);
		});

		it("waitForSceneWithTimeout resolves when loaded", async () => {
			const manager = ScenePreloadManager.getInstance();

			manager.preloadScene("lobby");

			// Start waiting with timeout
			const waitPromise = manager.waitForSceneWithTimeout("lobby", 1000);

			// Mark loaded after short delay
			setTimeout(() => {
				manager.markSceneLoaded("lobby");
			}, 50);

			await expect(waitPromise).resolves.toBeUndefined();
			expect(manager.isSceneLoaded("lobby")).toBe(true);
		});

		it("waitForSceneWithTimeout rejects on timeout", async () => {
			const manager = ScenePreloadManager.getInstance();

			manager.preloadScene("lobby");

			// Wait with very short timeout, never mark as loaded
			await expect(
				manager.waitForSceneWithTimeout("lobby", 50),
			).rejects.toThrow();
		});

		it("can wait for multiple scenes concurrently", async () => {
			const manager = ScenePreloadManager.getInstance();

			manager.preloadScene("lobby");
			manager.preloadScene("office");
			manager.preloadScene("hallway");

			// Start waiting for all scenes
			const waitPromises = [
				manager.waitForScene("lobby"),
				manager.waitForScene("office"),
				manager.waitForScene("hallway"),
			];

			// Mark scenes as loaded with different delays
			setTimeout(() => manager.markSceneLoaded("lobby"), 30);
			setTimeout(() => manager.markSceneLoaded("office"), 50);
			setTimeout(() => manager.markSceneLoaded("hallway"), 70);

			// All promises should resolve
			await Promise.all(waitPromises);

			expect(manager.isSceneLoaded("lobby")).toBe(true);
			expect(manager.isSceneLoaded("office")).toBe(true);
			expect(manager.isSceneLoaded("hallway")).toBe(true);
		});
	});

	describe("marking loaded", () => {
		it("markSceneLoaded marks scene as loaded", () => {
			const manager = ScenePreloadManager.getInstance();

			expect(manager.isSceneLoaded("lobby")).toBe(false);

			manager.markSceneLoaded("lobby");

			expect(manager.isSceneLoaded("lobby")).toBe(true);
		});

		it("markSceneLoaded resolves waiting promises", async () => {
			const manager = ScenePreloadManager.getInstance();

			manager.preloadScene("lobby");

			let resolved = false;
			const waitPromise = manager.waitForScene("lobby").then(() => {
				resolved = true;
			});

			// Not resolved yet
			await new Promise((resolve) => setTimeout(resolve, 10));
			expect(resolved).toBe(false);

			// Mark as loaded
			manager.markSceneLoaded("lobby");

			// Now should resolve
			await waitPromise;
			expect(resolved).toBe(true);
		});

		it("markSceneLoaded can be called without prior preloadScene", () => {
			const manager = ScenePreloadManager.getInstance();

			// Should not throw
			expect(() => manager.markSceneLoaded("lobby")).not.toThrow();
			expect(manager.isSceneLoaded("lobby")).toBe(true);
		});

		it("markSceneLoaded is idempotent", () => {
			const manager = ScenePreloadManager.getInstance();

			manager.markSceneLoaded("lobby");
			manager.markSceneLoaded("lobby");
			manager.markSceneLoaded("lobby");

			expect(manager.isSceneLoaded("lobby")).toBe(true);
		});
	});

	describe("reset", () => {
		it("reset clears all state", () => {
			const manager = ScenePreloadManager.getInstance();

			// Set up various state
			manager.setDependencies({
				lobby: ["office", "hallway"],
			});
			manager.preloadScene("lobby");
			manager.markSceneLoaded("office");

			manager.reset();

			// All state should be cleared
			expect(manager.isSceneLoaded("lobby")).toBe(false);
			expect(manager.isSceneLoaded("office")).toBe(false);
			expect(manager.isSceneLoading("lobby")).toBe(false);
		});

		it("reset clears dependency graph", () => {
			const manager = ScenePreloadManager.getInstance();

			manager.setDependencies({
				lobby: ["office", "hallway"],
				office: ["storage"],
			});

			expect(manager.getDependencies("lobby")).toEqual(["office", "hallway"]);

			manager.reset();

			expect(manager.getDependencies("lobby")).toEqual([]);
			expect(manager.getDependencies("office")).toEqual([]);
		});

		it("reset clears loading/loaded status", () => {
			const manager = ScenePreloadManager.getInstance();

			// Mix of loading and loaded states
			manager.preloadScene("lobby");
			manager.preloadScene("office");
			manager.markSceneLoaded("office");
			manager.markSceneLoaded("hallway");

			expect(manager.isSceneLoading("lobby")).toBe(true);
			expect(manager.isSceneLoaded("office")).toBe(true);
			expect(manager.isSceneLoaded("hallway")).toBe(true);

			manager.reset();

			expect(manager.isSceneLoading("lobby")).toBe(false);
			expect(manager.isSceneLoaded("lobby")).toBe(false);
			expect(manager.isSceneLoaded("office")).toBe(false);
			expect(manager.isSceneLoaded("hallway")).toBe(false);
		});

		it("reset allows fresh state after clearing", () => {
			const manager = ScenePreloadManager.getInstance();

			// Initial state
			manager.setDependencies({ old_scene: ["old_dep"] });
			manager.markSceneLoaded("old_scene");

			manager.reset();

			// Set new state
			manager.setDependencies({ new_scene: ["new_dep"] });
			manager.preloadScene("new_scene");

			expect(manager.getDependencies("old_scene")).toEqual([]);
			expect(manager.getDependencies("new_scene")).toEqual(["new_dep"]);
			expect(manager.isSceneLoaded("old_scene")).toBe(false);
			expect(manager.isSceneLoading("new_scene")).toBe(true);
		});
	});
});
