/**
 * NPCManager Tests - US-010: NPC Location System
 * TDD: Tests written first
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { GameState } from './GameState'
import { NPCManager } from './NPCManager'

describe('NPCManager (US-010)', () => {
  let manager: NPCManager
  let state: GameState

  beforeEach(() => {
    manager = new NPCManager()
    state = new GameState()
  })

  describe('registerNPC', () => {
    it('should register an NPC with id, name, and default scene', () => {
      manager.registerNPC({
        id: 'clerk',
        name: 'Ticket Clerk',
        defaultScene: 'bus_station',
      })
      expect(manager.getNPC('clerk')).toBeDefined()
      expect(manager.getNPC('clerk')?.name).toBe('Ticket Clerk')
    })
  })

  describe('getVisibleNPCs', () => {
    it('should return NPCs in the given scene', () => {
      manager.registerNPC({ id: 'clerk', name: 'Clerk', defaultScene: 'bus_station' })
      manager.registerNPC({ id: 'zadok', name: 'Zadok', defaultScene: 'harbor' })

      const visible = manager.getVisibleNPCs('bus_station', state)
      expect(visible).toHaveLength(1)
      expect(visible[0].id).toBe('clerk')
    })

    it('should hide NPC when visibility condition returns false', () => {
      manager.registerNPC({
        id: 'kat',
        name: 'Kat',
        defaultScene: 'bus_station',
        visibilityCondition: (s) => s.getFlag('met_kat') === true,
      })

      expect(manager.getVisibleNPCs('bus_station', state)).toHaveLength(0)
    })

    it('should show NPC when visibility condition returns true', () => {
      manager.registerNPC({
        id: 'kat',
        name: 'Kat',
        defaultScene: 'bus_station',
        visibilityCondition: (s) => s.getFlag('met_kat') === true,
      })

      state.setFlag('met_kat', true)
      expect(manager.getVisibleNPCs('bus_station', state)).toHaveLength(1)
    })
  })

  describe('NPC location changes based on flags', () => {
    it('should move NPC to different scene based on state condition', () => {
      manager.registerNPC({
        id: 'zadok',
        name: 'Old Zadok',
        defaultScene: 'harbor',
        states: {
          drunk: {
            scene: 'tavern',
            condition: (s) => s.getFlag('time_of_day') === 'night',
          },
        },
      })

      // Daytime - at harbor
      expect(manager.getNPCScene('zadok', state)).toBe('harbor')

      // Nighttime - at tavern
      state.setFlag('time_of_day', 'night')
      expect(manager.getNPCScene('zadok', state)).toBe('tavern')
    })
  })

  describe('isNPCVisible', () => {
    it('should return false for unknown NPC', () => {
      expect(manager.isNPCVisible('unknown', state)).toBe(false)
    })

    it('should return true for NPC without visibility condition', () => {
      manager.registerNPC({ id: 'clerk', name: 'Clerk', defaultScene: 'depot' })
      expect(manager.isNPCVisible('clerk', state)).toBe(true)
    })
  })

  describe('getNPCScene', () => {
    it('should return null for unknown NPC', () => {
      expect(manager.getNPCScene('unknown', state)).toBeNull()
    })

    it('should return null for invisible NPC', () => {
      manager.registerNPC({
        id: 'ghost',
        name: 'Ghost',
        defaultScene: 'church',
        visibilityCondition: () => false,
      })
      expect(manager.getNPCScene('ghost', state)).toBeNull()
    })
  })
})
