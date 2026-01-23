/**
 * UIState - Observable UI state management singleton
 *
 * TDD: Tests written BEFORE implementation
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

// This import will fail until we implement UIState
import { UIState } from "../../ui/UIState";

describe("UIState", () => {
	let uiState: UIState;

	beforeEach(() => {
		// Reset singleton state before each test
		UIState.resetInstance();
		uiState = UIState.getInstance();
	});

	describe("singleton pattern", () => {
		it("returns the same instance on multiple calls", () => {
			const instance1 = UIState.getInstance();
			const instance2 = UIState.getInstance();

			expect(instance1).toBe(instance2);
		});
	});

	describe("scene name", () => {
		it("setSceneName() updates sceneName", () => {
			uiState.setSceneName("kitchen");

			expect(uiState.getSceneName()).toBe("kitchen");
		});

		it("getSceneName() returns current scene name", () => {
			expect(uiState.getSceneName()).toBe("");

			uiState.setSceneName("bedroom");
			expect(uiState.getSceneName()).toBe("bedroom");

			uiState.setSceneName("hallway");
			expect(uiState.getSceneName()).toBe("hallway");
		});
	});

	describe("hovered hotspot", () => {
		it("setHoveredHotspot(name, pos) sets hotspot info", () => {
			uiState.setHoveredHotspot("door", { x: 100, y: 200 });

			const hotspot = uiState.getHoveredHotspot();
			expect(hotspot).not.toBeNull();
			expect(hotspot?.name).toBe("door");
			expect(hotspot?.position).toEqual({ x: 100, y: 200 });
		});

		it("setHoveredHotspot(null) clears hotspot", () => {
			uiState.setHoveredHotspot("door", { x: 100, y: 200 });
			expect(uiState.getHoveredHotspot()).not.toBeNull();

			uiState.setHoveredHotspot(null);
			expect(uiState.getHoveredHotspot()).toBeNull();
		});

		it("getHoveredHotspot() returns current hotspot or null", () => {
			expect(uiState.getHoveredHotspot()).toBeNull();

			uiState.setHoveredHotspot("chest", { x: 50, y: 75 });
			expect(uiState.getHoveredHotspot()).toEqual({
				name: "chest",
				position: { x: 50, y: 75 },
			});
		});
	});

	describe("dialogue", () => {
		it("showDialogue(config) sets visible and content", () => {
			uiState.showDialogue({
				speaker: "NPC",
				text: "Hello there!",
				choices: [],
			});

			expect(uiState.isDialogueVisible()).toBe(true);
			const content = uiState.getDialogueContent();
			expect(content?.speaker).toBe("NPC");
			expect(content?.text).toBe("Hello there!");
		});

		it("hideDialogue() clears visible", () => {
			uiState.showDialogue({
				speaker: "NPC",
				text: "Hello!",
			});
			expect(uiState.isDialogueVisible()).toBe(true);

			uiState.hideDialogue();
			expect(uiState.isDialogueVisible()).toBe(false);
		});

		it("isDialogueVisible() returns correct state", () => {
			expect(uiState.isDialogueVisible()).toBe(false);

			uiState.showDialogue({ speaker: "NPC", text: "Hi" });
			expect(uiState.isDialogueVisible()).toBe(true);

			uiState.hideDialogue();
			expect(uiState.isDialogueVisible()).toBe(false);
		});

		it("getDialogueContent() returns speaker, text, choices, etc.", () => {
			const choices = [
				{ text: "Option A", index: 0 },
				{ text: "Option B", index: 1 },
			];

			uiState.showDialogue({
				speaker: "Wizard",
				text: "Choose wisely...",
				choices,
				speakerColor: "#ff0000",
			});

			const content = uiState.getDialogueContent();
			expect(content).not.toBeNull();
			expect(content?.speaker).toBe("Wizard");
			expect(content?.text).toBe("Choose wisely...");
			expect(content?.choices).toEqual(choices);
			expect(content?.speakerColor).toBe("#ff0000");
		});

		it("getDialogueContent() returns null when no dialogue shown", () => {
			expect(uiState.getDialogueContent()).toBeNull();
		});
	});

	describe("inventory", () => {
		it("addInventoryItem(item) appends to array", () => {
			uiState.addInventoryItem({
				id: "key",
				name: "Golden Key",
				icon: "key.png",
			});
			uiState.addInventoryItem({
				id: "potion",
				name: "Health Potion",
				icon: "potion.png",
			});

			const inventory = uiState.getInventory();
			expect(inventory).toHaveLength(2);
			expect(inventory[0].id).toBe("key");
			expect(inventory[1].id).toBe("potion");
		});

		it("removeInventoryItem(id) removes by id", () => {
			uiState.addInventoryItem({
				id: "key",
				name: "Golden Key",
				icon: "key.png",
			});
			uiState.addInventoryItem({
				id: "potion",
				name: "Health Potion",
				icon: "potion.png",
			});

			uiState.removeInventoryItem("key");

			const inventory = uiState.getInventory();
			expect(inventory).toHaveLength(1);
			expect(inventory[0].id).toBe("potion");
		});

		it("removeInventoryItem(id) does nothing for non-existent id", () => {
			uiState.addInventoryItem({
				id: "key",
				name: "Golden Key",
				icon: "key.png",
			});

			uiState.removeInventoryItem("nonexistent");

			expect(uiState.getInventory()).toHaveLength(1);
		});

		it("getInventory() returns current array", () => {
			expect(uiState.getInventory()).toEqual([]);

			uiState.addInventoryItem({
				id: "sword",
				name: "Sword",
				icon: "sword.png",
			});

			const inventory = uiState.getInventory();
			expect(inventory).toHaveLength(1);
			expect(inventory[0]).toEqual({
				id: "sword",
				name: "Sword",
				icon: "sword.png",
			});
		});

		it("getInventory() returns a copy to prevent external mutation", () => {
			uiState.addInventoryItem({ id: "key", name: "Key", icon: "key.png" });

			const inventory = uiState.getInventory();
			inventory.push({ id: "fake", name: "Fake", icon: "fake.png" });

			expect(uiState.getInventory()).toHaveLength(1);
		});
	});

	describe("verb selection", () => {
		it("setSelectedVerb(verb) sets verb", () => {
			uiState.setSelectedVerb("look");

			expect(uiState.getSelectedVerb()).toBe("look");
		});

		it("getSelectedVerb() returns current verb", () => {
			expect(uiState.getSelectedVerb()).toBeNull();

			uiState.setSelectedVerb("use");
			expect(uiState.getSelectedVerb()).toBe("use");

			uiState.setSelectedVerb("talk");
			expect(uiState.getSelectedVerb()).toBe("talk");
		});

		it("clearVerbSelection() clears verb and item", () => {
			uiState.setSelectedVerb("use");
			uiState.setSelectedItem({ id: "key", name: "Key", icon: "key.png" });

			uiState.clearVerbSelection();

			expect(uiState.getSelectedVerb()).toBeNull();
			expect(uiState.getSelectedItem()).toBeNull();
		});
	});

	describe("item selection", () => {
		it("setSelectedItem(item) sets item", () => {
			const item = { id: "key", name: "Golden Key", icon: "key.png" };
			uiState.setSelectedItem(item);

			expect(uiState.getSelectedItem()).toEqual(item);
		});

		it("getSelectedItem() returns current item", () => {
			expect(uiState.getSelectedItem()).toBeNull();

			const item = { id: "potion", name: "Potion", icon: "potion.png" };
			uiState.setSelectedItem(item);

			expect(uiState.getSelectedItem()).toEqual(item);
		});

		it("setSelectedItem(null) clears item", () => {
			uiState.setSelectedItem({ id: "key", name: "Key", icon: "key.png" });
			expect(uiState.getSelectedItem()).not.toBeNull();

			uiState.setSelectedItem(null);
			expect(uiState.getSelectedItem()).toBeNull();
		});
	});

	describe("scene loading", () => {
		it("showSceneLoading(true) sets loading", () => {
			uiState.showSceneLoading(true);

			expect(uiState.isSceneLoading()).toBe(true);
		});

		it("showSceneLoading(false) clears loading", () => {
			uiState.showSceneLoading(true);
			expect(uiState.isSceneLoading()).toBe(true);

			uiState.showSceneLoading(false);
			expect(uiState.isSceneLoading()).toBe(false);
		});

		it("isSceneLoading() returns state", () => {
			expect(uiState.isSceneLoading()).toBe(false);

			uiState.showSceneLoading(true);
			expect(uiState.isSceneLoading()).toBe(true);

			uiState.showSceneLoading(false);
			expect(uiState.isSceneLoading()).toBe(false);
		});
	});

	describe("subscriptions", () => {
		it("subscribe(callback) receives updates on changes", () => {
			const callback = vi.fn();
			uiState.subscribe(callback);

			uiState.setSceneName("kitchen");

			expect(callback).toHaveBeenCalled();
		});

		it("subscribe returns unsubscribe function", () => {
			const callback = vi.fn();
			const unsubscribe = uiState.subscribe(callback);

			expect(typeof unsubscribe).toBe("function");
		});

		it("unsubscribe() removes listener", () => {
			const callback = vi.fn();
			const unsubscribe = uiState.subscribe(callback);

			uiState.setSceneName("room1");
			expect(callback).toHaveBeenCalledTimes(1);

			unsubscribe();

			uiState.setSceneName("room2");
			expect(callback).toHaveBeenCalledTimes(1);
		});

		it("multiple subscribers all notified", () => {
			const callback1 = vi.fn();
			const callback2 = vi.fn();
			const callback3 = vi.fn();

			uiState.subscribe(callback1);
			uiState.subscribe(callback2);
			uiState.subscribe(callback3);

			uiState.setSelectedVerb("look");

			expect(callback1).toHaveBeenCalled();
			expect(callback2).toHaveBeenCalled();
			expect(callback3).toHaveBeenCalled();
		});

		it("unsubscribed callback not called", () => {
			const callback1 = vi.fn();
			const callback2 = vi.fn();

			const unsubscribe1 = uiState.subscribe(callback1);
			uiState.subscribe(callback2);

			unsubscribe1();

			uiState.showDialogue({ speaker: "NPC", text: "Hello" });

			expect(callback1).not.toHaveBeenCalled();
			expect(callback2).toHaveBeenCalled();
		});

		it("callback receives current state snapshot", () => {
			const callback = vi.fn();
			uiState.subscribe(callback);

			uiState.setSceneName("garden");

			expect(callback).toHaveBeenCalledWith(
				expect.objectContaining({
					sceneName: "garden",
				}),
			);
		});

		it("all state-changing methods trigger notifications", () => {
			const callback = vi.fn();
			uiState.subscribe(callback);

			uiState.setSceneName("room");
			uiState.setHoveredHotspot("door", { x: 0, y: 0 });
			uiState.showDialogue({ speaker: "A", text: "B" });
			uiState.hideDialogue();
			uiState.addInventoryItem({ id: "x", name: "X", icon: "x.png" });
			uiState.removeInventoryItem("x");
			uiState.setSelectedVerb("look");
			uiState.setSelectedItem({ id: "y", name: "Y", icon: "y.png" });
			uiState.clearVerbSelection();
			uiState.showSceneLoading(true);

			expect(callback).toHaveBeenCalledTimes(10);
		});
	});
});
