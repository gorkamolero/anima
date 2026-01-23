/**
 * GameRunner - Orchestrates game execution
 *
 * Connects StoryScript interpreter to the event bus.
 * UI-agnostic - just emits events, doesn't render.
 */

import { type StoryHandlers, StoryInterpreter } from '@anima/storyscript'
import { EventBus } from './EventBus'
import { GameState } from './GameState'

export interface GameRunnerConfig {
  /** Single story content (legacy) */
  storyContent?: string
  /** Multiple act files for consolidated playthrough */
  actContents?: string[]
  eventBus?: EventBus
  initialState?: GameState
}

/**
 * Load all act files from a directory.
 * Sorts by act number (e.g., act1.story, act2.story).
 * Node.js only - not available in browser.
 */
export async function loadActsFromDirectory(
  storyDir: string
): Promise<string[]> {
  const { readdir, readFile } = await import('node:fs/promises')
  const { join } = await import('node:path')

  const files = await readdir(storyDir)

  // Filter to only act*.story files and sort by act number
  const actFiles = files
    .filter((f) => f.endsWith('.story') && /act\d+/i.test(f))
    .sort((a, b) => {
      const numA = parseInt(a.match(/act(\d+)/i)?.[1] || '0', 10)
      const numB = parseInt(b.match(/act(\d+)/i)?.[1] || '0', 10)
      return numA - numB
    })

  // Read all act contents
  const actContents = await Promise.all(
    actFiles.map((f) => readFile(join(storyDir, f), 'utf-8'))
  )

  return actContents
}

export class GameRunner {
  private eventBus: EventBus
  private state: GameState
  private actContents: string[] = []
  private currentActIndex = 0
  private running = false
  private interpreter: StoryInterpreter
  private choiceResolvers: ((index: number) => void)[] = []
  private continueResolver: (() => void) | null = null
  private choiceQueue: number[] = []
  private dialogueChoiceQueues: number[][] = []

  constructor(config: GameRunnerConfig) {
    // Support both legacy single content and multi-act
    if (config.actContents && config.actContents.length > 0) {
      this.actContents = config.actContents
    } else if (config.storyContent) {
      this.actContents = [config.storyContent]
    } else {
      throw new Error('GameRunner requires storyContent or actContents')
    }

    this.eventBus = config.eventBus ?? new EventBus()
    this.state = config.initialState ?? new GameState({}, this.eventBus)
    if (config.initialState) {
      this.state.setEventBus(this.eventBus)
    }
    this.interpreter = new StoryInterpreter()
    this.interpreter.loadContent(this.actContents[0])
    this.setupHandlers()
  }

  private setupHandlers(): void {
    const handlers: StoryHandlers = {
      onLine: async (line) => {
        this.eventBus.emit({
          type: 'dialogue:line',
          speaker: line.speaker || 'narrator',
          text: line.text,
        })

        // Auto-continue for headless testing (UI can override by calling continue)
        return new Promise<void>((resolve) => {
          this.continueResolver = resolve
          resolve() // Resolve immediately for auto-advance
        })
      },
      onChoice: async (choices) => {
        return new Promise<number>((resolve) => {
          this.choiceResolvers.push(resolve)
          this.eventBus.emit({
            type: 'dialogue:choice',
            choices: choices.map((c, i) => ({ index: i + 1, text: c.text })),
          })

          // Check if there's a queued choice (for pre-queuing support)
          if (this.dialogueChoiceQueues.length > 0) {
            const currentQueue = this.dialogueChoiceQueues[this.dialogueChoiceQueues.length - 1]
            if (currentQueue.length > 0) {
              const choiceIndex = currentQueue.shift()!
              this.eventBus.emit({
                type: 'dialogue:choice:resolve',
                selectedIndex: choiceIndex,
              })
              resolve(choiceIndex)
            }
          }
        })
      },
      onSetFlag: (name, value) => {
        this.state.setFlag(name, value)
        this.eventBus.emit({ type: 'flag:set', flag: name, value })
      },
      onGiveItem: (item) => {
        this.state.addItem(item)
        this.eventBus.emit({ type: 'inventory:add', itemId: item })
      },
      onDialogueStart: (id) => {
        this.dialogueChoiceQueues.push([])
        const newQueue = this.dialogueChoiceQueues[this.dialogueChoiceQueues.length - 1]

        // Transfer any pre-queued choices to the new dialogue queue
        if (this.choiceQueue.length > 0) {
          newQueue.push(...this.choiceQueue)
          this.choiceQueue.length = 0 // Clear the pre-queue
        } else if (this.dialogueChoiceQueues.length > 1) {
          // For nested dialogues, check if parent queue has remaining choices
          // This handles the case where multiple choices are pre-queued for nested dialogues
          const parentQueue = this.dialogueChoiceQueues[this.dialogueChoiceQueues.length - 2]
          if (parentQueue.length > 0) {
            // Transfer remaining choices from parent to nested dialogue
            newQueue.push(...parentQueue)
            parentQueue.length = 0
          }
        }

        this.eventBus.emit({ type: 'dialogue:start', dialogueId: id })
      },
      onDialogueEnd: () => {
        this.dialogueChoiceQueues.pop()
        this.eventBus.emit({ type: 'dialogue:end' })
      },
      onSceneEnter: (sceneId) => {
        const previousScene = this.state.getCurrentScene()
        if (previousScene && previousScene !== sceneId) {
          this.eventBus.emit({ type: 'scene:exit', sceneId: previousScene })
        }

        this.state.setCurrentScene(sceneId)

        const scene = this.interpreter.getScene(sceneId)
        this.eventBus.emit({
          type: 'scene:enter',
          sceneId,
          description: scene?.description || [],
        })
      },
      onTrigger: (triggerId) => {
        this.eventBus.emit({ type: 'trigger:execute', triggerId })
      },
      onCutscene: async (lines) => {
        this.eventBus.emit({ type: 'cutscene:start' })

        // Parse and emit each cutscene line
        for (const line of lines) {
          const dialogueMatch = line.match(/^(\w+)(?:\s*\(thinks\))?:\s*"(.+)"$/)
          if (dialogueMatch) {
            const [, speaker, text] = dialogueMatch
            this.eventBus.emit({ type: 'cutscene:line', speaker, text })
          } else if (line.startsWith('"') && line.endsWith('"')) {
            // Narration
            this.eventBus.emit({ type: 'cutscene:line', text: line.slice(1, -1) })
          } else if (line.trim()) {
            // Plain text
            this.eventBus.emit({ type: 'cutscene:line', text: line })
          }
        }

        this.eventBus.emit({ type: 'cutscene:end' })
      },
      onActComplete: (actId, state) => {
        // Set act completion flag in game state
        this.state.setFlag(`act_${actId}_complete`, true)

        this.eventBus.emit({
          type: 'act:complete',
          actId,
          state,
        })

        // Auto-advance to next act if available
        this.advanceToNextAct()
      },
    }
    this.interpreter.setHandlers(handlers)
  }

  getEventBus(): EventBus {
    return this.eventBus
  }

  getState(): GameState {
    return this.state
  }

  syncState(): void {
    // Sync inventory
    const inventory = this.state.getInventory()
    this.interpreter.setInventory(inventory)

    // Sync flags
    const flags = this.state.getAllFlags()
    this.interpreter.setFlags(flags)

    // Sync scene
    const currentScene = this.state.getCurrentScene()
    if (currentScene) {
      this.interpreter.setCurrentScene(currentScene)
    }
  }

  /**
   * Advances to the next act if available.
   * Called automatically when ACT_END is reached.
   */
  private advanceToNextAct(): void {
    this.currentActIndex++

    if (this.currentActIndex < this.actContents.length) {
      // Load next act
      const nextActContent = this.actContents[this.currentActIndex]
      this.interpreter.loadContent(nextActContent)

      // Sync current state to new interpreter
      this.syncState()

      // Emit act start event
      this.eventBus.emit({ type: 'act:start', actId: this.currentActIndex + 1 })

      // Enter the first scene of the new act
      const interpreterState = this.interpreter.getState()
      if (interpreterState.scene) {
        this.enterScene(interpreterState.scene)
      }
    } else {
      // No more acts - game complete
      this.eventBus.emit({ type: 'game:end' })
    }
  }

  /** Get current act number (1-indexed) */
  getCurrentAct(): number {
    return this.currentActIndex + 1
  }

  /** Check if there are more acts after the current one */
  hasNextAct(): boolean {
    return this.currentActIndex + 1 < this.actContents.length
  }

  start(): void {
    this.running = true
    this.eventBus.emit({ type: 'game:start' })

    // Check internal state of interpreter
    const interpreterState = this.interpreter.getState()
    if (interpreterState.scene) {
      this.enterScene(interpreterState.scene)
    }
  }

  stop(): void {
    this.running = false
  }

  isRunning(): boolean {
    return this.running
  }

  continue(): void {
    if (this.continueResolver) {
      const resolve = this.continueResolver
      this.continueResolver = null
      resolve()
    }
  }

  // Commands that UI can call
  async enterScene(sceneId: string): Promise<void> {
    // We delegate to interpreter.
    // It will trigger onSceneEnter -> emit events
    await this.interpreter.enterScene(sceneId)
  }

  lookAt(hotspotId: string): void {
    const sceneId = this.state.getCurrentScene()
    if (!sceneId) return

    const scene = this.interpreter.getScene(sceneId)
    if (!scene) return

    const hotspot = scene.hotspots.get(hotspotId)
    if (hotspot) {
      this.eventBus.emit({
        type: 'hotspot:look',
        hotspotId,
        text: hotspot.look,
      })
      // Optionally execute look script?
      // Old code just emitted event with text array.
      // If we want to run it:
      // this.executeScript(hotspot.look);
    }
  }

  async talkTo(hotspotId: string): Promise<void> {
    const sceneId = this.state.getCurrentScene()
    if (!sceneId) return

    const scene = this.interpreter.getScene(sceneId)
    if (!scene) return

    const hotspot = scene.hotspots.get(hotspotId)
    if (!hotspot) return

    this.eventBus.emit({ type: 'hotspot:talk', hotspotId })

    if (hotspot.talk.length > 0) {
      // Don't manually emit dialogue:start/end here
      // If the TALK block contains -> dialogue, the interpreter will emit the correct events
      await this.executeScript(hotspot.talk)
    }
  }

  async use(hotspotId: string): Promise<void> {
    const sceneId = this.state.getCurrentScene()
    if (!sceneId) return

    const scene = this.interpreter.getScene(sceneId)
    if (!scene) return

    const hotspot = scene.hotspots.get(hotspotId)
    if (!hotspot) return

    this.eventBus.emit({ type: 'hotspot:use', hotspotId })

    if (hotspot.use.length > 0) {
      await this.executeScript(hotspot.use)
    }
  }

  private async executeScript(lines: string[]): Promise<void> {
    // This will block while the script runs (waiting for continue())
    const result = await this.interpreter.executeLines(lines)

    if (result.goto) {
      // interpreter doesn't auto-handle goto if it's returned from executeLines
      // We need to handle it.
      // Actually interpreter logic handles goto internally if it encounters it?
      // executeLines returns goto if it hits a -> line.
      // We need to manually handle it.
      // But we can't call private handleGoto.
      // We should expose handleGoto or use public methods.

      // If result.goto is a scene, use enterScene.
      // If dialogue, runDialogue (which is private).

      // Best way is to pass the command back to interpreter?
      // Or make handleGoto public?

      // Let's make handleGoto public in interpreter too.
      await this.interpreter.handleGoto(result.goto)
    }
  }

  selectChoice(index: number): void {
    if (this.choiceResolvers.length > 0) {
      // Resolve the most recent choice (LIFO for nested dialogue support)
      const resolver = this.choiceResolvers.pop()
      resolver(index)
    } else {
      // Queue choice for future use (nested dialogue support)
      // Add to the most recent dialogue choice queue
      if (this.dialogueChoiceQueues.length > 0) {
        const currentQueue = this.dialogueChoiceQueues[this.dialogueChoiceQueues.length - 1]
        currentQueue.push(index)
      } else {
        // Fallback to legacy choiceQueue if no dialogue is active
        this.choiceQueue.push(index)
      }
    }
  }

  // Inventory Methods
  addItem(itemId: string): void {
    this.state.addItem(itemId)
    this.interpreter.setInventory(this.state.getInventory())
    this.eventBus.emit({ type: 'inventory:add', itemId })
  }

  removeItem(itemId: string): void {
    this.state.removeItem(itemId)
    this.interpreter.setInventory(this.state.getInventory())
    this.eventBus.emit({ type: 'inventory:remove', itemId })
  }

  hasItem(itemId: string): boolean {
    return this.state.hasItem(itemId)
  }

  getInventory(): string[] {
    return this.state.getInventory()
  }

  useItemOn(itemId: string, targetId: string): void {
    if (this.hasItem(itemId)) {
      this.eventBus.emit({ type: 'inventory:use', itemId, targetId })
    }
  }

  setFlag(name: string, value: boolean | string | number): void {
    this.state.setFlag(name, value)
    this.interpreter.setFlags(this.state.getAllFlags())
  }

  // Query methods
  getAvailableHotspots(): string[] {
    const sceneId = this.state.getCurrentScene()
    if (!sceneId) return []

    const scene = this.interpreter.getScene(sceneId)
    return scene ? Array.from(scene.hotspots.keys()) : []
  }

  getSceneDescription(): string[] {
    const sceneId = this.state.getCurrentScene()
    if (!sceneId) return []

    const scene = this.interpreter.getScene(sceneId)
    return scene ? scene.description : []
  }

  // Save/Load
  save(): string {
    return JSON.stringify(this.state.toJSON())
  }

  load(saveData: string): void {
    const snapshot = JSON.parse(saveData)
    this.state = GameState.fromJSON(snapshot, this.eventBus)
  }
}
