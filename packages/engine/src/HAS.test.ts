import { StoryInterpreter } from '@anima/storyscript'

describe('HAS Conditions', () => {
  describe('IF HAS(item) - Dialogues', () => {
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

    it('should execute IF HAS without ELSE when condition is true', async () => {
      const story = `
DIALOGUE test
  GIVE map
  
  IF HAS(map)
    "You unfold the map."
  END
  
  "You continue exploring."
END
      `

      const interpreter = new StoryInterpreter()
      interpreter.loadContent(story)

      const dialogue = interpreter.getDialogue('test')
      const result = await interpreter.executeLines(dialogue!.lines)

      expect(result.output).toContain('You unfold the map.')
      expect(result.output).toContain('You continue exploring.')
    })

    it('should skip IF HAS without ELSE when condition is false', async () => {
      const story = `
DIALOGUE test
  IF HAS(map)
    "You unfold the map."
  END
  
  "You continue exploring."
END
      `

      const interpreter = new StoryInterpreter()
      interpreter.loadContent(story)

      const dialogue = interpreter.getDialogue('test')
      const result = await interpreter.executeLines(dialogue!.lines)

      expect(result.output).not.toContain('You unfold the map.')
      expect(result.output).toContain('You continue exploring.')
    })

    it('should handle underscored item names', async () => {
      const story = `
DIALOGUE test
  GIVE ancient_key
  
  IF HAS(ancient_key)
    "The ancient key glows."
  ELSE
    "No ancient key."
  END
END
      `

      const interpreter = new StoryInterpreter()
      interpreter.loadContent(story)

      const dialogue = interpreter.getDialogue('test')
      const result = await interpreter.executeLines(dialogue!.lines)

      expect(result.output).toContain('The ancient key glows.')
      expect(result.output).not.toContain('No ancient key.')
    })

    it('should check for multiple items with AND', async () => {
      const story = `
DIALOGUE test
  GIVE key
  GIVE map
  
  IF HAS(key) AND HAS(map)
    "You have both key and map."
  ELSE
    "Missing items."
  END
END
      `

      const interpreter = new StoryInterpreter()
      interpreter.loadContent(story)

      const dialogue = interpreter.getDialogue('test')
      const result = await interpreter.executeLines(dialogue!.lines)

      expect(result.output).toContain('You have both key and map.')
      expect(result.output).not.toContain('Missing items.')
    })

    it('should check for any item with OR', async () => {
      const story = `
DIALOGUE test
  GIVE key
  
  IF HAS(key) OR HAS(map)
    "You have at least one."
  ELSE
    "You have neither."
  END
END
      `

      const interpreter = new StoryInterpreter()
      interpreter.loadContent(story)

      const dialogue = interpreter.getDialogue('test')
      const result = await interpreter.executeLines(dialogue!.lines)

      expect(result.output).toContain('You have at least one.')
      expect(result.output).not.toContain('You have neither.')
    })

    it('should check for missing items with NOT HAS', async () => {
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

      expect(result.output).toContain("You don't have the key.")
      expect(result.output).not.toContain('You have the key.')
    })

    it('should nest HAS conditions inside IF blocks', async () => {
      const story = `
DIALOGUE test
  SET unlocked = true
  GIVE key
  
  IF unlocked
    "The door is unlocked."
    IF HAS(key)
      "You use the key to open it."
    END
  END
END
      `

      const interpreter = new StoryInterpreter()
      interpreter.loadContent(story)

      const dialogue = interpreter.getDialogue('test')
      const result = await interpreter.executeLines(dialogue!.lines)

      expect(result.output).toContain('The door is unlocked.')
      expect(result.output).toContain('You use the key to open it.')
    })

    it('should handle GIVE followed by HAS check', async () => {
      const story = `
DIALOGUE test
  IF HAS(ticket)
    "Already have a ticket."
  ELSE
    "Here's your ticket."
    GIVE ticket
  END
  
  IF HAS(ticket)
    "Now you have a ticket."
  END
END
      `

      const interpreter = new StoryInterpreter()
      interpreter.loadContent(story)

      const dialogue = interpreter.getDialogue('test')
      const result = await interpreter.executeLines(dialogue!.lines)

      expect(result.output).toContain("Here's your ticket.")
      expect(result.output).toContain('Now you have a ticket.')
      expect(result.output).not.toContain('Already have a ticket.')
    })
  })

  describe('IF HAS(item) - Hotspots', () => {
    it('should check inventory in hotspot USE block', async () => {
      const story = `
SCENE test_room
  location: "Test Room"
  
  HOTSPOT chest
    USE
      IF HAS(key)
        "You unlock the chest."
        GIVE gold
      ELSE
        "The chest is locked."
      END
    END
  END
END
      `

      const interpreter = new StoryInterpreter()
      interpreter.loadContent(story)

      const scene = interpreter.getScene('test_room')
      const hotspot = scene?.hotspots.get('chest')

      // Try without key
      let result = await interpreter.executeLines(hotspot!.use)
      expect(result.output).toContain('The chest is locked.')
      expect(result.output).not.toContain('You unlock the chest.')

      // Give key and try again
      interpreter.state.inventory.add('key')
      result = await interpreter.executeLines(hotspot!.use)
      expect(result.output).toContain('You unlock the chest.')
      expect(result.output).not.toContain('The chest is locked.')
    })

    it('should handle multiple HAS checks in USE block', async () => {
      const story = `
SCENE test_room
  location: "Test Room"
  
  HOTSPOT machine
    USE
      IF HAS(coins) AND HAS(ticket)
        "You insert both coins and ticket."
        GIVE prize
      ELSE
        "Missing required items."
      END
    END
  END
END
      `

      const interpreter = new StoryInterpreter()
      interpreter.loadContent(story)

      const scene = interpreter.getScene('test_room')
      const hotspot = scene?.hotspots.get('machine')

      // Try with only coins
      interpreter.state.inventory.add('coins')
      let result = await interpreter.executeLines(hotspot!.use)
      expect(result.output).toContain('Missing required items.')

      // Add ticket and try again
      interpreter.state.inventory.add('ticket')
      result = await interpreter.executeLines(hotspot!.use)
      expect(result.output).toContain('You insert both coins and ticket.')
    })

    it('should use HAS to gate different actions', async () => {
      const story = `
SCENE test_room
  location: "Test Room"
  
  HOTSPOT door
    USE
      IF HAS(red_key)
        "The red key works."
        -> red_room
      ELSE
        IF HAS(blue_key)
          "The blue key works."
          -> blue_room
        ELSE
          "You don't have the right key."
        END
      END
    END
  END
END
      `

      const interpreter = new StoryInterpreter()
      interpreter.loadContent(story)

      const scene = interpreter.getScene('test_room')
      const hotspot = scene?.hotspots.get('door')

      // Try without any key
      let result = await interpreter.executeLines(hotspot!.use)
      expect(result.output).toContain("You don't have the right key.")
      expect(result.goto).toBeUndefined()

      // Try with blue key
      interpreter.state.inventory.add('blue_key')
      result = await interpreter.executeLines(hotspot!.use)
      expect(result.output).toContain('The blue key works.')
      expect(result.goto).toBe('blue_room')

      // Try with red key (after removing blue)
      interpreter.state.inventory.delete('blue_key')
      interpreter.state.inventory.add('red_key')
      result = await interpreter.executeLines(hotspot!.use)
      expect(result.output).toContain('The red key works.')
      expect(result.goto).toBe('red_room')
    })
  })

  describe('Inventory persistence', () => {
    it('should preserve items across multiple dialogue executions', async () => {
      const story = `
DIALOGUE check1
  GIVE item1
END

DIALOGUE check2
  IF HAS(item1)
    "Still have item1."
    GIVE item2
  END
END

DIALOGUE check3
  IF HAS(item1) AND HAS(item2)
    "Have both items."
  END
END
      `

      const interpreter = new StoryInterpreter()
      interpreter.loadContent(story)

      // First dialogue - get item1
      let dialogue = interpreter.getDialogue('check1')
      await interpreter.executeLines(dialogue!.lines)
      expect(interpreter.state.inventory.has('item1')).toBe(true)

      // Second dialogue - check item1, get item2
      dialogue = interpreter.getDialogue('check2')
      let result = await interpreter.executeLines(dialogue!.lines)
      expect(result.output).toContain('Still have item1.')
      expect(interpreter.state.inventory.has('item2')).toBe(true)

      // Third dialogue - check both
      dialogue = interpreter.getDialogue('check3')
      result = await interpreter.executeLines(dialogue!.lines)
      expect(result.output).toContain('Have both items.')
    })

    it('should preserve items across scenes', async () => {
      const story = `
SCENE room1
  location: "Room 1"
  
  HOTSPOT chest
    USE
      GIVE treasure
    END
  END
END

SCENE room2
  location: "Room 2"
  
  HOTSPOT guard
    USE
      IF HAS(treasure)
        "The guard lets you pass."
      ELSE
        "The guard blocks your way."
      END
    END
  END
END
      `

      const interpreter = new StoryInterpreter()
      interpreter.loadContent(story)

      // Get treasure in room1
      const room1 = interpreter.getScene('room1')
      const chest = room1?.hotspots.get('chest')
      await interpreter.executeLines(chest!.use)
      expect(interpreter.state.inventory.has('treasure')).toBe(true)

      // Check in room2
      const room2 = interpreter.getScene('room2')
      const guard = room2?.hotspots.get('guard')
      const result = await interpreter.executeLines(guard!.use)
      expect(result.output).toContain('The guard lets you pass.')
    })
  })
})
