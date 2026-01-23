/**
 * GameRunner Tests - TDD
 * US-003: StoryInterpreter Integration
 * US-004: Scene Navigation
 * US-005: Hotspot Interactions
 * US-006: Dialogue System
 * US-009: Save/Load System
 */

import { beforeEach, describe, expect, it } from 'vitest'
import { EventBus, type GameEvent } from './EventBus'
import { GameRunner } from './GameRunner'
import { GameState } from './GameState'

const SIMPLE_STORY = `
SCENE bus_station
  location: Arkham Bus Depot
  DESCRIPTION
    A small bus depot.
    The air smells of diesel.
  END

  HOTSPOT ticket_window
    name: Ticket Window
    LOOK
      A dusty window with a clerk behind it.
    END
    TALK
      -> clerk_dialogue
    END
    USE
      GIVE ticket
      "You slide the ticket under the window."
    END
  END

  HOTSPOT bench
    name: Wooden Bench
    LOOK
      An old wooden bench.
      Someone carved initials into it.
    END
  END
END

SCENE street
  location: The Street
  DESCRIPTION
    The rainy street.
  END
END

DIALOGUE clerk_dialogue
  clerk: "Next please."
  player: "I need a ticket."
END
`

describe('GameRunner', () => {
  let runner: GameRunner
  let eventBus: EventBus
  let events: GameEvent[]

  beforeEach(() => {
    eventBus = new EventBus()
    events = []
    eventBus.subscribe((e) => events.push(e))

    runner = new GameRunner({
      storyContent: SIMPLE_STORY,
      eventBus,
    })
  })

  describe('initialization', () => {
    it('should create with story content', () => {
      expect(runner).toBeDefined()
    })

    it('should provide access to event bus', () => {
      expect(runner.getEventBus()).toBe(eventBus)
    })

    it('should provide access to game state', () => {
      expect(runner.getState()).toBeInstanceOf(GameState)
    })

    it('should accept custom initial state', () => {
      const customState = new GameState({ currentScene: 'custom' })
      const customRunner = new GameRunner({
        storyContent: SIMPLE_STORY,
        initialState: customState,
      })
      expect(customRunner.getState().getCurrentScene()).toBe('custom')
    })
  })

  describe('game lifecycle', () => {
    it('should emit game:start when started', () => {
      runner.start()
      expect(events).toContainEqual({ type: 'game:start' })
    })

    it('should track running state', () => {
      expect(runner.isRunning()).toBe(false)
      runner.start()
      expect(runner.isRunning()).toBe(true)
      runner.stop()
      expect(runner.isRunning()).toBe(false)
    })
  })

  describe('scene navigation (US-004)', () => {
    it('should enter a scene and emit event', () => {
      runner.enterScene('bus_station')

      const sceneEvent = events.find((e) => e.type === 'scene:enter')
      expect(sceneEvent).toBeDefined()
      expect(sceneEvent?.type === 'scene:enter' && sceneEvent.sceneId).toBe('bus_station')
    })

    it('should update current scene in state', () => {
      runner.enterScene('bus_station')
      expect(runner.getState().getCurrentScene()).toBe('bus_station')
    })

    it('should emit scene:exit when leaving a scene', () => {
      runner.enterScene('bus_station')
      runner.enterScene('street')

      const exitEvent = events.find((e) => e.type === 'scene:exit')
      expect(exitEvent).toBeDefined()
    })

    it('should track visited scenes in state', () => {
      runner.enterScene('bus_station')
      expect(runner.getState().hasVisited('bus_station')).toBe(true)

      runner.enterScene('street')
      expect(runner.getState().hasVisited('street')).toBe(true)
      expect(runner.getState().hasVisited('bus_station')).toBe(true)
    })
  })

  describe('hotspot interactions (US-005)', () => {
    beforeEach(() => {
      runner.enterScene('bus_station')
      events = [] // clear scene events
    })

    afterEach(() => {
      // Clear events between tests
      events = []
    })

    it('should emit hotspot:look with text', () => {
      runner.lookAt('ticket_window')

      const lookEvent = events.find((e) => e.type === 'hotspot:look')
      expect(lookEvent).toBeDefined()
      expect(lookEvent?.type === 'hotspot:look' && lookEvent.hotspotId).toBe('ticket_window')
    })

    it('should emit hotspot:talk and start dialogue', async () => {
      runner.talkTo('ticket_window')

      // Wait for async execution
      await new Promise((resolve) => setTimeout(resolve, 0))

      const talkEvent = events.find((e) => e.type === 'hotspot:talk')
      expect(talkEvent).toBeDefined()

      const dialogueStart = events.find((e) => e.type === 'dialogue:start')
      expect(dialogueStart).toBeDefined()
      expect((dialogueStart as any).dialogueId).toBe('clerk_dialogue') // Uses actual dialogue ID from -> clerk_dialogue

      // Filter dialogue lines that have a speaker (not scene description)
      const dialogueLines = events.filter(
        (e) => e.type === 'dialogue:line' && (e as any).speaker && (e as any).speaker !== 'narrator'
      )
      expect(dialogueLines.length).toBeGreaterThan(0)
      expect((dialogueLines[0] as any).text).toBe('Next please.')
    })

    it('should emit hotspot:use and execute actions', async () => {
      runner.use('ticket_window')

      await new Promise((resolve) => setTimeout(resolve, 10))

      const useEvent = events.find((e) => e.type === 'hotspot:use')
      expect(useEvent).toBeDefined()

      const invEvent = events.find((e) => e.type === 'inventory:add')
      expect(invEvent).toBeDefined()
      expect((invEvent as any).itemId).toBe('ticket')

      // Should have dialogue:line events from USE block
      const narrativeLines = events.filter(
        (e) => e.type === 'dialogue:line' && (e as any).speaker === 'narrator'
      )
      expect(narrativeLines.length).toBeGreaterThan(0)
      expect((narrativeLines[narrativeLines.length - 1] as any).text).toBe('You slide the ticket under the window.')
    })
  })

  describe('story interpreter integration (US-003)', () => {
    beforeEach(() => {
      runner.enterScene('bus_station')
    })

    it('should return available hotspots', () => {
      const hotspots = runner.getAvailableHotspots()
      expect(hotspots).toContain('ticket_window')
      expect(hotspots).toContain('bench')
      expect(hotspots.length).toBe(2)
    })

    it('should return scene description', () => {
      const description = runner.getSceneDescription()
      expect(description).toContain('A small bus depot.')
      expect(description).toContain('The air smells of diesel.')
    })
  })

  describe('save/load (US-009)', () => {
    it('should save game state as JSON string', () => {
      runner.enterScene('bus_station')
      runner.getState().setFlag('talked_to_clerk', true)
      runner.getState().addItem('ticket')

      const saveData = runner.save()

      expect(typeof saveData).toBe('string')
      const parsed = JSON.parse(saveData)
      expect(parsed.currentScene).toBe('bus_station')
      expect(parsed.flags.talked_to_clerk).toBe(true)
      expect(parsed.inventory).toContain('ticket')
    })

    it('should load game state from JSON string', () => {
      const saveData = JSON.stringify({
        currentScene: 'hotel_lobby',
        flags: { has_key: true },
        inventory: ['room_key'],
        visitedScenes: ['bus_station', 'hotel_lobby'],
        npcStates: {},
        variables: {},
      })

      runner.load(saveData)

      expect(runner.getState().getCurrentScene()).toBe('hotel_lobby')
      expect(runner.getState().getFlag('has_key')).toBe(true)
      expect(runner.getState().hasItem('room_key')).toBe(true)
    })

    it('should restore exact state after save/load cycle', () => {
      runner.enterScene('bus_station')
      runner.getState().setFlag('progress', 5)
      runner.getState().addItem('map')
      runner.getState().setNpcState('clerk', 'annoyed')

      const saveData = runner.save()

      // Create new runner and load
      const newRunner = new GameRunner({ storyContent: SIMPLE_STORY })
      newRunner.load(saveData)

      expect(newRunner.getState().getCurrentScene()).toBe('bus_station')
      expect(newRunner.getState().getFlag('progress')).toBe(5)
      expect(newRunner.getState().hasItem('map')).toBe(true)
      expect(newRunner.getState().getNpcState('clerk')).toBe('annoyed')
    })
  })
})
