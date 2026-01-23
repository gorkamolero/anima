/**
 * GameState - Core state management singleton
 *
 * Manages all game state including:
 * - Character states (e.g., "opening", "angry", "happy")
 * - Boolean flags for game progression
 * - Inventory items (using Set for uniqueness)
 * - Money with clamping at 0
 */
export class GameState {
	private static instance: GameState;
	private characterStates: Map<string, string> = new Map();
	private flags: Map<string, boolean> = new Map();

	// Inventory system
	private inventoryItems: Set<string> = new Set();
	private money: number = 40; // Starting cash per spec

	private constructor() {
		// Private constructor enforces singleton pattern
	}

	public static getInstance(): GameState {
		if (!GameState.instance) {
			GameState.instance = new GameState();
		}
		return GameState.instance;
	}

	public getCharacterState(characterId: string): string {
		return this.characterStates.get(characterId) || "opening";
	}

	public setCharacterState(characterId: string, state: string): void {
		this.characterStates.set(characterId, state);
	}

	public getFlag(key: string): boolean {
		return this.flags.get(key) || false;
	}

	public setFlag(key: string, value: boolean): void {
		this.flags.set(key, value);
	}

	// Inventory methods - canonical short names
	public hasItem(itemId: string): boolean {
		return this.inventoryItems.has(itemId);
	}

	public addItem(itemId: string): void {
		this.inventoryItems.add(itemId);
	}

	public removeItem(itemId: string): void {
		this.inventoryItems.delete(itemId);
	}

	/**
	 * @deprecated Use hasItem() instead. Will be removed in next major version.
	 */
	public hasInventoryItem(itemId: string): boolean {
		return this.hasItem(itemId);
	}

	/**
	 * @deprecated Use addItem() instead. Will be removed in next major version.
	 */
	public addInventoryItem(itemId: string): void {
		this.addItem(itemId);
	}

	/**
	 * @deprecated Use removeItem() instead. Will be removed in next major version.
	 */
	public removeInventoryItem(itemId: string): void {
		this.removeItem(itemId);
	}

	public getInventory(): string[] {
		return Array.from(this.inventoryItems);
	}

	public clearInventory(): void {
		this.inventoryItems.clear();
	}

	// Money methods
	public getMoney(): number {
		return this.money;
	}

	public setMoney(amount: number): void {
		this.money = Math.max(0, amount);
	}

	public spendMoney(amount: number): boolean {
		if (amount < 0) return false;
		if (this.money < amount) {
			return false;
		}
		this.money -= amount;
		return true;
	}

	/**
	 * Reset all game state to initial values
	 * Used when restarting the game
	 */
	public reset(): void {
		this.characterStates.clear();
		this.flags.clear();
		this.inventoryItems.clear();
		this.money = 40;
	}
}
