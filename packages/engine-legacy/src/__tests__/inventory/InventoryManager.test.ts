/**
 * InventoryManager - Inventory system management singleton
 *
 * TDD: Tests written BEFORE implementation
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InventoryCallbacks, ItemDefinition } from "../../inventory/types";

// Mock GameState
const mockGameState = {
	addItem: vi.fn(),
	removeItem: vi.fn(),
	hasItem: vi.fn(),
	getInventory: vi.fn(() => []),
	getMoney: vi.fn(() => 40),
	spendMoney: vi.fn(() => true),
};

vi.mock("../../state/GameState", () => ({
	GameState: {
		getInstance: vi.fn(() => mockGameState),
	},
}));

// Mock UIState
const mockUICallbacks: InventoryCallbacks = {
	onItemAdded: vi.fn(),
	onItemRemoved: vi.fn(),
	onItemsCombined: vi.fn(),
	onChange: vi.fn(),
};

const mockUIState = {
	getInventoryCallbacks: vi.fn(() => mockUICallbacks),
};

vi.mock("../../ui/UIState", () => ({
	UIState: {
		getInstance: vi.fn(() => mockUIState),
	},
}));

// Import after mocks are set up
import { InventoryManager } from "../../inventory/InventoryManager";

// Test item definitions
const testItems: ItemDefinition[] = [
	{
		id: "key",
		name: "Brass Key",
		icon: "🔑",
		descriptions: {
			look: "A tarnished brass key.",
			use: "You try the key, but it doesn't fit.",
		},
	},
	{
		id: "coin",
		name: "Gold Coin",
		icon: "🪙",
		descriptions: {
			look: [
				"A shiny gold coin.",
				"The coin has a strange symbol on it.",
				"You notice tiny inscriptions around the edge.",
			],
		},
	},
	{
		id: "rope",
		name: "Rope",
		icon: "🪢",
		descriptions: {
			look: "A sturdy length of rope.",
		},
		combinesWith: {
			hook: "grappling_hook",
		},
	},
	{
		id: "hook",
		name: "Metal Hook",
		icon: "🪝",
		descriptions: {
			look: "A sharp metal hook.",
		},
		combinesWith: {
			rope: "grappling_hook",
		},
	},
	{
		id: "grappling_hook",
		name: "Grappling Hook",
		icon: "⚓",
		descriptions: {
			look: "A makeshift grappling hook.",
			use: "You swing the grappling hook...",
		},
	},
];

describe("InventoryManager", () => {
	let manager: InventoryManager;

	beforeEach(() => {
		// Reset singleton for test isolation
		InventoryManager.reset();

		// Clear all mocks
		vi.clearAllMocks();

		// Reset mock implementations to defaults
		mockGameState.getInventory.mockReturnValue([]);
		mockGameState.hasItem.mockReturnValue(false);
		mockGameState.addItem.mockReturnValue(true);
		mockGameState.removeItem.mockReturnValue(true);
		mockGameState.getMoney.mockReturnValue(40);
		mockGameState.spendMoney.mockReturnValue(true);

		// Get fresh instance
		manager = InventoryManager.getInstance();
	});

	describe("singleton pattern", () => {
		it("getInstance returns same instance", () => {
			const instance1 = InventoryManager.getInstance();
			const instance2 = InventoryManager.getInstance();

			expect(instance1).toBe(instance2);
		});

		it("reset() clears singleton state for test isolation", () => {
			const instance1 = InventoryManager.getInstance();
			instance1.registerItems(testItems);

			InventoryManager.reset();

			const instance2 = InventoryManager.getInstance();
			// After reset, item definitions should be cleared
			expect(instance2.getItemDef("key")).toBeUndefined();
		});
	});

	describe("item registration", () => {
		it("registerItems() stores definitions", () => {
			manager.registerItems(testItems);

			// All items should be retrievable
			expect(manager.getItemDef("key")).toBeDefined();
			expect(manager.getItemDef("coin")).toBeDefined();
			expect(manager.getItemDef("rope")).toBeDefined();
		});

		it("getItemDef() retrieves registered item", () => {
			manager.registerItems(testItems);

			const keyDef = manager.getItemDef("key");

			expect(keyDef).toEqual({
				id: "key",
				name: "Brass Key",
				icon: "🔑",
				descriptions: {
					look: "A tarnished brass key.",
					use: "You try the key, but it doesn't fit.",
				},
			});
		});

		it("getItemDef() returns undefined for unknown items", () => {
			manager.registerItems(testItems);

			const unknownDef = manager.getItemDef("nonexistent");

			expect(unknownDef).toBeUndefined();
		});
	});

	describe("pickup and remove", () => {
		beforeEach(() => {
			manager.registerItems(testItems);
		});

		it("pickupItem() adds to inventory via GameState", () => {
			mockGameState.hasItem.mockReturnValue(false);

			const result = manager.pickupItem("key");

			expect(result).toBe(true);
			expect(mockGameState.addItem).toHaveBeenCalledWith("key");
		});

		it("pickupItem() calls UIState callback", () => {
			mockGameState.hasItem.mockReturnValue(false);

			manager.pickupItem("key");

			expect(mockUICallbacks.onItemAdded).toHaveBeenCalledWith({
				id: "key",
				name: "Brass Key",
				icon: "🔑",
			});
		});

		it("pickupItem() returns false for unknown item", () => {
			const result = manager.pickupItem("nonexistent");

			expect(result).toBe(false);
			expect(mockGameState.addItem).not.toHaveBeenCalled();
		});

		it("pickupItem() returns false for duplicate", () => {
			mockGameState.hasItem.mockReturnValue(true);

			const result = manager.pickupItem("key");

			expect(result).toBe(false);
			expect(mockGameState.addItem).not.toHaveBeenCalled();
		});

		it("removeItem() removes from inventory", () => {
			mockGameState.hasItem.mockReturnValue(true);

			const result = manager.removeItem("key");

			expect(result).toBe(true);
			expect(mockGameState.removeItem).toHaveBeenCalledWith("key");
		});

		it("removeItem() calls UIState callback", () => {
			mockGameState.hasItem.mockReturnValue(true);

			manager.removeItem("key");

			expect(mockUICallbacks.onItemRemoved).toHaveBeenCalledWith("key");
		});

		it("removeItem() returns false for non-existent", () => {
			mockGameState.hasItem.mockReturnValue(false);

			const result = manager.removeItem("key");

			expect(result).toBe(false);
			expect(mockGameState.removeItem).not.toHaveBeenCalled();
		});
	});

	describe("has item", () => {
		beforeEach(() => {
			manager.registerItems(testItems);
		});

		it("hasItem() returns true for owned items", () => {
			mockGameState.hasItem.mockReturnValue(true);

			const result = manager.hasItem("key");

			expect(result).toBe(true);
			expect(mockGameState.hasItem).toHaveBeenCalledWith("key");
		});

		it("hasItem() returns false for not owned", () => {
			mockGameState.hasItem.mockReturnValue(false);

			const result = manager.hasItem("key");

			expect(result).toBe(false);
			expect(mockGameState.hasItem).toHaveBeenCalledWith("key");
		});
	});

	describe("descriptions", () => {
		beforeEach(() => {
			manager.registerItems(testItems);
		});

		it("getLookDescription() returns string description", () => {
			const description = manager.getLookDescription("key");

			expect(description).toBe("A tarnished brass key.");
		});

		it("getLookDescription() handles progressive descriptions (array)", () => {
			const description = manager.getLookDescription("coin");

			expect(description).toBe("A shiny gold coin.");
		});

		it("getLookDescription() increments counter per look", () => {
			const desc1 = manager.getLookDescription("coin");
			const desc2 = manager.getLookDescription("coin");
			const desc3 = manager.getLookDescription("coin");

			expect(desc1).toBe("A shiny gold coin.");
			expect(desc2).toBe("The coin has a strange symbol on it.");
			expect(desc3).toBe("You notice tiny inscriptions around the edge.");
		});

		it("getLookDescription() caps at last description", () => {
			// Look 4 times (array only has 3 items)
			manager.getLookDescription("coin");
			manager.getLookDescription("coin");
			manager.getLookDescription("coin");
			const desc4 = manager.getLookDescription("coin");

			expect(desc4).toBe("You notice tiny inscriptions around the edge.");
		});

		it("getUseDescription() returns use description", () => {
			const description = manager.getUseDescription("key");

			expect(description).toBe("You try the key, but it doesn't fit.");
		});

		it("getUseDescription() returns default if none specified", () => {
			const description = manager.getUseDescription("rope");

			expect(description).toBe("You can't use that here.");
		});

		it("getLookDescription() returns undefined for unknown item", () => {
			const description = manager.getLookDescription("nonexistent");

			expect(description).toBeUndefined();
		});

		it("getUseDescription() returns undefined for unknown item", () => {
			const description = manager.getUseDescription("nonexistent");

			expect(description).toBeUndefined();
		});
	});

	describe("money", () => {
		it("getMoney() returns GameState money", () => {
			mockGameState.getMoney.mockReturnValue(100);

			const money = manager.getMoney();

			expect(money).toBe(100);
			expect(mockGameState.getMoney).toHaveBeenCalled();
		});

		it("spendMoney() deducts if sufficient (returns true)", () => {
			mockGameState.spendMoney.mockReturnValue(true);

			const result = manager.spendMoney(20);

			expect(result).toBe(true);
			expect(mockGameState.spendMoney).toHaveBeenCalledWith(20);
		});

		it("spendMoney() fails if insufficient (returns false)", () => {
			mockGameState.spendMoney.mockReturnValue(false);

			const result = manager.spendMoney(100);

			expect(result).toBe(false);
			expect(mockGameState.spendMoney).toHaveBeenCalledWith(100);
		});
	});

	describe("combinations", () => {
		beforeEach(() => {
			manager.registerItems(testItems);
			mockGameState.hasItem.mockReturnValue(true);
		});

		it("combineItems() returns result item ID if recipe exists", () => {
			const result = manager.combineItems("rope", "hook");

			expect(result).toBe("grappling_hook");
		});

		it("combineItems() removes source items", () => {
			manager.combineItems("rope", "hook");

			expect(mockGameState.removeItem).toHaveBeenCalledWith("rope");
			expect(mockGameState.removeItem).toHaveBeenCalledWith("hook");
		});

		it("combineItems() adds result item", () => {
			manager.combineItems("rope", "hook");

			expect(mockGameState.addItem).toHaveBeenCalledWith("grappling_hook");
		});

		it("combineItems() calls UIState callback", () => {
			manager.combineItems("rope", "hook");

			expect(mockUICallbacks.onItemsCombined).toHaveBeenCalledWith(
				"rope",
				"hook",
				"grappling_hook",
			);
		});

		it("combineItems() returns null if no recipe", () => {
			const result = manager.combineItems("key", "coin");

			expect(result).toBeNull();
			expect(mockGameState.removeItem).not.toHaveBeenCalled();
			expect(mockGameState.addItem).not.toHaveBeenCalled();
		});

		it("combineItems() is bidirectional (A+B = B+A)", () => {
			// Reset mocks between calls
			vi.clearAllMocks();
			mockGameState.hasItem.mockReturnValue(true);

			const result1 = manager.combineItems("rope", "hook");

			vi.clearAllMocks();
			mockGameState.hasItem.mockReturnValue(true);

			const result2 = manager.combineItems("hook", "rope");

			expect(result1).toBe("grappling_hook");
			expect(result2).toBe("grappling_hook");
		});

		it("combineItems() returns null if player doesn't have first item", () => {
			mockGameState.hasItem.mockImplementation((id: string) => id !== "rope");

			const result = manager.combineItems("rope", "hook");

			expect(result).toBeNull();
		});

		it("combineItems() returns null if player doesn't have second item", () => {
			mockGameState.hasItem.mockImplementation((id: string) => id !== "hook");

			const result = manager.combineItems("rope", "hook");

			expect(result).toBeNull();
		});
	});

	describe("getInventoryItems", () => {
		beforeEach(() => {
			manager.registerItems(testItems);
		});

		it("returns empty array when no items", () => {
			mockGameState.getInventory.mockReturnValue([]);

			const items = manager.getInventoryItems();

			expect(items).toEqual([]);
		});

		it("returns InventoryItem objects for owned items", () => {
			mockGameState.getInventory.mockReturnValue(["key", "coin"]);

			const items = manager.getInventoryItems();

			expect(items).toHaveLength(2);
			expect(items).toContainEqual({
				id: "key",
				name: "Brass Key",
				icon: "🔑",
			});
			expect(items).toContainEqual({
				id: "coin",
				name: "Gold Coin",
				icon: "🪙",
			});
		});

		it("filters out unknown item IDs from GameState", () => {
			mockGameState.getInventory.mockReturnValue([
				"key",
				"unknown_item",
				"coin",
			]);

			const items = manager.getInventoryItems();

			expect(items).toHaveLength(2);
			expect(items.map((i) => i.id)).not.toContain("unknown_item");
		});
	});

	describe("callbacks onChange", () => {
		beforeEach(() => {
			manager.registerItems(testItems);
		});

		it("pickupItem() calls onChange with updated inventory", () => {
			mockGameState.hasItem.mockReturnValue(false);
			mockGameState.getInventory.mockReturnValue(["key"]);

			manager.pickupItem("key");

			expect(mockUICallbacks.onChange).toHaveBeenCalled();
		});

		it("removeItem() calls onChange with updated inventory", () => {
			mockGameState.hasItem.mockReturnValue(true);
			mockGameState.getInventory.mockReturnValue([]);

			manager.removeItem("key");

			expect(mockUICallbacks.onChange).toHaveBeenCalled();
		});

		it("combineItems() calls onChange after successful combination", () => {
			mockGameState.hasItem.mockReturnValue(true);
			mockGameState.getInventory.mockReturnValue(["grappling_hook"]);

			manager.combineItems("rope", "hook");

			expect(mockUICallbacks.onChange).toHaveBeenCalled();
		});
	});
});
