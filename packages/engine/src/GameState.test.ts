/**
 * GameState Tests - TDD
 * US-002: GameState Core
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { GameState } from './GameState'

describe('GameState', () => {
  let state: GameState

  beforeEach(() => {
    state = new GameState()
  })

  describe('instantiation', () => {
    it('should create a new instance (not singleton)', () => {
      const state1 = new GameState()
      const state2 = new GameState()
      expect(state1).not.toBe(state2)
    })

    it('should accept initial state', () => {
      const state = new GameState({
        currentScene: 'intro',
        flags: { started: true },
        inventory: ['key'],
      })
      expect(state.getCurrentScene()).toBe('intro')
      expect(state.getFlag('started')).toBe(true)
      expect(state.hasItem('key')).toBe(true)
    })
  })

  describe('scene tracking', () => {
    it('should track current scene', () => {
      state.setCurrentScene('bus_station')
      expect(state.getCurrentScene()).toBe('bus_station')
    })

    it('should track visited scenes', () => {
      state.setCurrentScene('intro')
      state.setCurrentScene('bus_station')
      state.setCurrentScene('intro') // revisit

      expect(state.hasVisited('intro')).toBe(true)
      expect(state.hasVisited('bus_station')).toBe(true)
      expect(state.hasVisited('unknown')).toBe(false)
    })

    it('should not duplicate visited scenes', () => {
      state.setCurrentScene('intro')
      state.setCurrentScene('intro')
      state.setCurrentScene('intro')

      const snapshot = state.toJSON()
      expect(snapshot.visitedScenes).toEqual(['intro'])
    })
  })

  describe('flags', () => {
    it('should set and get boolean flags', () => {
      state.setFlag('door_open', true)
      expect(state.getFlag('door_open')).toBe(true)
    })

    it('should set and get string flags', () => {
      state.setFlag('npc_mood', 'angry')
      expect(state.getFlag('npc_mood')).toBe('angry')
    })

    it('should set and get number flags', () => {
      state.setFlag('visit_count', 3)
      expect(state.getFlag('visit_count')).toBe(3)
    })

    it('should return undefined for unset flags', () => {
      expect(state.getFlag('nonexistent')).toBeUndefined()
    })
  })

  describe('inventory', () => {
    it('should add items', () => {
      state.addItem('key')
      expect(state.hasItem('key')).toBe(true)
    })

    it('should remove items', () => {
      state.addItem('key')
      state.removeItem('key')
      expect(state.hasItem('key')).toBe(false)
    })

    it('should not duplicate items', () => {
      state.addItem('key')
      state.addItem('key')
      expect(state.getInventory()).toEqual(['key'])
    })

    it('should return inventory as array', () => {
      state.addItem('key')
      state.addItem('lantern')
      expect(state.getInventory()).toEqual(['key', 'lantern'])
    })

    it('should return copy of inventory (immutable)', () => {
      state.addItem('key')
      const inv = state.getInventory()
      inv.push('hacked')
      expect(state.getInventory()).toEqual(['key'])
    })
  })

  describe('NPC states', () => {
    it('should get default state for unknown NPCs', () => {
      expect(state.getNpcState('stranger')).toBe('default')
    })

    it('should set and get NPC states', () => {
      state.setNpcState('kat', 'suspicious')
      expect(state.getNpcState('kat')).toBe('suspicious')
    })
  })

  describe('variables', () => {
    it('should store arbitrary data', () => {
      state.setVariable('custom', { foo: 'bar' })
      expect(state.getVariable('custom')).toEqual({ foo: 'bar' })
    })
  })

  describe('serialization', () => {
    it('should serialize to JSON', () => {
      state.setCurrentScene('intro')
      state.setFlag('started', true)
      state.addItem('key')

      const json = state.toJSON()

      expect(json.currentScene).toBe('intro')
      expect(json.flags.started).toBe(true)
      expect(json.inventory).toContain('key')
    })

    it('should deserialize from JSON', () => {
      const json = {
        currentScene: 'bus_station',
        flags: { met_kat: true },
        inventory: ['ticket'],
        visitedScenes: ['intro', 'bus_station'],
        npcStates: { clerk: 'helpful' },
        variables: {},
      }

      const restored = GameState.fromJSON(json)

      expect(restored.getCurrentScene()).toBe('bus_station')
      expect(restored.getFlag('met_kat')).toBe(true)
      expect(restored.hasItem('ticket')).toBe(true)
      expect(restored.hasVisited('intro')).toBe(true)
      expect(restored.getNpcState('clerk')).toBe('helpful')
    })

    it('should create deep copy (no reference sharing)', () => {
      state.setFlag('original', true)
      const json = state.toJSON()
      json.flags.original = false // mutate the json

      expect(state.getFlag('original')).toBe(true) // state unchanged
    })
  })

  describe('reset', () => {
    it('should reset all state', () => {
      state.setCurrentScene('ending')
      state.setFlag('completed', true)
      state.addItem('artifact')
      state.setNpcState('boss', 'defeated')

      state.reset()

      expect(state.getCurrentScene()).toBe('')
      expect(state.getFlag('completed')).toBeUndefined()
      expect(state.hasItem('artifact')).toBe(false)
      expect(state.getNpcState('boss')).toBe('default')
    })
  })
})
