/**
 * GOTO Command Tests - US-004
 * Tests GOTO command functionality in dialogues
 */

import { describe, expect, it } from 'vitest'
import { StoryInterpreter } from '@anima/storyscript'

describe('GOTO Command (US-004)', () => {
  describe('Parsing', () => {
    it('should parse -> scene correctly', () => {
      const story = `
DIALOGUE test
  -> next_scene
END

SCENE next_scene
  location: "Next Scene"
  DESCRIPTION
    This is the next scene.
  END
END
      `

      const interpreter = new StoryInterpreter()
      interpreter.loadContent(story)

      const dialogue = interpreter.getDialogue('test')
      expect(dialogue).toBeDefined()
      expect(dialogue?.lines).toContain('-> next_scene')

      const scene = interpreter.getScene('next_scene')
      expect(scene).toBeDefined()
      expect(scene?.location).toBe('Next Scene')
    })

    it('should parse -> with underscored scene names', () => {
      const story = `
DIALOGUE test
  -> hotel_lobby_evening
END

SCENE hotel_lobby_evening
  location: "Hotel Lobby"
  DESCRIPTION
    Evening atmosphere.
  END
END
      `

      const interpreter = new StoryInterpreter()
      interpreter.loadContent(story)

      const dialogue = interpreter.getDialogue('test')
      expect(dialogue?.lines).toContain('-> hotel_lobby_evening')
    })

    it('should parse -> END', () => {
      const story = `
DIALOGUE test
  clerk: "Here's your ticket."
  -> END
END
      `

      const interpreter = new StoryInterpreter()
      interpreter.loadContent(story)

      const dialogue = interpreter.getDialogue('test')
      expect(dialogue).toBeDefined()
      expect(dialogue?.lines).toContain('-> END')
    })
  })

  describe('Execution - Scene Transitions', () => {
    it('should return goto target from executeLines', async () => {
      const story = `
DIALOGUE test
  clerk: "Goodbye."
  -> next_scene
END

SCENE next_scene
  location: "Next Scene"
  DESCRIPTION
    You arrived.
  END
END
      `

      const interpreter = new StoryInterpreter()
      interpreter.loadContent(story)

      const dialogue = interpreter.getDialogue('test')
      const result = await interpreter.executeLines(dialogue!.lines)

      expect(result.goto).toBe('next_scene')
    })

    it('should handle -> to scene via handleGoto', async () => {
      const story = `
DIALOGUE test
  clerk: "Time to go."
  -> next_scene
END

SCENE next_scene
  location: "Next Scene"
  DESCRIPTION
    The next location.
  END

SCENE start_scene
  location: "Start"
  DESCRIPTION
    Starting point.
  END
      `

      const interpreter = new StoryInterpreter()
      interpreter.loadContent(story)

      // Set initial scene
      await interpreter.enterScene('start_scene')
      expect(interpreter.getState().scene).toBe('start_scene')

      // Execute dialogue with goto
      const dialogue = interpreter.getDialogue('test')
      const result = await interpreter.executeLines(dialogue!.lines)

      expect(result.goto).toBe('next_scene')

      // Manually handle goto (this is what GameRunner does)
      await interpreter.handleGoto(result.goto!)

      // Verify scene changed
      expect(interpreter.getState().scene).toBe('next_scene')
    })

    it('should handle multiple -> commands (first one wins, execution stops)', async () => {
      const story = `
DIALOGUE test
  clerk: "Going to first scene."
  -> first_scene
  clerk: "Actually, going to second scene."
  -> second_scene
END

SCENE first_scene
  location: "First"
  DESCRIPTION
    First scene.
END

SCENE second_scene
  location: "Second"
  DESCRIPTION
    Second scene.
END
      `

      const interpreter = new StoryInterpreter()
      interpreter.loadContent(story)

      const dialogue = interpreter.getDialogue('test')
      const result = await interpreter.executeLines(dialogue!.lines)

      // The first goto wins, execution stops immediately
      expect(result.goto).toBe('first_scene')
    })

    it('should execute lines before ->', async () => {
      const story = `
DIALOGUE test
  clerk: "Line 1"
  clerk: "Line 2"
  clerk: "Line 3"
  -> next_scene
END

SCENE next_scene
  location: "Next"
  DESCRIPTION
    Next scene.
END
      `

      const interpreter = new StoryInterpreter()
      const outputs: string[] = []

      interpreter.setHandlers({
        onLine: async (line) => {
          outputs.push(`${line.speaker}: ${line.text}`)
        },
      })

      interpreter.loadContent(story)
      const dialogue = interpreter.getDialogue('test')
      await interpreter.executeLines(dialogue!.lines)

      expect(outputs).toHaveLength(3)
      expect(outputs[0]).toBe('clerk: Line 1')
      expect(outputs[1]).toBe('clerk: Line 2')
      expect(outputs[2]).toBe('clerk: Line 3')
    })
  })

  describe('Execution - Dialogue Transitions', () => {
    it('should handle -> to another dialogue', async () => {
      const story = `
DIALOGUE dialogue1
  clerk: "I'll send you to dialogue 2."
  -> dialogue2
END

DIALOGUE dialogue2
  clerk: "You made it!"
END
      `

      const interpreter = new StoryInterpreter()
      interpreter.loadContent(story)

      const dialogue1 = interpreter.getDialogue('dialogue1')
      const result = await interpreter.executeLines(dialogue1!.lines)

      expect(result.goto).toBe('dialogue2')
    })

    it('should handle -> END', async () => {
      const story = `
DIALOGUE test
  clerk: "Goodbye."
  -> END
      `

      const interpreter = new StoryInterpreter()
      interpreter.loadContent(story)

      const dialogue = interpreter.getDialogue('test')
      const result = await interpreter.executeLines(dialogue!.lines)

      expect(result.goto).toBe('END')
    })
  })

  describe('Scene Cleanup and ON_ENTER', () => {
    it('should emit onSceneEnter when handling goto to scene', async () => {
      const story = `
DIALOGUE test
  -> next_scene
END

SCENE start_scene
  location: "Start"
  DESCRIPTION
    Starting point.
END

SCENE next_scene
  location: "Next"
  DESCRIPTION
    Next location.
END
      `

      const interpreter = new StoryInterpreter()
      const sceneEnterCalls: string[] = []

      interpreter.setHandlers({
        onSceneEnter: (sceneId) => {
          sceneEnterCalls.push(sceneId)
        },
      })

      interpreter.loadContent(story)

      // Start in first scene
      await interpreter.enterScene('start_scene')
      expect(sceneEnterCalls).toContain('start_scene')

      // Execute dialogue with goto
      const dialogue = interpreter.getDialogue('test')
      const result = await interpreter.executeLines(dialogue!.lines)

      // Handle goto
      await interpreter.handleGoto(result.goto!)

      // Verify onSceneEnter was called for new scene
      expect(sceneEnterCalls).toContain('next_scene')
    })

    it('should execute ON_ENTER block of new scene', async () => {
      const story = `
DIALOGUE test
  -> scene_with_enter
END

SCENE scene_with_enter
  location: "Scene with ON_ENTER"
  ON_ENTER
    clerk: "This is the ON_ENTER block."
    clerk: "It runs when you enter the scene."
  END
  DESCRIPTION
    This scene has ON_ENTER.
END
      `

      const interpreter = new StoryInterpreter()
      const outputs: string[] = []

      interpreter.setHandlers({
        onLine: async (line) => {
          outputs.push(`${line.speaker}: ${line.text}`)
        },
      })

      interpreter.loadContent(story)

      // Execute dialogue with goto
      const dialogue = interpreter.getDialogue('test')
      const result = await interpreter.executeLines(dialogue!.lines)

      // Clear outputs from dialogue
      outputs.length = 0

      // Handle goto
      await interpreter.handleGoto(result.goto!)

      // Verify ON_ENTER lines were emitted
      expect(outputs).toContain('clerk: This is the ON_ENTER block.')
      expect(outputs).toContain('clerk: It runs when you enter the scene.')
    })

    it('should handle goto within ON_ENTER block', async () => {
      const story = `
DIALOGUE test
  -> scene_with_redirect
END

SCENE scene_with_redirect
  location: "Scene with redirect"
  ON_ENTER
    clerk: "You won't stay here long."
    -> final_scene
  END
  DESCRIPTION
    This scene redirects.
END

SCENE final_scene
  location: "Final Scene"
  DESCRIPTION
    The actual destination.
END
      `

      const interpreter = new StoryInterpreter()

      interpreter.loadContent(story)

      // Execute dialogue with goto
      const dialogue = interpreter.getDialogue('test')
      const result = await interpreter.executeLines(dialogue!.lines)

      // Handle goto
      await interpreter.handleGoto(result.goto!)

      // Verify we ended up in the final scene
      expect(interpreter.getState().scene).toBe('final_scene')
    })
  })

  describe('GOTO in Nested Structures', () => {
    it('should handle -> within IF block', async () => {
      const story = `
DIALOGUE test
  clerk: "Making a choice."
  SET choice = true
  IF choice = true
    -> scene_a
  ELSE
    -> scene_b
  END
END

SCENE scene_a
  location: "Scene A"
  DESCRIPTION
    Choice A.
END

SCENE scene_b
  location: "Scene B"
  DESCRIPTION
    Choice B.
END
      `

      const interpreter = new StoryInterpreter()
      interpreter.loadContent(story)

      const dialogue = interpreter.getDialogue('test')
      const result = await interpreter.executeLines(dialogue!.lines)

      expect(result.goto).toBe('scene_a')
    })

    it('should handle -> within CHOICE block', async () => {
      const story = `
DIALOGUE test
  clerk: "Choose your path."
  CHOICE
    > "Go left"
      -> scene_left
    > "Go right"
      -> scene_right
  END
END

SCENE scene_left
  location: "Left Path"
  DESCRIPTION
    You went left.
END

SCENE scene_right
  location: "Right Path"
  DESCRIPTION
    You went right.
END
      `

      const interpreter = new StoryInterpreter()
      const choiceQueue: number[] = [0] // Pre-select first choice (0-indexed)

      interpreter.setHandlers({
        onChoice: async (choices) => {
          const choice = choiceQueue.shift()
          if (choice !== undefined) {
            return choice + 1 // Convert to 1-indexed for interpreter
          }
          return 1
        },
      })

      interpreter.loadContent(story)

      const dialogue = interpreter.getDialogue('test')
      const result = await interpreter.executeLines(dialogue!.lines)

      expect(result.goto).toBe('scene_left')
    })
  })
})
