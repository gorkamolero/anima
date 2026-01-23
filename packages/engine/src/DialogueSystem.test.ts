import { beforeEach, describe, expect, it } from 'vitest'
import { EventBus, type GameEvent } from './EventBus'
import { GameRunner } from './GameRunner'

const DIALOGUE_STORY = `
SCENE test_scene
  DESCRIPTION
    Test scene.
  END
  HOTSPOT talker
    name: Talker
    TALK
      -> test_dialogue
    END
  END
END

DIALOGUE test_dialogue
  alice: "Hello."
  bob: "Hi there."
  CHOICE
    > "Good"
      bob: "Good."
    > "Bad"
      bob: "Bad."
  END
END
`

describe('Dialogue System (US-006)', () => {
  let runner: GameRunner
  let eventBus: EventBus
  let events: GameEvent[]

  beforeEach(() => {
    eventBus = new EventBus()
    events = []
    eventBus.subscribe((e) => events.push(e))
    runner = new GameRunner({ storyContent: DIALOGUE_STORY, eventBus })
    runner.start()
  })

  it('should control dialogue flow with continue()', async () => {
    // Start dialogue
    runner.talkTo('talker')

    // Allow async tasks to run slightly
    await new Promise((resolve) => setTimeout(resolve, 0))

    // Check start event
    expect(events.find((e) => e.type === 'dialogue:start')).toBeDefined()

    // Dialogue auto-advances until CHOICE, so both lines emit immediately
    const lines = events.filter(
      (e) => e.type === 'dialogue:line' && (e as any).speaker !== 'narrator'
    )
    expect(lines.length).toBe(2)
    expect((lines[0] as any).text).toBe('Hello.')
    expect((lines[1] as any).text).toBe('Hi there.')

    // Check choice
    const choiceEvent = events.find((e) => e.type === 'dialogue:choice')
    expect(choiceEvent).toBeDefined()

    // Select choice
    runner.selectChoice(1)
    await new Promise((resolve) => setTimeout(resolve, 0))

    // Check response line
    const lines3 = events.filter(
      (e) => e.type === 'dialogue:line' && (e as any).speaker !== 'narrator'
    )
    expect(lines3.length).toBe(3)
    expect((lines3[2] as any).text).toBe('Good.')

    // Advance to end
    runner.continue()
    await new Promise((resolve) => setTimeout(resolve, 0))

    // Check end
    expect(events.find((e) => e.type === 'dialogue:end')).toBeDefined()
  })
})
