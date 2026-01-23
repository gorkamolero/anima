/**
 * SET_FLAG Command Tests - US-003
 * Tests SET_FLAG command functionality in dialogues
 */

import { describe, expect, it } from 'vitest'
import { StoryInterpreter } from '@anima/storyscript'

describe('SET_FLAG Command (US-003)', () => {
  describe('Parsing', () => {
    it('should parse SET with simple value', () => {
      const story = `
DIALOGUE test
  SET flag_name = true
END
      `

      const interpreter = new StoryInterpreter()
      interpreter.loadContent(story)

      const dialogue = interpreter.getDialogue('test')
      expect(dialogue).toBeDefined()
      expect(dialogue?.lines).toContain('SET flag_name = true')
    })

    it('should parse SET with string value', () => {
      const story = `
DIALOGUE test
  SET message = "Hello world"
END
      `

      const interpreter = new StoryInterpreter()
      interpreter.loadContent(story)

      const dialogue = interpreter.getDialogue('test')
      expect(dialogue?.lines).toContain('SET message = "Hello world"')
    })

    it('should parse SET with numeric value', () => {
      const story = `
DIALOGUE test
  SET counter = 5
END
      `

      const interpreter = new StoryInterpreter()
      interpreter.loadContent(story)

      const dialogue = interpreter.getDialogue('test')
      expect(dialogue?.lines).toContain('SET counter = 5')
    })

    it('should parse SET with false value', () => {
      const story = `
DIALOGUE test
  SET completed = false
END
      `

      const interpreter = new StoryInterpreter()
      interpreter.loadContent(story)

      const dialogue = interpreter.getDialogue('test')
      expect(dialogue?.lines).toContain('SET completed = false')
    })
  })

  describe('Execution', () => {
    it('should set flag with boolean value', async () => {
      const story = `
DIALOGUE test
  SET flag_name = true
END
      `

      const interpreter = new StoryInterpreter()
      interpreter.loadContent(story)

      const dialogue = interpreter.getDialogue('test')
      await interpreter.executeLines(dialogue!.lines)

      const state = interpreter.getState()
      expect(state.flags['flag_name']).toBe(true)
    })

    it('should set flag with string value', async () => {
      const story = `
DIALOGUE test
  SET message = "Hello world"
END
      `

      const interpreter = new StoryInterpreter()
      interpreter.loadContent(story)

      const dialogue = interpreter.getDialogue('test')
      await interpreter.executeLines(dialogue!.lines)

      const state = interpreter.getState()
      expect(state.flags['message']).toBe('Hello world')
    })

    it('should set flag with numeric value', async () => {
      const story = `
DIALOGUE test
  SET counter = 5
END
      `

      const interpreter = new StoryInterpreter()
      interpreter.loadContent(story)

      const dialogue = interpreter.getDialogue('test')
      await interpreter.executeLines(dialogue!.lines)

      const state = interpreter.getState()
      expect(state.flags['counter']).toBe(5)
    })

    it('should update existing flag value', async () => {
      const story = `
DIALOGUE test
  SET flag_name = false
END

DIALOGUE test2
  SET flag_name = true
END
      `

      const interpreter = new StoryInterpreter()
      interpreter.loadContent(story)

      const test = interpreter.getDialogue('test')
      await interpreter.executeLines(test!.lines)

      const test2 = interpreter.getDialogue('test2')
      await interpreter.executeLines(test2!.lines)

      const state = interpreter.getState()
      expect(state.flags['flag_name']).toBe(true)
    })

    it('should overwrite flag value', async () => {
      const story = `
DIALOGUE test
  SET counter = 1
END

DIALOGUE test2
  SET counter = 5
END
      `

      const interpreter = new StoryInterpreter()
      interpreter.loadContent(story)

      const test = interpreter.getDialogue('test')
      await interpreter.executeLines(test!.lines)

      const test2 = interpreter.getDialogue('test2')
      await interpreter.executeLines(test2!.lines)

      const state = interpreter.getState()
      expect(state.flags['counter']).toBe(5)
    })

    it('should persist flags across dialogues', async () => {
      const story = `
DIALOGUE dialogue1
  SET flag1 = true
END

DIALOGUE dialogue2
  SET flag2 = false
END
      `

      const interpreter = new StoryInterpreter()
      interpreter.loadContent(story)

      const dialogue1 = interpreter.getDialogue('dialogue1')
      await interpreter.executeLines(dialogue1!.lines)

      let state = interpreter.getState()
      expect(state.flags['flag1']).toBe(true)

      const dialogue2 = interpreter.getDialogue('dialogue2')
      await interpreter.executeLines(dialogue2!.lines)

      state = interpreter.getState()
      expect(state.flags['flag1']).toBe(true)
      expect(state.flags['flag2']).toBe(false)
    })
  })
})
