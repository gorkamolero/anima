/**
 * @anima/engine - UI-agnostic game engine
 *
 * Core game logic that any UI can subscribe to.
 * No rendering code. No DOM. No Phaser.
 */

export { EventBus } from './EventBus'
export type { GameEvent, EventHandler } from './EventBus'

export { GameState } from './GameState'
export type { GameStateSnapshot } from './GameState'

export { GameRunner, loadActsFromDirectory } from './GameRunner'
export type { GameRunnerConfig } from './GameRunner'

export * from './NPCManager'
export * from './HeadlessRunner'
