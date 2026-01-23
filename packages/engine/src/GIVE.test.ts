/**
 * GIVE Command Tests - US-002
 * Tests GIVE command functionality in dialogues
 */

import { describe, expect, it } from 'vitest'
import { StoryInterpreter } from '@anima/storyscript'

describe('GIVE Command (US-002)', () => {
  describe('Parsing', () => {
    it('should parse GIVE item correctly', () => {
      const story = `
DIALOGUE test
  GIVE ticket
END
      `

      const interpreter = new StoryInterpreter()
      interpreter.loadContent(story)

      const dialogue = interpreter.getDialogue('test')
      expect(dialogue).toBeDefined()
      expect(dialogue?.lines).toContain('GIVE ticket')
    })

    it('should parse GIVE with underscored item names', () => {
      const story = `
DIALOGUE test
  GIVE bus_ticket
END
      `

      const interpreter = new StoryInterpreter()
      interpreter.loadContent(story)

      const dialogue = interpreter.getDialogue('test')
      expect(dialogue?.lines).toContain('GIVE bus_ticket')
    })
  })

  describe('Execution', () => {
    it('should add item to inventory', async () => {
      const story = `
DIALOGUE test
  GIVE ticket
END
      `

      const interpreter = new StoryInterpreter()
      interpreter.loadContent(story)

      const dialogue = interpreter.getDialogue('test')
      await interpreter.executeLines(dialogue!.lines)

      const state = interpreter.getState()
      expect(state.inventory.has('ticket')).toBe(true)
    })

    it('should emit onGiveItem callback', async () => {
      const story = `
DIALOGUE test
  GIVE ticket
END
      `

      const interpreter = new StoryInterpreter()
      const items: string[] = []

      interpreter.setHandlers({
        onGiveItem: (item) => {
          items.push(item)
        },
      })

      interpreter.loadContent(story)
      const dialogue = interpreter.getDialogue('test')
      await interpreter.executeLines(dialogue!.lines)

      expect(items).toHaveLength(1)
      expect(items[0]).toBe('ticket')
    })

    it('should handle multiple GIVE commands', async () => {
      const story = `
DIALOGUE test
  GIVE ticket
  GIVE map
  GIVE lantern
END
      `

      const interpreter = new StoryInterpreter()
      interpreter.loadContent(story)

      const dialogue = interpreter.getDialogue('test')
      await interpreter.executeLines(dialogue!.lines)

      const state = interpreter.getState()
      expect(state.inventory.has('ticket')).toBe(true)
      expect(state.inventory.has('map')).toBe(true)
      expect(state.inventory.has('lantern')).toBe(true)
      expect(state.inventory.size).toBe(3)
    })

    it('should be idempotent for duplicate GIVE (Set behavior)', async () => {
      const story = `
DIALOGUE test
  GIVE ticket
  GIVE ticket
  GIVE ticket
END
      `

      const interpreter = new StoryInterpreter()
      interpreter.loadContent(story)

      const dialogue = interpreter.getDialogue('test')
      await interpreter.executeLines(dialogue!.lines)

      const state = interpreter.getState()
      // Since inventory is a Set, duplicates are ignored
      expect(state.inventory.has('ticket')).toBe(true)
      expect(state.inventory.size).toBe(1)
    })

    it('should handle items with underscores', async () => {
      const story = `
DIALOGUE test
  GIVE bus_ticket
  GIVE room_key
END
      `

      const interpreter = new StoryInterpreter()
      interpreter.loadContent(story)

      const dialogue = interpreter.getDialogue('test')
      await interpreter.executeLines(dialogue!.lines)

      const state = interpreter.getState()
      expect(state.inventory.has('bus_ticket')).toBe(true)
      expect(state.inventory.has('room_key')).toBe(true)
    })

    it('should persist inventory across dialogue executions', async () => {
      const story = `
DIALOGUE dialogue1
  GIVE ticket
END

DIALOGUE dialogue2
  GIVE map
END
      `

      const interpreter = new StoryInterpreter()
      interpreter.loadContent(story)

      const dialogue1 = interpreter.getDialogue('dialogue1')
      await interpreter.executeLines(dialogue1!.lines)

      let state = interpreter.getState()
      expect(state.inventory.has('ticket')).toBe(true)

      const dialogue2 = interpreter.getDialogue('dialogue2')
      await interpreter.executeLines(dialogue2!.lines)

      state = interpreter.getState()
      expect(state.inventory.has('ticket')).toBe(true)
      expect(state.inventory.has('map')).toBe(true)
    })
  })
})
