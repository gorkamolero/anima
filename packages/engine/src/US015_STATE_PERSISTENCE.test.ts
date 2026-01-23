/**
 * US-015: Scene Transition State Persistence Tests
 * Verifies that inventory and flags persist across scene transitions
 */

import { describe, expect, it } from 'vitest'
import { HeadlessRunner } from './HeadlessRunner'

describe('US-015: State Persistence Across Scene Transitions', () => {
  it('should persist inventory items across scene transitions', async () => {
    const storyContent = `
SCENE bus_station
  DESCRIPTION
    Arkham Bus Depot
  END
  HOTSPOT note
    LOOK
      A crumpled note on the counter.
    END
    USE
      GIVE note
    END
  END
  HOTSPOT exit
    LOOK
      The bus is waiting outside.
    END
    USE
      IF HAS(note)
        -> bus_interior
      END
    END
  END

SCENE bus_interior
  DESCRIPTION
    Bus to Innsmouth
  END
END
`

    const runner = new HeadlessRunner(storyContent)

    // Add inventory item in first scene, then transition
    const result = await runner.run([
      { type: 'assertScene', target: 'bus_station' },
      { type: 'use', target: 'note' },
      { type: 'assertInventory', target: 'note', value: true },
      { type: 'use', target: 'exit' },
      { type: 'assertScene', target: 'bus_interior' },
      { type: 'assertInventory', target: 'note', value: true }, // Should still have it
    ])

    if (!result.passed) {
      console.log('Failures:', result.failures)
      console.log('Events:', result.events.map((e) => e.type))
    }
    expect(result.passed).toBe(true)
  })

  it('should persist flags across scene transitions', async () => {
    const storyContent = `
SCENE scene1
  DESCRIPTION
    Scene 1
  END
  HOTSPOT button
    LOOK
      A button on the wall.
    END
    USE
      SET pressed_button = true
    END
  END
  HOTSPOT exit
    LOOK
      An exit door.
    END
    USE
      -> scene2
    END
  END
END

SCENE scene2
  DESCRIPTION
    Scene 2
  END
END
`

    const runner = new HeadlessRunner(storyContent)

    const result = await runner.run([
      { type: 'assertScene', target: 'scene1' },
      { type: 'use', target: 'button' },
      { type: 'assertFlag', target: 'pressed_button', value: true },
      { type: 'use', target: 'exit' },
      { type: 'assertScene', target: 'scene2' },
      { type: 'assertFlag', target: 'pressed_button', value: true }, // Should still be true
    ])

    if (!result.passed) {
      console.log('Failures:', result.failures)
      console.log('Events:', result.events.map((e) => e.type))
    }
    expect(result.passed).toBe(true)
  })

  it('should persist state with Act 1 story', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const storyPath = join(__dirname, '../../../adventures/shadow-over-innsmouth/story/act1.story')
    const act1Content = readFileSync(storyPath, 'utf-8')

    const runner = new HeadlessRunner(act1Content)

    // Give player bus ticket and verify it persists through transition
    runner.getRunner().getState().addItem('bus_ticket')
    runner.getRunner().syncState()

    const result = await runner.run([
      { type: 'assertScene', target: 'bus_station' },
      { type: 'assertInventory', target: 'bus_ticket', value: true },
      { type: 'use', target: 'exit' },
      { type: 'assertScene', target: 'bus_interior' },
      { type: 'assertInventory', target: 'bus_ticket', value: true }, // Should still have ticket
    ])

    if (!result.passed) {
      console.log('Failures:', result.failures)
      console.log('Events:', result.events.map((e) => e.type).slice(-10))
    }
    expect(result.passed).toBe(true)
  })
})
