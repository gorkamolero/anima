import { StoryInterpreter } from '@anima/storyscript'

describe('GOTO in Hotspots - US-009', () => {
  it('should handle GOTO in hotspot USE block', async () => {
    const story = `
SCENE start_room
  location: "Start Room"
  
  HOTSPOT door
    USE
      "Opening door."
      -> next_room
    END
  END
END
      `

      const interpreter = new StoryInterpreter()
      interpreter.loadContent(story)

      const scene = interpreter.getScene('start_room')
      const hotspot = scene?.hotspots.get('door')

      const result = await interpreter.executeLines(hotspot!.use)
      
      expect(result.output).toContain('Opening door.')
      expect(result.goto).toBe('next_room')
    })

  it('should handle GOTO after narrative in hotspot', async () => {
    const story = `
SCENE start_room
  location: "Start Room"
  
  HOTSPOT door
    USE
      "The room fades away."
      "Through the portal..."
      -> dream_world
    END
  END
END
      `

      const interpreter = new StoryInterpreter()
      interpreter.loadContent(story)

      const scene = interpreter.getScene('start_room')
      const hotspot = scene?.hotspots.get('door')

      const result = await interpreter.executeLines(hotspot!.use)
      
      expect(result.output.length).toBe(2)
      expect(result.goto).toBe('dream_world')
    })

  it('should handle GOTO in hotspot with inventory changes', async () => {
    const story = `
SCENE treasure_room
  location: "Treasure Room"
  
  HOTSPOT chest
    USE
      GIVE gold
      -> victory_room
    END
  END
END
      `

      const interpreter = new StoryInterpreter()
      interpreter.loadContent(story)

      const scene = interpreter.getScene('treasure_room')
      const hotspot = scene?.hotspots.get('chest')

      const result = await interpreter.executeLines(hotspot!.use)
      
      expect(result.output.join('')).toContain('[You received: gold]')
      expect(result.goto).toBe('victory_room')
      expect(interpreter.state.inventory.has('gold')).toBe(true)
    })

  it('should handle GOTO in hotspot with flag changes', async () => {
    const story = `
SCENE control_room
  location: "Control Room"
  
  HOTSPOT lever
    USE
      SET activated = true
      -> secret_room
    END
  END
END
      `

      const interpreter = new StoryInterpreter()
      interpreter.loadContent(story)

      const scene = interpreter.getScene('control_room')
      const hotspot = scene?.hotspots.get('lever')

      const result = await interpreter.executeLines(hotspot!.use)
      
      expect(interpreter.state.flags.activated).toBe(true)
      expect(result.goto).toBe('secret_room')
    })
})
