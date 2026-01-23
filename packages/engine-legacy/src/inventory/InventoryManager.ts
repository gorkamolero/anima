/**
 * InventoryManager - Inventory system management singleton
 *
 * Handles item registration, pickup/removal, descriptions,
 * money management, and item combinations.
 */

import { GameState } from "../state/GameState";
import { UIState } from "../ui/UIState";
import type { InventoryItem, ItemDefinition } from "./types";

export class InventoryManager {
	private static instance: InventoryManager | null = null;

	private itemDefinitions: Map<string, ItemDefinition> = new Map();
	private lookCounts: Map<string, number> = new Map();

	private constructor() {
		// Private constructor enforces singleton pattern
	}

	public static getInstance(): InventoryManager {
		if (!InventoryManager.instance) {
			InventoryManager.instance = new InventoryManager();
		}
		return InventoryManager.instance;
	}

	/**
	 * Reset singleton state for test isolation.
	 * Clears instance and internal state.
	 */
	public static reset(): void {
		if (InventoryManager.instance) {
			InventoryManager.instance.itemDefinitions.clear();
			InventoryManager.instance.lookCounts.clear();
		}
		InventoryManager.instance = null;
	}

	/**
	 * Register item definitions for the inventory system.
	 * @param definitions Array of item definitions to register
	 */
	public registerItems(definitions: ItemDefinition[]): void {
		for (const def of definitions) {
			this.itemDefinitions.set(def.id, def);
		}
	}

	/**
	 * Get an item definition by ID.
	 * @param itemId The item ID to look up
	 * @returns The item definition or undefined if not found
	 */
	public getItemDef(itemId: string): ItemDefinition | undefined {
		return this.itemDefinitions.get(itemId);
	}

	/**
	 * Check if player has an item in inventory.
	 * Delegates to GameState.
	 */
	public hasItem(itemId: string): boolean {
		return GameState.getInstance().hasItem(itemId);
	}

	/**
	 * Pick up an item - adds to inventory and updates UI.
	 * @param itemId The item ID to pick up
	 * @returns true if successful, false if unknown item or already owned
	 */
	public pickupItem(itemId: string): boolean {
		const itemDef = this.itemDefinitions.get(itemId);
		if (!itemDef) {
			console.warn(`InventoryManager: Cannot pick up unknown item: ${itemId}`);
			return false;
		}

		const gameState = GameState.getInstance();
		if (gameState.hasItem(itemId)) {
			console.warn(`InventoryManager: Item already in inventory: ${itemId}`);
			return false;
		}

		// Add to GameState
		gameState.addItem(itemId);

		// Notify UI via callbacks
		const uiState = UIState.getInstance();
		const callbacks = uiState.getInventoryCallbacks();
		const inventoryItem: InventoryItem = {
			id: itemDef.id,
			name: itemDef.name,
			icon: itemDef.icon,
		};

		callbacks.onItemAdded?.(inventoryItem);
		callbacks.onChange?.(this.getInventoryItems());

		return true;
	}

	/**
	 * Remove an item from inventory.
	 * @param itemId The item ID to remove
	 * @returns true if successful, false if item not owned
	 */
	public removeItem(itemId: string): boolean {
		const gameState = GameState.getInstance();
		if (!gameState.hasItem(itemId)) {
			console.warn(`InventoryManager: Cannot remove item not in inventory: ${itemId}`);
			return false;
		}

		gameState.removeItem(itemId);

		// Notify UI via callbacks
		const uiState = UIState.getInstance();
		const callbacks = uiState.getInventoryCallbacks();

		callbacks.onItemRemoved?.(itemId);
		callbacks.onChange?.(this.getInventoryItems());

		return true;
	}

	/**
	 * Get look description for an item.
	 * Handles progressive descriptions (arrays) by incrementing counter per look.
	 * @param itemId The item ID to get description for
	 * @returns The description string or undefined if item not found
	 */
	public getLookDescription(itemId: string): string | undefined {
		const itemDef = this.itemDefinitions.get(itemId);
		if (!itemDef) {
			return undefined;
		}

		const descriptions = itemDef.descriptions.look;

		// Single description
		if (typeof descriptions === "string") {
			return descriptions;
		}

		// Progressive descriptions (array)
		const count = this.lookCounts.get(itemId) || 0;
		const index = Math.min(count, descriptions.length - 1);
		this.lookCounts.set(itemId, count + 1);

		return descriptions[index];
	}

	/**
	 * Get use description for an item.
	 * @param itemId The item ID to get use description for
	 * @returns The use description or default "You can't use that here." if none specified
	 */
	public getUseDescription(itemId: string): string | undefined {
		const itemDef = this.itemDefinitions.get(itemId);
		if (!itemDef) {
			return undefined;
		}

		return itemDef.descriptions.use || "You can't use that here.";
	}

	/**
	 * Get current money amount.
	 * Delegates to GameState.
	 */
	public getMoney(): number {
		return GameState.getInstance().getMoney();
	}

	/**
	 * Spend money.
	 * Delegates to GameState.
	 * @param amount Amount to spend
	 * @returns true if successful, false if insufficient funds or negative amount
	 */
	public spendMoney(amount: number): boolean {
		if (amount < 0) {
			console.warn(`InventoryManager: Cannot spend negative amount: ${amount}`);
			return false;
		}
		const success = GameState.getInstance().spendMoney(amount);
		if (!success) {
			console.warn(`InventoryManager: Insufficient funds to spend: ${amount}`);
		}
		return success;
	}

	/**
	 * Combine two items together.
	 * Checks recipes bidirectionally (A+B or B+A).
	 * @param itemA First item ID
	 * @param itemB Second item ID
	 * @returns Result item ID if successful, null if no recipe or items not owned
	 */
	public combineItems(itemA: string, itemB: string): string | null {
		const gameState = GameState.getInstance();

		// Check player has both items
		if (!gameState.hasItem(itemA) || !gameState.hasItem(itemB)) {
			console.warn(
				`InventoryManager: Cannot combine items - missing item(s): ${itemA}, ${itemB}`,
			);
			return null;
		}

		// Check recipe in both directions
		const defA = this.itemDefinitions.get(itemA);
		const defB = this.itemDefinitions.get(itemB);

		let resultId: string | null = null;

		// Check A combines with B
		if (defA?.combinesWith?.[itemB]) {
			resultId = defA.combinesWith[itemB];
		}
		// Check B combines with A
		else if (defB?.combinesWith?.[itemA]) {
			resultId = defB.combinesWith[itemA];
		}

		if (!resultId) {
			console.warn(
				`InventoryManager: No recipe found for combining: ${itemA} + ${itemB}`,
			);
			return null;
		}

		// Validate result item exists before modifying inventory
		if (!this.itemDefinitions.has(resultId)) {
			console.warn(
				`InventoryManager: Recipe result item not registered: ${resultId}`,
			);
			return null;
		}

		// Remove source items
		gameState.removeItem(itemA);
		gameState.removeItem(itemB);

		// Add result item
		gameState.addItem(resultId);

		// Notify UI via callbacks
		const uiState = UIState.getInstance();
		const callbacks = uiState.getInventoryCallbacks();

		callbacks.onItemsCombined?.(itemA, itemB, resultId);
		callbacks.onChange?.(this.getInventoryItems());

		return resultId;
	}

	/**
	 * Get all inventory item IDs.
	 * Delegates to GameState.
	 */
	public getInventory(): string[] {
		return GameState.getInstance().getInventory();
	}

	/**
	 * Get all inventory items as InventoryItem objects.
	 * Filters out unknown item IDs.
	 */
	public getInventoryItems(): InventoryItem[] {
		const itemIds = GameState.getInstance().getInventory();
		const items: InventoryItem[] = [];

		for (const id of itemIds) {
			const def = this.itemDefinitions.get(id);
			if (def) {
				items.push({
					id: def.id,
					name: def.name,
					icon: def.icon,
				});
			}
		}

		return items;
	}

	/**
	 * Reset manager state.
	 * Clears lookCounts and itemDefinitions.
	 */
	public reset(): void {
		this.lookCounts.clear();
		this.itemDefinitions.clear();
	}
}
