/**
 * US-017: ACT_END Signal Tests
 * US-018: act:complete Event Emission Tests
 */

import { describe, expect, it } from 'vitest'
import { HeadlessRunner } from './HeadlessRunner'

describe('US-017: ACT_END Signal', () => {
  const storyWithActEnd = `
SCENE final_scene
  DESCRIPTION
    The final scene.
  END
  HOTSPOT portal
    USE
      SET visited_final = true
      -> ACT_END
    END
  END
END
`

  it('should recognize ACT_END command in storyscript', async () => {
    const runner = new HeadlessRunner(storyWithActEnd)

    const result = await runner.run([
      { type: 'enterScene', target: 'final_scene' },
      { type: 'use', target: 'portal' },
    ])

    // ACT_END should execute without error
    expect(result.passed).toBe(true)
  })

  it('should trigger act completion flow', async () => {
    const runner = new HeadlessRunner(storyWithActEnd)
    const events = runner.getEvents()

    await runner.run([
      { type: 'enterScene', target: 'final_scene' },
      { type: 'use', target: 'portal' },
    ])

    // Should have act:complete event
    const actCompleteEvent = events.find((e) => e.type === 'act:complete')
    expect(actCompleteEvent).toBeDefined()
  })

  it('should preserve game state before ACT_END', async () => {
    const runner = new HeadlessRunner(storyWithActEnd)
    const events = runner.getEvents()

    await runner.run([
      { type: 'enterScene', target: 'final_scene' },
      { type: 'use', target: 'portal' }, // Sets visited_final flag
    ])

    // Flag should be set before ACT_END
    const actCompleteEvent = events.find((e) => e.type === 'act:complete')
    expect(actCompleteEvent).toBeDefined()
    if (actCompleteEvent && actCompleteEvent.type === 'act:complete') {
      expect(actCompleteEvent.state.flags['visited_final']).toBe(true)
    }
  })
})

describe('US-018: act:complete Event Emission', () => {
  it('should emit act:complete event when ACT_END executes', async () => {
    const storyContent = `
SCENE test
  DESCRIPTION
    Test scene.
  END
  HOTSPOT finish
    USE
      -> ACT_END
    END
  END
END
`
    const runner = new HeadlessRunner(storyContent)
    const events = runner.getEvents()

    await runner.run([
      { type: 'enterScene', target: 'test' },
      { type: 'use', target: 'finish' },
    ])

    const actCompleteEvent = events.find((e) => e.type === 'act:complete')
    expect(actCompleteEvent).toBeDefined()
  })

  it('should include act number/id in event', async () => {
    const storyContent = `
SCENE test
  DESCRIPTION
    Test scene.
  END
  HOTSPOT set_act
    USE
      SET current_act = 2
    END
  END
  HOTSPOT finish
    USE
      -> ACT_END
    END
  END
END
`
    const runner = new HeadlessRunner(storyContent)
    const events = runner.getEvents()

    await runner.run([
      { type: 'enterScene', target: 'test' },
      { type: 'use', target: 'set_act' },
      { type: 'use', target: 'finish' },
    ])

    const actCompleteEvent = events.find((e) => e.type === 'act:complete')
    expect(actCompleteEvent).toBeDefined()
    if (actCompleteEvent && actCompleteEvent.type === 'act:complete') {
      expect(actCompleteEvent.actId).toBe(2)
    }
  })

  it('should include final game state in event', async () => {
    const storyContent = `
SCENE test
  DESCRIPTION
    Test scene.
  END
  HOTSPOT prepare
    USE
      GIVE magic_key
      SET quest_complete = true
    END
  END
  HOTSPOT finish
    USE
      -> ACT_END
    END
  END
END
`
    const runner = new HeadlessRunner(storyContent)
    const events = runner.getEvents()

    await runner.run([
      { type: 'enterScene', target: 'test' },
      { type: 'use', target: 'prepare' },
      { type: 'use', target: 'finish' },
    ])

    const actCompleteEvent = events.find((e) => e.type === 'act:complete')
    expect(actCompleteEvent).toBeDefined()
    if (actCompleteEvent && actCompleteEvent.type === 'act:complete') {
      expect(actCompleteEvent.state.inventory).toContain('magic_key')
      expect(actCompleteEvent.state.flags['quest_complete']).toBe(true)
    }
  })

  it('should default to act 1 if current_act not set', async () => {
    const storyContent = `
SCENE test
  DESCRIPTION
    Test scene.
  END
  HOTSPOT finish
    USE
      -> ACT_END
    END
  END
END
`
    const runner = new HeadlessRunner(storyContent)
    const events = runner.getEvents()

    await runner.run([
      { type: 'enterScene', target: 'test' },
      { type: 'use', target: 'finish' },
    ])

    const actCompleteEvent = events.find((e) => e.type === 'act:complete')
    expect(actCompleteEvent).toBeDefined()
    if (actCompleteEvent && actCompleteEvent.type === 'act:complete') {
      expect(actCompleteEvent.actId).toBe(1)
    }
  })
})

describe('US-019: Prepare Game State for Next Act', () => {
  it('should set act completion flag', async () => {
    const storyContent = `
SCENE test
  DESCRIPTION
    Test scene.
  END
  HOTSPOT finish
    USE
      -> ACT_END
    END
  END
END
`
    const runner = new HeadlessRunner(storyContent)

    await runner.run([
      { type: 'enterScene', target: 'test' },
      { type: 'use', target: 'finish' },
    ])

    // Check that act_1_complete flag is set
    const flag = runner.getRunner().getState().getFlag('act_1_complete')
    expect(flag).toBe(true)
  })

  it('should preserve inventory for next act', async () => {
    const storyContent = `
SCENE test
  DESCRIPTION
    Test scene.
  END
  HOTSPOT item
    USE
      GIVE ancient_artifact
    END
  END
  HOTSPOT finish
    USE
      -> ACT_END
    END
  END
END
`
    const runner = new HeadlessRunner(storyContent)

    await runner.run([
      { type: 'enterScene', target: 'test' },
      { type: 'use', target: 'item' },
      { type: 'use', target: 'finish' },
    ])

    // Inventory should persist after ACT_END
    const events = runner.getEvents()
    const actCompleteEvent = events.find((e) => e.type === 'act:complete')
    if (actCompleteEvent && actCompleteEvent.type === 'act:complete') {
      expect(actCompleteEvent.state.inventory).toContain('ancient_artifact')
    }

    // And still be accessible from game state
    expect(runner.getRunner().getState().hasItem('ancient_artifact')).toBe(true)
  })

  it('should preserve flags for next act', async () => {
    const storyContent = `
SCENE test
  DESCRIPTION
    Test scene.
  END
  HOTSPOT prepare
    USE
      SET met_stranger = true
      SET trust_level = 5
    END
  END
  HOTSPOT finish
    USE
      -> ACT_END
    END
  END
END
`
    const runner = new HeadlessRunner(storyContent)

    await runner.run([
      { type: 'enterScene', target: 'test' },
      { type: 'use', target: 'prepare' },
      { type: 'use', target: 'finish' },
    ])

    // Flags should persist after ACT_END
    const events = runner.getEvents()
    const actCompleteEvent = events.find((e) => e.type === 'act:complete')
    if (actCompleteEvent && actCompleteEvent.type === 'act:complete') {
      expect(actCompleteEvent.state.flags['met_stranger']).toBe(true)
      expect(actCompleteEvent.state.flags['trust_level']).toBe(5)
    }
  })
})
