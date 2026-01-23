/**
 * TRIGGER:execute Event Tests - US-013
 * Tests trigger:execute event emission
 */

import type { GameEvent } from './EventBus'
import { EventBus } from './EventBus'
import { StoryInterpreter } from '@anima/storyscript'
import { GameRunner } from './GameRunner'
import { describe, expect, it } from 'vitest'

describe('TRIGGER:execute Event (US-013)', () => {
  describe('Event Emission', () => {
    it('should emit trigger:execute event using StoryInterpreter directly', async () => {
      const story = `
TRIGGER test_trigger
  -> target_scene
END

SCENE start_scene
  location: "Start"
  DESCRIPTION
    Starting point.
  END
END

SCENE target_scene
  location: "Target"
  DESCRIPTION
    The destination.
  END
      `

      const interpreter = new StoryInterpreter()
      interpreter.loadContent(story)

      const triggerEvents: Array<{ triggerId: string }> = []
      interpreter.setHandlers({
        onTrigger: (triggerId) => {
          triggerEvents.push({ triggerId })
        },
      })

      await interpreter.enterScene('start_scene')
      await interpreter.handleGoto('test_trigger')

      expect(triggerEvents).toHaveLength(1)
      expect(triggerEvents[0].triggerId).toBe('test_trigger')
    })

    it('should include trigger ID in trigger:execute event using StoryInterpreter', async () => {
      const story = `
TRIGGER my_trigger
  -> next_scene
END

SCENE start_scene
  location: "Start"
  DESCRIPTION
    Start.
  END
END

SCENE next_scene
  location: "Next"
  DESCRIPTION
    Next location.
  END
END
      `

      const interpreter = new StoryInterpreter()
      interpreter.loadContent(story)

      const triggerEvents: Array<{ triggerId: string }> = []
      interpreter.setHandlers({
        onTrigger: (triggerId) => {
          triggerEvents.push({ triggerId })
        },
      })

      await interpreter.enterScene('start_scene')
      await interpreter.handleGoto('my_trigger')

      expect(triggerEvents).toHaveLength(1)
      expect(triggerEvents[0].triggerId).toBe('my_trigger')
    })

    it('should emit trigger:execute before trigger content executes', async () => {
      const story = `
TRIGGER test_trigger
  CUTSCENE
    GIVE test_item
  END
  -> target_scene
END

SCENE start_scene
  location: "Start"
  DESCRIPTION
    Starting point.
  END
END

SCENE target_scene
  location: "Target"
  DESCRIPTION
    The destination.
  END
END
      `

      const interpreter = new StoryInterpreter()
      interpreter.loadContent(story)

      const events: Array<{ type: string; triggerId?: string; itemId?: string; sceneId?: string }> = []
      const onTrigger = (triggerId: string) => events.push({ type: 'trigger:execute', triggerId })
      const onGiveItem = (item: string) => events.push({ type: 'inventory:add', itemId: item })
      const onSceneEnter = (sceneId: string) => events.push({ type: 'scene:enter', sceneId })

      interpreter.setHandlers({
        onTrigger,
        onGiveItem,
        onSceneEnter,
      })

      await interpreter.enterScene('start_scene')
      await interpreter.handleGoto('test_trigger')

      // Find indices of relevant events
      const triggerEventIndex = events.findIndex((e) => e.type === 'trigger:execute')
      const inventoryEventIndex = events.findIndex((e) => e.type === 'inventory:add')
      const sceneEnterIndex = events.findIndex((e) => e.type === 'scene:enter' && e.sceneId === 'target_scene')

      // trigger:execute should come before inventory:add (trigger content)
      // and before scene:enter (trigger GOTO)
      expect(triggerEventIndex).toBeGreaterThanOrEqual(0)
      expect(inventoryEventIndex).toBeGreaterThan(triggerEventIndex)
      expect(sceneEnterIndex).toBeGreaterThan(triggerEventIndex)
    })

    it('should emit trigger:execute from hotspot USE action', async () => {
      const story = `
SCENE start_scene
  location: "Start"
  DESCRIPTION
    Start here.
  END

  HOTSPOT test_button
    name: "Test Button"
    USE
      -> my_trigger
    END
  END
END

TRIGGER my_trigger
  -> target_scene
END

SCENE target_scene
  location: "Target"
  DESCRIPTION
    Arrived via trigger.
  END
END
      `

      const eventBus = new EventBus()
      const runner = new GameRunner({ storyContent: story, eventBus })

      const events: GameEvent[] = []
      eventBus.subscribe((event) => {
        if (event.type === 'trigger:execute') {
          events.push(event)
        }
      })

      await runner.enterScene('start_scene')
      await runner.use('test_button')

      expect(events).toHaveLength(1)
      expect(events[0].triggerId).toBe('my_trigger')
    })

    it('should emit trigger:execute from dialogue GOTO', async () => {
      const story = `
SCENE start_scene
  location: "Start"
  DESCRIPTION
    Start here.
  END

  HOTSPOT npc_button
    name: "NPC Button"
    TALK
      -> test_dialogue
    END
  END
END

DIALOGUE test_dialogue
  npc: "I'll send you to trigger."
  -> my_trigger
END

TRIGGER my_trigger
  -> target_scene
END

SCENE target_scene
  location: "Target"
  DESCRIPTION
    You arrived via trigger.
  END
END
      `

      const eventBus = new EventBus()
      const runner = new GameRunner({ storyContent: story, eventBus })

      const events: GameEvent[] = []
      eventBus.subscribe((event) => {
        if (event.type === 'trigger:execute') {
          events.push(event)
        }
      })

      await runner.enterScene('start_scene')
      await runner.talkTo('npc_button')

      expect(events).toHaveLength(1)
      expect(events[0].triggerId).toBe('my_trigger')
    })

    it('should NOT emit trigger:execute when REQUIRE conditions not met', async () => {
      const story = `
TRIGGER require_item_trigger
  REQUIRE HAS(required_item)
  -> target_scene
END

SCENE start_scene
  location: "Start"
  DESCRIPTION
    Start here.
  END
END

SCENE target_scene
  location: "Target"
  DESCRIPTION
    Should not reach here.
  END
END
      `

      const interpreter = new StoryInterpreter()
      interpreter.loadContent(story)

      const triggerEvents: Array<{ triggerId: string }> = []
      interpreter.setHandlers({
        onTrigger: (triggerId) => {
          triggerEvents.push({ triggerId })
        },
      })

      await interpreter.enterScene('start_scene')
      await interpreter.handleGoto('require_item_trigger')

      // Should NOT emit trigger:execute because requirements not met
      expect(triggerEvents).toHaveLength(0)
    })

    it('should emit trigger:execute for each trigger in a chain', async () => {
      const story = `
TRIGGER trigger_1
  -> trigger_2
END

TRIGGER trigger_2
  -> final_scene
END

SCENE start_scene
  location: "Start"
  DESCRIPTION
    Start here.
  END
END

SCENE final_scene
  location: "Final"
  DESCRIPTION
    The end.
  END
END
      `

      const interpreter = new StoryInterpreter()
      interpreter.loadContent(story)

      const triggerEvents: Array<{ triggerId: string }> = []
      interpreter.setHandlers({
        onTrigger: (triggerId) => {
          triggerEvents.push({ triggerId })
        },
      })

      await interpreter.enterScene('start_scene')
      await interpreter.handleGoto('trigger_1')

      expect(triggerEvents).toHaveLength(2)
      expect(triggerEvents[0].triggerId).toBe('trigger_1')
      expect(triggerEvents[1].triggerId).toBe('trigger_2')
    })

    it('should work with StoryInterpreter directly', async () => {
      const story = `
TRIGGER test_trigger
  -> next_scene
END

SCENE start_scene
  location: "Start"
  DESCRIPTION
    Start.
  END
END

SCENE next_scene
  location: "Next"
  DESCRIPTION
    Next.
  END
END
      `

      const interpreter = new StoryInterpreter()
      interpreter.loadContent(story)

      const triggerEvents: Array<{ triggerId: string }> = []
      interpreter.setHandlers({
        onTrigger: (triggerId) => {
          triggerEvents.push({ triggerId })
        },
      })

      await interpreter.enterScene('start_scene')
      await interpreter.handleGoto('test_trigger')

      expect(triggerEvents).toHaveLength(1)
      expect(triggerEvents[0].triggerId).toBe('test_trigger')
    })
  })
})
