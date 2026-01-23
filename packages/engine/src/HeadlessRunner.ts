/**
 * HeadlessRunner - US-011: Headless Test Runner for CI
 */

import { EventBus, type GameEvent } from './EventBus'
import { GameRunner } from './GameRunner'

export interface HeadlessCommand {
  type:
    | 'enterScene'
    | 'selectChoice'
    | 'lookAt'
    | 'talkTo'
    | 'use'
    | 'assertFlag'
    | 'assertInventory'
    | 'assertScene'
    | 'assertEvent'
    | 'assertNotEvent'
  target?: string
  event?: string
  value?: unknown
  props?: Record<string, unknown>
}

export interface HeadlessResult {
  passed: boolean
  commands: number
  failures: string[]
  events: GameEvent[]
}

export class HeadlessRunner {
  private runner: GameRunner
  private eventBus: EventBus
  private events: GameEvent[] = []

  constructor(storyContent: string) {
    this.eventBus = new EventBus()
    this.eventBus.enableLogging()
    this.eventBus.subscribe((e) => this.events.push(e))

    this.runner = new GameRunner({
      storyContent,
      eventBus: this.eventBus,
    })
  }

  async run(commands: HeadlessCommand[]): Promise<HeadlessResult> {
    const failures: string[] = []
    let commandCount = 0
    const talkPromises: Promise<void>[] = []

    // Start the runner if not started
    this.runner.start()

    for (const cmd of commands) {
      commandCount++

      try {
        switch (cmd.type) {
          case 'enterScene':
            if (cmd.target) await this.runner.enterScene(cmd.target)
            break

          case 'selectChoice':
            if (typeof cmd.value === 'number') {
              this.runner.selectChoice(cmd.value)
            }
            break

          case 'lookAt':
            if (cmd.target) this.runner.lookAt(cmd.target)
            break

          case 'talkTo':
            // Start the talk, but don't await yet - store the promise
            if (cmd.target) {
              const promise = this.runner.talkTo(cmd.target)
              talkPromises.push(promise)
            }
            break

          case 'use':
            // Start the use, but don't await yet
            if (cmd.target) {
              const promise = this.runner.use(cmd.target)
              talkPromises.push(promise)
            }
            break

          case 'assertFlag':
          case 'assertInventory':
          case 'assertScene':
          case 'assertEvent':
          case 'assertNotEvent':
            // Wait for all pending talks/uses to complete before asserting
            if (talkPromises.length > 0) {
              await Promise.all(talkPromises)
              talkPromises.length = 0
            }
            // Then run assertion
            if (cmd.type === 'assertEvent') {
              const eventFound = this.events.some(
                (e) => e.type === cmd.event && (!cmd.props || Object.entries(cmd.props).every(([k, v]) => (e as Record<string, unknown>)[k] === v))
              )
              if (!eventFound) {
                failures.push(`Event assertion failed: expected event ${cmd.event} with props ${JSON.stringify(cmd.props)}`)
              }
            } else if (cmd.type === 'assertNotEvent') {
              const eventFound = this.events.some(
                (e) => e.type === cmd.event && (!cmd.props || Object.entries(cmd.props).every(([k, v]) => (e as Record<string, unknown>)[k] === v))
              )
              if (eventFound) {
                failures.push(`Event assertion failed: unexpected event ${cmd.event} with props ${JSON.stringify(cmd.props)}`)
              }
            } else if (cmd.type === 'assertFlag') {
              const actual = this.runner.getState().getFlag(cmd.target || '')
              if (actual !== cmd.value) {
                failures.push(
                  `Flag assertion failed: ${cmd.target} expected ${cmd.value}, got ${actual}`
                )
              }
            } else if (cmd.type === 'assertInventory') {
              const hasItem = this.runner.getState().hasItem(cmd.target || '')
              const expected = cmd.value !== false
              if (hasItem !== expected) {
                failures.push(
                  `Inventory assertion failed: ${cmd.target} expected ${expected ? 'present' : 'absent'}`
                )
              }
            } else if (cmd.type === 'assertScene') {
              const currentScene = this.runner.getState().getCurrentScene()
              if (currentScene !== cmd.target) {
                failures.push(`Scene assertion failed: expected ${cmd.target}, got ${currentScene}`)
              }
            }
            break
        }
      } catch (error) {
        failures.push(`Command ${cmd.type} failed: ${error}`)
      }
    }

    // Wait for any remaining talks/uses to complete
    if (talkPromises.length > 0) {
      await Promise.all(talkPromises)
    }

    return {
      passed: failures.length === 0,
      commands: commandCount,
      failures,
      events: this.events,
    }
  }

  getRunner(): GameRunner {
    return this.runner
  }

  getEvents(): GameEvent[] {
    return this.events
  }

  reset(): void {
    this.events = []
    this.eventBus.clearLog()
    this.runner.getState().reset()
  }
}

export async function runHeadless(
  storyContent: string,
  commands: HeadlessCommand[]
): Promise<HeadlessResult> {
  const runner = new HeadlessRunner(storyContent)
  return runner.run(commands)
}
