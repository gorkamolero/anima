/**
 * GameState - Immutable state container
 *
 * Unlike the legacy singleton, this is a pure data object
 * that can be serialized, restored, and passed around.
 */

import type { EventBus } from './EventBus'

export interface GameStateSnapshot {
  currentScene: string
  flags: Record<string, boolean | string | number>
  inventory: string[]
  visitedScenes: string[]
  npcStates: Record<string, string>
  variables: Record<string, unknown>
}

export class GameState {
  private state: GameStateSnapshot
  private eventBus?: EventBus

  constructor(initial?: Partial<GameStateSnapshot>, eventBus?: EventBus) {
    this.state = {
      currentScene: initial?.currentScene ?? '',
      flags: initial?.flags ?? {},
      inventory: initial?.inventory ?? [],
      visitedScenes: initial?.visitedScenes ?? [],
      npcStates: initial?.npcStates ?? {},
      variables: initial?.variables ?? {},
    }
    this.eventBus = eventBus
  }

  setEventBus(eventBus: EventBus): void {
    this.eventBus = eventBus
  }

  // Scene
  getCurrentScene(): string {
    return this.state.currentScene
  }

  setCurrentScene(sceneId: string): void {
    if (!this.state.visitedScenes.includes(sceneId)) {
      this.state.visitedScenes.push(sceneId)
    }
    this.state.currentScene = sceneId
  }

  hasVisited(sceneId: string): boolean {
    return this.state.visitedScenes.includes(sceneId)
  }

  // Flags
  getFlag(key: string): boolean | string | number | undefined {
    return this.state.flags[key]
  }

  getAllFlags(): Record<string, string | number | boolean> {
    return { ...this.state.flags }
  }

  setFlag(key: string, value: boolean | string | number): void {
    this.state.flags[key] = value
    if (this.eventBus) {
      this.eventBus.emit({ type: 'flag:set', flag: key, value })
    }
  }

  // Inventory
  hasItem(itemId: string): boolean {
    return this.state.inventory.includes(itemId)
  }

  addItem(itemId: string): void {
    if (!this.hasItem(itemId)) {
      this.state.inventory.push(itemId)
    }
  }

  removeItem(itemId: string): void {
    this.state.inventory = this.state.inventory.filter((id) => id !== itemId)
  }

  getInventory(): string[] {
    return [...this.state.inventory]
  }

  // NPC States
  getNpcState(npcId: string): string {
    return this.state.npcStates[npcId] ?? 'default'
  }

  setNpcState(npcId: string, state: string): void {
    this.state.npcStates[npcId] = state
  }

  // Variables (for custom data)
  getVariable<T>(key: string): T | undefined {
    return this.state.variables[key] as T
  }

  setVariable(key: string, value: unknown): void {
    this.state.variables[key] = value
  }

  // Serialization
  toJSON(): GameStateSnapshot {
    return JSON.parse(JSON.stringify(this.state))
  }

  static fromJSON(json: GameStateSnapshot, eventBus?: EventBus): GameState {
    return new GameState(json, eventBus)
  }

  // Reset
  reset(): void {
    this.state = {
      currentScene: '',
      flags: {},
      inventory: [],
      visitedScenes: [],
      npcStates: {},
      variables: {},
    }
  }
}
