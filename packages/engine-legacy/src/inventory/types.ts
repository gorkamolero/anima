/**
 * Item definition for the inventory system.
 * Items are defined statically and registered with the InventoryManager.
 */
export interface ItemDefinition {
	id: string;
	name: string;
	icon: string; // Emoji (pragmatic, no asset files needed)
	descriptions: {
		look: string | string[]; // Array for progressive descriptions
		use?: string; // Default "can't use that here" response
	};
	/** Combination recipes: { otherItemId: resultItemId } */
	combinesWith?: Record<string, string>;
}

/**
 * Runtime inventory item (subset of definition for UI).
 */
export interface InventoryItem {
	id: string;
	name: string;
	icon: string;
}

/**
 * Callbacks for inventory state changes.
 */
export interface InventoryCallbacks {
	onItemAdded?: (item: InventoryItem) => void;
	onItemRemoved?: (itemId: string) => void;
	onItemsCombined?: (itemA: string, itemB: string, result: string) => void;
	onChange?: (items: InventoryItem[]) => void;
}
