/**
 * USE Action Tests - US-006
 * Tests USE action execution in hotspots
 */

import { describe, expect, it } from 'vitest'
import { StoryInterpreter } from '@anima/storyscript'

describe('USE Action (US-006)', () => {
  describe('Execution', () => {
    it('should execute GIVE command in USE block', async () => {
      const story = `
SCENE test
  HOTSPOT ticket_window
    USE
      GIVE bus_ticket
    END
  END
END
      `

      const interpreter = new StoryInterpreter()
      interpreter.loadContent(story)

      const hotspot = interpreter.getScene('test')?.hotspots.get('ticket_window')
      expect(hotspot?.use).toBeDefined()

      await interpreter.executeLines(hotspot!.use)
      
      expect(interpreter.getState().inventory.has('bus_ticket')).toBe(true)
    })

    it('should execute narrative text in USE block', async () => {
      const story = `
SCENE test
  HOTSPOT sign
    USE
      "You read the sign."
    END
  END
END
      `

      const interpreter = new StoryInterpreter()
      interpreter.loadContent(story)

      const hotspot = interpreter.getScene('test')?.hotspots.get('sign')
      expect(hotspot?.use).toBeDefined()

      const result = await interpreter.executeLines(hotspot!.use)
      
      expect(result.output).toContain('You read the sign.')
    })

    it('should execute multiple commands in USE block', async () => {
      const story = `
SCENE test
  HOTSPOT machine
    USE
      GIVE coin
      "The machine accepts your coin."
      SET used = true
    END
  END
END
      `

      const interpreter = new StoryInterpreter()
      interpreter.loadContent(story)

      const hotspot = interpreter.getScene('test')?.hotspots.get('machine')
      expect(hotspot?.use).toBeDefined()

      const result = await interpreter.executeLines(hotspot!.use)
      
      expect(result.output).toContain('The machine accepts your coin.')
      expect(interpreter.getState().inventory.has('coin')).toBe(true)
      expect(interpreter.getState().flags.used).toBe(true)
    })

    it('should execute GOTO in USE block', async () => {
      const story = `
SCENE start
  HOTSPOT door
    USE
      -> next_room
    END
  END

SCENE next_room
  location: Next Room
  DESCRIPTION
    This is = next room.
  END
END
      `

      const interpreter = new StoryInterpreter()
      interpreter.loadContent(story)

      const hotspot = interpreter.getScene('start')?.hotspots.get('door')
      expect(hotspot?.use).toBeDefined()

      const result = await interpreter.executeLines(hotspot!.use)
      
      expect(result.goto).toBe('next_room')
    })

    it('should handle empty USE block', async () => {
      const story = `
SCENE test
  HOTSPOT empty_object
    USE
    END
  END
END
      `

      const interpreter = new StoryInterpreter()
      interpreter.loadContent(story)

      const hotspot = interpreter.getScene('test')?.hotspots.get('empty_object')
      expect(hotspot?.use).toBeDefined()

      const result = await interpreter.executeLines(hotspot!.use)
      
      expect(result.output).toEqual([])
      expect(result.goto).toBeUndefined()
    })
  })
})
