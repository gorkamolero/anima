/**
 * GameState - Core state management singleton
 *
 * TDD: Tests written BEFORE implementation
 */

import { beforeEach, describe, expect, it } from "vitest";

// This import will fail until we implement GameState
import { GameState } from "../../state/GameState";

describe("GameState", () => {
	beforeEach(() => {
		// Reset state before each test for isolation
		GameState.getInstance().reset();
	});

	describe("singleton pattern", () => {
		it("returns the same instance on multiple calls", () => {
			const instance1 = GameState.getInstance();
			const instance2 = GameState.getInstance();
			const instance3 = GameState.getInstance();

			expect(instance1).toBe(instance2);
			expect(instance2).toBe(instance3);
		});

		it("cannot be instantiated directly (singleton behavior)", () => {
			// The constructor should be private, so this test verifies
			// that getInstance is the only way to get an instance
			const instance = GameState.getInstance();
			expect(instance).toBeInstanceOf(GameState);

			// Verify it's always the same instance even after reset
			instance.reset();
			const instanceAfterReset = GameState.getInstance();
			expect(instance).toBe(instanceAfterReset);
		});
	});

	describe("character states", () => {
		it("returns 'opening' as default state for unknown characters", () => {
			const state = GameState.getInstance();

			expect(state.getCharacterState("jamal")).toBe("opening");
			expect(state.getCharacterState("unknown_character")).toBe("opening");
			expect(state.getCharacterState("any_npc")).toBe("opening");
		});

		it("sets and retrieves character state", () => {
			const state = GameState.getInstance();

			state.setCharacterState("jamal", "angry");
			expect(state.getCharacterState("jamal")).toBe("angry");

			state.setCharacterState("jamal", "happy");
			expect(state.getCharacterState("jamal")).toBe("happy");
		});

		it("tracks multiple characters independently", () => {
			const state = GameState.getInstance();

			state.setCharacterState("jamal", "angry");
			state.setCharacterState("sarah", "neutral");
			state.setCharacterState("bob", "excited");

			expect(state.getCharacterState("jamal")).toBe("angry");
			expect(state.getCharacterState("sarah")).toBe("neutral");
			expect(state.getCharacterState("bob")).toBe("excited");

			// Update one, others stay the same
			state.setCharacterState("sarah", "sad");
			expect(state.getCharacterState("jamal")).toBe("angry");
			expect(state.getCharacterState("sarah")).toBe("sad");
			expect(state.getCharacterState("bob")).toBe("excited");
		});
	});

	describe("flags", () => {
		it("returns false for unset flags", () => {
			const state = GameState.getInstance();

			expect(state.getFlag("unset_flag")).toBe(false);
			expect(state.getFlag("another_unset")).toBe(false);
			expect(state.getFlag("random_flag_name")).toBe(false);
		});

		it("sets and retrieves boolean flags (true and false)", () => {
			const state = GameState.getInstance();

			state.setFlag("quest_started", true);
			expect(state.getFlag("quest_started")).toBe(true);

			state.setFlag("quest_started", false);
			expect(state.getFlag("quest_started")).toBe(false);

			state.setFlag("door_opened", true);
			expect(state.getFlag("door_opened")).toBe(true);
		});

		it("tracks multiple flags independently", () => {
			const state = GameState.getInstance();

			state.setFlag("flag_a", true);
			state.setFlag("flag_b", false);
			state.setFlag("flag_c", true);

			expect(state.getFlag("flag_a")).toBe(true);
			expect(state.getFlag("flag_b")).toBe(false);
			expect(state.getFlag("flag_c")).toBe(true);

			// Update one, others stay the same
			state.setFlag("flag_a", false);
			expect(state.getFlag("flag_a")).toBe(false);
			expect(state.getFlag("flag_b")).toBe(false);
			expect(state.getFlag("flag_c")).toBe(true);
		});
	});

	describe("inventory", () => {
		it("starts with empty inventory", () => {
			const state = GameState.getInstance();

			expect(state.getInventory()).toEqual([]);
			expect(state.getInventory().length).toBe(0);
		});

		it("adds items to inventory", () => {
			const state = GameState.getInstance();

			state.addInventoryItem("key");
			expect(state.getInventory()).toContain("key");

			state.addInventoryItem("sword");
			expect(state.getInventory()).toContain("key");
			expect(state.getInventory()).toContain("sword");
		});

		it("checks if item exists in inventory", () => {
			const state = GameState.getInstance();

			expect(state.hasInventoryItem("key")).toBe(false);

			state.addInventoryItem("key");
			expect(state.hasInventoryItem("key")).toBe(true);
			expect(state.hasInventoryItem("sword")).toBe(false);
		});

		it("removes items from inventory", () => {
			const state = GameState.getInstance();

			state.addInventoryItem("key");
			state.addInventoryItem("sword");
			state.addInventoryItem("potion");

			state.removeInventoryItem("sword");

			expect(state.hasInventoryItem("key")).toBe(true);
			expect(state.hasInventoryItem("sword")).toBe(false);
			expect(state.hasInventoryItem("potion")).toBe(true);
		});

		it("returns all inventory items as array", () => {
			const state = GameState.getInstance();

			state.addInventoryItem("key");
			state.addInventoryItem("sword");
			state.addInventoryItem("potion");

			const inventory = state.getInventory();
			expect(inventory).toHaveLength(3);
			expect(inventory).toContain("key");
			expect(inventory).toContain("sword");
			expect(inventory).toContain("potion");
		});

		it("clears all inventory items", () => {
			const state = GameState.getInstance();

			state.addInventoryItem("key");
			state.addInventoryItem("sword");
			state.addInventoryItem("potion");

			state.clearInventory();

			expect(state.getInventory()).toEqual([]);
			expect(state.hasInventoryItem("key")).toBe(false);
			expect(state.hasInventoryItem("sword")).toBe(false);
			expect(state.hasInventoryItem("potion")).toBe(false);
		});

		it("cannot add duplicate items (Set behavior)", () => {
			const state = GameState.getInstance();

			state.addInventoryItem("key");
			state.addInventoryItem("key");
			state.addInventoryItem("key");

			expect(state.getInventory()).toHaveLength(1);
			expect(state.getInventory()).toEqual(["key"]);
		});
	});

	describe("money", () => {
		it("starts with default money amount (40)", () => {
			const state = GameState.getInstance();

			expect(state.getMoney()).toBe(40);
		});

		it("sets money to specific amount", () => {
			const state = GameState.getInstance();

			state.setMoney(100);
			expect(state.getMoney()).toBe(100);

			state.setMoney(0);
			expect(state.getMoney()).toBe(0);

			state.setMoney(999);
			expect(state.getMoney()).toBe(999);
		});

		it("prevents negative money (clamps at 0)", () => {
			const state = GameState.getInstance();

			state.setMoney(-50);
			expect(state.getMoney()).toBe(0);

			state.setMoney(-1);
			expect(state.getMoney()).toBe(0);

			state.setMoney(-1000);
			expect(state.getMoney()).toBe(0);
		});

		it("returns current money amount", () => {
			const state = GameState.getInstance();

			expect(state.getMoney()).toBe(40); // Default

			state.setMoney(75);
			expect(state.getMoney()).toBe(75);
		});

		it("spends money successfully if sufficient funds", () => {
			const state = GameState.getInstance();
			state.setMoney(100);

			const result = state.spendMoney(30);

			expect(result).toBe(true);
			expect(state.getMoney()).toBe(70);
		});

		it("spends exact amount when spending all money", () => {
			const state = GameState.getInstance();
			state.setMoney(50);

			const result = state.spendMoney(50);

			expect(result).toBe(true);
			expect(state.getMoney()).toBe(0);
		});

		it("fails to spend if insufficient funds", () => {
			const state = GameState.getInstance();
			state.setMoney(20);

			const result = state.spendMoney(30);

			expect(result).toBe(false);
			expect(state.getMoney()).toBe(20); // Amount unchanged
		});

		it("fails to spend more than available and keeps original amount", () => {
			const state = GameState.getInstance();
			state.setMoney(10);

			const result = state.spendMoney(100);

			expect(result).toBe(false);
			expect(state.getMoney()).toBe(10);
		});
	});

	describe("reset", () => {
		it("clears flags", () => {
			const state = GameState.getInstance();

			state.setFlag("flag_a", true);
			state.setFlag("flag_b", true);
			state.setFlag("flag_c", false);

			state.reset();

			expect(state.getFlag("flag_a")).toBe(false);
			expect(state.getFlag("flag_b")).toBe(false);
			expect(state.getFlag("flag_c")).toBe(false);
		});

		it("clears inventory", () => {
			const state = GameState.getInstance();

			state.addInventoryItem("key");
			state.addInventoryItem("sword");
			state.addInventoryItem("potion");

			state.reset();

			expect(state.getInventory()).toEqual([]);
			expect(state.hasInventoryItem("key")).toBe(false);
		});

		it("resets money to default (40)", () => {
			const state = GameState.getInstance();

			state.setMoney(1000);
			expect(state.getMoney()).toBe(1000);

			state.reset();

			expect(state.getMoney()).toBe(40);
		});

		it("resets character states (jamal back to 'opening')", () => {
			const state = GameState.getInstance();

			state.setCharacterState("jamal", "angry");
			state.setCharacterState("sarah", "happy");
			state.setCharacterState("bob", "neutral");

			state.reset();

			// All characters should return to default 'opening' state
			expect(state.getCharacterState("jamal")).toBe("opening");
			expect(state.getCharacterState("sarah")).toBe("opening");
			expect(state.getCharacterState("bob")).toBe("opening");
		});

		it("resets all state to initial values comprehensively", () => {
			const state = GameState.getInstance();

			// Set up various state
			state.setFlag("quest_complete", true);
			state.setFlag("door_open", true);
			state.addInventoryItem("magic_key");
			state.addInventoryItem("gold_coin");
			state.setMoney(500);
			state.setCharacterState("jamal", "furious");
			state.setCharacterState("merchant", "friendly");

			// Reset everything
			state.reset();

			// Verify all state is back to defaults
			expect(state.getFlag("quest_complete")).toBe(false);
			expect(state.getFlag("door_open")).toBe(false);
			expect(state.getInventory()).toEqual([]);
			expect(state.hasInventoryItem("magic_key")).toBe(false);
			expect(state.getMoney()).toBe(40);
			expect(state.getCharacterState("jamal")).toBe("opening");
			expect(state.getCharacterState("merchant")).toBe("opening");
		});
	});
});
