import { StoryInterpreter } from '@anima/storyscript'

describe('IF/ELSE Conditions', () => {
  describe('Simple IF/ELSE', () => {
    it('should execute IF branch when condition is true', async () => {
      const story = `
DIALOGUE test
  SET visited = true
  
  IF visited
    "You've been here before."
  ELSE
    "First time here."
  END
END
      `

      const interpreter = new StoryInterpreter()
      interpreter.loadContent(story)

      const dialogue = interpreter.getDialogue('test')
      const result = await interpreter.executeLines(dialogue!.lines)

      expect(result.output).toContain('You\'ve been here before.')
      expect(result.output).not.toContain('First time here.')
    })

    it('should execute ELSE branch when condition is false', async () => {
      const story = `
DIALOGUE test
  SET visited = false
  
  IF visited
    "You've been here before."
  ELSE
    "First time here."
  END
END
      `

      const interpreter = new StoryInterpreter()
      interpreter.loadContent(story)

      const dialogue = interpreter.getDialogue('test')
      const result = await interpreter.executeLines(dialogue!.lines)

      expect(result.output).not.toContain('You\'ve been here before.')
      expect(result.output).toContain('First time here.')
    })

    it('should execute IF branch without ELSE when condition is true', async () => {
      const story = `
DIALOGUE test
  SET unlocked = true
  
  IF unlocked
    "The door opens."
  END
END
      `

      const interpreter = new StoryInterpreter()
      interpreter.loadContent(story)

      const dialogue = interpreter.getDialogue('test')
      const result = await interpreter.executeLines(dialogue!.lines)

      expect(result.output).toContain('The door opens.')
    })

    it('should skip IF block without ELSE when condition is false', async () => {
      const story = `
DIALOGUE test
  SET unlocked = false
  
  IF unlocked
    "The door opens."
  END
  
  "Still here."
END
      `

      const interpreter = new StoryInterpreter()
      interpreter.loadContent(story)

      const dialogue = interpreter.getDialogue('test')
      const result = await interpreter.executeLines(dialogue!.lines)

      expect(result.output).not.toContain('The door opens.')
      expect(result.output).toContain('Still here.')
    })
  })

  describe('Nested IF/ELSE', () => {
    it('should handle 2-level nested IF conditions', async () => {
      const story = `
DIALOGUE test
  SET outer = true
  SET inner = true
  
  IF outer
    "Outer branch"
    IF inner
      "Inner branch"
    END
  ELSE
    "Outer else"
  END
END
      `

      const interpreter = new StoryInterpreter()
      interpreter.loadContent(story)

      const dialogue = interpreter.getDialogue('test')
      const result = await interpreter.executeLines(dialogue!.lines)

      expect(result.output).toContain('Outer branch')
      expect(result.output).toContain('Inner branch')
      expect(result.output).not.toContain('Outer else')
    })

    it('should handle 2-level nested IF with inner false', async () => {
      const story = `
DIALOGUE test
  SET outer = true
  SET inner = false
  
  IF outer
    "Outer branch"
    IF inner
      "Inner branch"
    ELSE
      "Inner else"
    END
  ELSE
    "Outer else"
  END
END
      `

      const interpreter = new StoryInterpreter()
      interpreter.loadContent(story)

      const dialogue = interpreter.getDialogue('test')
      const result = await interpreter.executeLines(dialogue!.lines)

      expect(result.output).toContain('Outer branch')
      expect(result.output).not.toContain('Inner branch')
      expect(result.output).toContain('Inner else')
      expect(result.output).not.toContain('Outer else')
    })

    it('should handle 2-level nested IF with outer false', async () => {
      const story = `
DIALOGUE test
  SET outer = false
  SET inner = true
  
  IF outer
    "Outer branch"
    IF inner
      "Inner branch"
    END
  ELSE
    "Outer else"
  END
END
      `

      const interpreter = new StoryInterpreter()
      interpreter.loadContent(story)

      const dialogue = interpreter.getDialogue('test')
      const result = await interpreter.executeLines(dialogue!.lines)

      expect(result.output).not.toContain('Outer branch')
      expect(result.output).not.toContain('Inner branch')
      expect(result.output).toContain('Outer else')
    })

    it('should handle 3-level nested IF conditions', async () => {
      const story = `
DIALOGUE test
  SET level1 = true
  SET level2 = true
  SET level3 = true
  
  IF level1
    "Level 1"
    IF level2
      "Level 2"
      IF level3
        "Level 3"
      ELSE
        "Level 3 else"
      END
    ELSE
      "Level 2 else"
    END
  ELSE
    "Level 1 else"
  END
END
      `

      const interpreter = new StoryInterpreter()
      interpreter.loadContent(story)

      const dialogue = interpreter.getDialogue('test')
      const result = await interpreter.executeLines(dialogue!.lines)

      expect(result.output).toContain('Level 1')
      expect(result.output).toContain('Level 2')
      expect(result.output).toContain('Level 3')
      expect(result.output).not.toContain('Level 1 else')
      expect(result.output).not.toContain('Level 2 else')
      expect(result.output).not.toContain('Level 3 else')
    })
  })

  describe('Boolean Operators', () => {
    it('should handle AND operator', async () => {
      const story = `
DIALOGUE test
  SET flag1 = true
  SET flag2 = true
  
  IF flag1 AND flag2
    "Both true"
  ELSE
    "Not both"
  END
END
      `

      const interpreter = new StoryInterpreter()
      interpreter.loadContent(story)

      const dialogue = interpreter.getDialogue('test')
      const result = await interpreter.executeLines(dialogue!.lines)

      expect(result.output).toContain('Both true')
      expect(result.output).not.toContain('Not both')
    })

    it('should handle AND operator with first false', async () => {
      const story = `
DIALOGUE test
  SET flag1 = false
  SET flag2 = true
  
  IF flag1 AND flag2
    "Both true"
  ELSE
    "Not both"
  END
END
      `

      const interpreter = new StoryInterpreter()
      interpreter.loadContent(story)

      const dialogue = interpreter.getDialogue('test')
      const result = await interpreter.executeLines(dialogue!.lines)

      expect(result.output).not.toContain('Both true')
      expect(result.output).toContain('Not both')
    })

    it('should handle AND operator with second false', async () => {
      const story = `
DIALOGUE test
  SET flag1 = true
  SET flag2 = false
  
  IF flag1 AND flag2
    "Both true"
  ELSE
    "Not both"
  END
END
      `

      const interpreter = new StoryInterpreter()
      interpreter.loadContent(story)

      const dialogue = interpreter.getDialogue('test')
      const result = await interpreter.executeLines(dialogue!.lines)

      expect(result.output).not.toContain('Both true')
      expect(result.output).toContain('Not both')
    })

    it('should handle OR operator', async () => {
      const story = `
DIALOGUE test
  SET flag1 = true
  SET flag2 = false
  
  IF flag1 OR flag2
    "At least one"
  ELSE
    "Neither"
  END
END
      `

      const interpreter = new StoryInterpreter()
      interpreter.loadContent(story)

      const dialogue = interpreter.getDialogue('test')
      const result = await interpreter.executeLines(dialogue!.lines)

      expect(result.output).toContain('At least one')
      expect(result.output).not.toContain('Neither')
    })

    it('should handle OR operator with first false', async () => {
      const story = `
DIALOGUE test
  SET flag1 = false
  SET flag2 = true
  
  IF flag1 OR flag2
    "At least one"
  ELSE
    "Neither"
  END
END
      `

      const interpreter = new StoryInterpreter()
      interpreter.loadContent(story)

      const dialogue = interpreter.getDialogue('test')
      const result = await interpreter.executeLines(dialogue!.lines)

      expect(result.output).toContain('At least one')
      expect(result.output).not.toContain('Neither')
    })

    it('should handle OR operator with both false', async () => {
      const story = `
DIALOGUE test
  SET flag1 = false
  SET flag2 = false
  
  IF flag1 OR flag2
    "At least one"
  ELSE
    "Neither"
  END
END
      `

      const interpreter = new StoryInterpreter()
      interpreter.loadContent(story)

      const dialogue = interpreter.getDialogue('test')
      const result = await interpreter.executeLines(dialogue!.lines)

      expect(result.output).not.toContain('At least one')
      expect(result.output).toContain('Neither')
    })

    it('should handle NOT operator', async () => {
      const story = `
DIALOGUE test
  SET flag = false
  
  IF NOT flag
    "Not true"
  ELSE
    "True"
  END
END
      `

      const interpreter = new StoryInterpreter()
      interpreter.loadContent(story)

      const dialogue = interpreter.getDialogue('test')
      const result = await interpreter.executeLines(dialogue!.lines)

      expect(result.output).toContain('Not true')
      expect(result.output).not.toContain('True')
    })

    it('should handle NOT operator with true value', async () => {
      const story = `
DIALOGUE test
  SET flag = true
  
  IF NOT flag
    "Not true"
  ELSE
    "True"
  END
END
      `

      const interpreter = new StoryInterpreter()
      interpreter.loadContent(story)

      const dialogue = interpreter.getDialogue('test')
      const result = await interpreter.executeLines(dialogue!.lines)

      expect(result.output).not.toContain('Not true')
      expect(result.output).toContain('True')
    })

    it('should handle complex boolean expressions', async () => {
      const story = `
DIALOGUE test
  SET flag1 = true
  SET flag2 = false
  SET flag3 = true
  
  IF flag1 AND NOT flag2 OR flag3
    "Complex true"
  ELSE
    "Complex false"
  END
END
      `

      const interpreter = new StoryInterpreter()
      interpreter.loadContent(story)

      const dialogue = interpreter.getDialogue('test')
      const result = await interpreter.executeLines(dialogue!.lines)

      expect(result.output).toContain('Complex true')
      expect(result.output).not.toContain('Complex false')
    })

    it('should handle parenthesized boolean expressions', async () => {
      const story = `
DIALOGUE test
  SET flag1 = true
  SET flag2 = true
  SET flag3 = false
  
  IF (flag1 AND flag2) AND NOT flag3
    "Parenthesized true"
  ELSE
    "Parenthesized false"
  END
END
      `

      const interpreter = new StoryInterpreter()
      interpreter.loadContent(story)

      const dialogue = interpreter.getDialogue('test')
      const result = await interpreter.executeLines(dialogue!.lines)

      expect(result.output).toContain('Parenthesized true')
      expect(result.output).not.toContain('Parenthesized false')
    })
  })

  describe('HAS conditions', () => {
    it('should execute IF branch when HAS(item) is true', async () => {
      const story = `
DIALOGUE test
  GIVE key
  
  IF HAS(key)
    "You have the key."
  ELSE
    "No key."
  END
END
      `

      const interpreter = new StoryInterpreter()
      interpreter.loadContent(story)

      const dialogue = interpreter.getDialogue('test')
      const result = await interpreter.executeLines(dialogue!.lines)

      expect(result.output).toContain('You have the key.')
      expect(result.output).not.toContain('No key.')
    })

    it('should execute ELSE branch when HAS(item) is false', async () => {
      const story = `
DIALOGUE test
  IF HAS(key)
    "You have the key."
  ELSE
    "No key."
  END
END
      `

      const interpreter = new StoryInterpreter()
      interpreter.loadContent(story)

      const dialogue = interpreter.getDialogue('test')
      const result = await interpreter.executeLines(dialogue!.lines)

      expect(result.output).not.toContain('You have the key.')
      expect(result.output).toContain('No key.')
    })
  })

  describe('NOT HAS conditions', () => {
    it('should execute IF branch when NOT HAS(item) is true', async () => {
      const story = `
DIALOGUE test
  IF NOT HAS(key)
    "You don't have the key."
  ELSE
    "You have the key."
  END
END
      `

      const interpreter = new StoryInterpreter()
      interpreter.loadContent(story)

      const dialogue = interpreter.getDialogue('test')
      const result = await interpreter.executeLines(dialogue!.lines)

      expect(result.output).toContain('You don\'t have the key.')
      expect(result.output).not.toContain('You have the key.')
    })

    it('should execute ELSE branch when NOT HAS(item) is false', async () => {
      const story = `
DIALOGUE test
  GIVE key
  
  IF NOT HAS(key)
    "You don't have the key."
  ELSE
    "You have the key."
  END
END
      `

      const interpreter = new StoryInterpreter()
      interpreter.loadContent(story)

      const dialogue = interpreter.getDialogue('test')
      const result = await interpreter.executeLines(dialogue!.lines)

      expect(result.output).not.toContain('You don\'t have the key.')
      expect(result.output).toContain('You have the key.')
    })
  })
})
