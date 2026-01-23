/**
 * NPCManager - US-010: NPC Location System
 */

import type { GameState } from './GameState'

export interface NPCDefinition {
  id: string
  name: string
  defaultScene: string
  visibilityCondition?: (state: GameState) => boolean
  states?: Record<
    string,
    {
      scene?: string
      condition?: (state: GameState) => boolean
    }
  >
}

export class NPCManager {
  private npcs: Map<string, NPCDefinition> = new Map()

  registerNPC(npc: NPCDefinition): void {
    this.npcs.set(npc.id, npc)
  }

  getNPC(npcId: string): NPCDefinition | undefined {
    return this.npcs.get(npcId)
  }

  getVisibleNPCs(sceneId: string, state: GameState): NPCDefinition[] {
    const visible: NPCDefinition[] = []

    for (const npc of this.npcs.values()) {
      if (npc.visibilityCondition && !npc.visibilityCondition(state)) {
        continue
      }

      const npcScene = this.getNPCScene(npc.id, state)
      if (npcScene === sceneId) {
        visible.push(npc)
      }
    }

    return visible
  }

  isNPCVisible(npcId: string, state: GameState): boolean {
    const npc = this.npcs.get(npcId)
    if (!npc) return false
    if (npc.visibilityCondition) {
      return npc.visibilityCondition(state)
    }
    return true
  }

  getNPCScene(npcId: string, state: GameState): string | null {
    const npc = this.npcs.get(npcId)
    if (!npc) return null
    if (!this.isNPCVisible(npcId, state)) return null

    let scene = npc.defaultScene

    if (npc.states) {
      for (const stateConfig of Object.values(npc.states)) {
        if (stateConfig.condition && stateConfig.condition(state) && stateConfig.scene) {
          scene = stateConfig.scene
          break
        }
      }
    }

    return scene
  }
}
