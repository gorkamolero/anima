/**
 * EventBus - Central event system for game events
 *
 * Any UI can subscribe to these events and render accordingly.
 */

export type GameEvent =
  | { type: 'scene:enter'; sceneId: string; description: string[] }
  | { type: 'scene:exit'; sceneId: string }
  | { type: 'dialogue:start'; dialogueId: string }
  | { type: 'dialogue:line'; speaker: string; text: string }
  | { type: 'dialogue:choice'; choices: Array<{ index: number; text: string }> }
  | { type: 'dialogue:choice:resolve'; selectedIndex: number }
  | { type: 'dialogue:end' }
  | { type: 'hotspot:look'; hotspotId: string; text: string[] }
  | { type: 'hotspot:talk'; hotspotId: string }
  | { type: 'hotspot:use'; hotspotId: string }
  | { type: 'inventory:add'; itemId: string }
  | { type: 'inventory:remove'; itemId: string }
  | { type: 'inventory:use'; itemId: string; targetId: string }
  | { type: 'flag:set'; flag: string; value: boolean | string | number }
  | { type: 'trigger:execute'; triggerId: string }
  | { type: 'game:start' }
  | { type: 'game:end'; ending?: string }
  | { type: 'act:complete'; actId: number; state: { inventory: string[]; flags: Record<string, unknown> } }
  | { type: 'act:start'; actId: number }
  | { type: 'cutscene:start' }
  | { type: 'cutscene:line'; speaker?: string; text: string }
  | { type: 'cutscene:end' }

export type EventHandler = (event: GameEvent) => void

export class EventBus {
  private handlers: Set<EventHandler> = new Set()
  private eventLog: GameEvent[] = []
  private logEnabled = false

  subscribe(handler: EventHandler): () => void {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }

  emit(event: GameEvent): void {
    if (this.logEnabled) {
      this.eventLog.push(event)
    }
    for (const handler of this.handlers) {
      handler(event)
    }
  }

  enableLogging(): void {
    this.logEnabled = true
  }

  getLog(): GameEvent[] {
    return [...this.eventLog]
  }

  clearLog(): void {
    this.eventLog = []
  }
}
