/**
 * Multi-Act Playthrough Tests
 * Tests for consolidated story playthrough across multiple acts
 */

import { describe, expect, it } from 'vitest'
import { join } from 'node:path'
import { HeadlessRunner } from './HeadlessRunner'
import { GameRunner, loadActsFromDirectory } from './GameRunner'
import { EventBus } from './EventBus'

describe('Multi-Act Playthrough', () => {
  const act1Content = `
SCENE act1_start
  DESCRIPTION
    Act 1 beginning.
  END
  HOTSPOT finish
    USE
      SET act1_flag = true
      GIVE act1_item
      -> ACT_END
    END
  END
END
`

  const act2Content = `
SCENE act2_start
  DESCRIPTION
    Act 2 beginning.
  END
  HOTSPOT finish
    USE
      SET act2_flag = true
      -> ACT_END
    END
  END
END
`

  const act3Content = `
SCENE act3_start
  DESCRIPTION
    Act 3 - The finale.
  END
  HOTSPOT finish
    USE
      SET act3_flag = true
      -> ACT_END
    END
  END
END
`

  it('should accept multiple act contents in config', () => {
    const eventBus = new EventBus()
    const runner = new GameRunner({
      actContents: [act1Content, act2Content, act3Content],
      eventBus,
    })

    expect(runner.getCurrentAct()).toBe(1)
    expect(runner.hasNextAct()).toBe(true)
  })

  it('should start in first act', async () => {
    const eventBus = new EventBus()
    eventBus.enableLogging()

    const runner = new GameRunner({
      actContents: [act1Content, act2Content],
      eventBus,
    })

    runner.start()
    await runner.enterScene('act1_start')

    expect(runner.getState().getCurrentScene()).toBe('act1_start')
    expect(runner.getCurrentAct()).toBe(1)
  })

  it('should advance to next act on ACT_END', async () => {
    const eventBus = new EventBus()
    eventBus.enableLogging()

    const runner = new GameRunner({
      actContents: [act1Content, act2Content],
      eventBus,
    })

    runner.start()
    await runner.enterScene('act1_start')

    // Complete act 1
    await runner.use('finish')

    // Should now be in act 2
    expect(runner.getCurrentAct()).toBe(2)

    // Check events
    const events = eventBus.getLog()
    const actCompleteEvent = events.find((e) => e.type === 'act:complete')
    const actStartEvent = events.find((e) => e.type === 'act:start')

    expect(actCompleteEvent).toBeDefined()
    expect(actStartEvent).toBeDefined()
    if (actStartEvent && actStartEvent.type === 'act:start') {
      expect(actStartEvent.actId).toBe(2)
    }
  })

  it('should preserve inventory across acts', async () => {
    const eventBus = new EventBus()
    const runner = new GameRunner({
      actContents: [act1Content, act2Content],
      eventBus,
    })

    runner.start()
    await runner.enterScene('act1_start')

    // Complete act 1 (which gives act1_item)
    await runner.use('finish')

    // Item should persist into act 2
    expect(runner.getState().hasItem('act1_item')).toBe(true)
  })

  it('should preserve flags across acts', async () => {
    const eventBus = new EventBus()
    const runner = new GameRunner({
      actContents: [act1Content, act2Content],
      eventBus,
    })

    runner.start()
    await runner.enterScene('act1_start')

    // Complete act 1 (which sets act1_flag)
    await runner.use('finish')

    // Flag should persist into act 2
    expect(runner.getState().getFlag('act1_flag')).toBe(true)
    // Act completion flag should also be set
    expect(runner.getState().getFlag('act_1_complete')).toBe(true)
  })

  it('should emit game:end when all acts complete', async () => {
    const eventBus = new EventBus()
    eventBus.enableLogging()

    const runner = new GameRunner({
      actContents: [act1Content, act2Content],
      eventBus,
    })

    runner.start()
    await runner.enterScene('act1_start')

    // Complete act 1
    await runner.use('finish')

    // Now in act 2, complete it
    await runner.use('finish')

    // Should emit game:end
    const events = eventBus.getLog()
    const gameEndEvent = events.find((e) => e.type === 'game:end')
    expect(gameEndEvent).toBeDefined()
  })

  it('should work with legacy single storyContent', async () => {
    const eventBus = new EventBus()
    const runner = new GameRunner({
      storyContent: act1Content,
      eventBus,
    })

    runner.start()
    await runner.enterScene('act1_start')

    expect(runner.getCurrentAct()).toBe(1)
    expect(runner.hasNextAct()).toBe(false)
  })
})

describe('Cutscene Events', () => {
  const storyWithCutscene = `
SCENE entrance
  DESCRIPTION
    The entrance.
  END
  HOTSPOT door
    USE
      -> enter_cutscene
    END
  END
END

TRIGGER enter_cutscene
  CUTSCENE
    "The door creaks open."
    narrator: "You step inside."
    hermes (thinks): "This place feels wrong."
  END
  -> inside
END

SCENE inside
  DESCRIPTION
    Inside the building.
  END
END
`

  it('should emit cutscene events during CUTSCENE blocks', async () => {
    const eventBus = new EventBus()
    eventBus.enableLogging()

    const runner = new GameRunner({
      storyContent: storyWithCutscene,
      eventBus,
    })

    runner.start()
    await runner.enterScene('entrance')
    await runner.use('door')

    const events = eventBus.getLog()

    // Check for cutscene events
    const cutsceneStart = events.find((e) => e.type === 'cutscene:start')
    const cutsceneEnd = events.find((e) => e.type === 'cutscene:end')
    const cutsceneLines = events.filter((e) => e.type === 'cutscene:line')

    expect(cutsceneStart).toBeDefined()
    expect(cutsceneEnd).toBeDefined()
    expect(cutsceneLines.length).toBeGreaterThan(0)
  })

  it('should parse speaker and text from cutscene lines', async () => {
    const eventBus = new EventBus()
    eventBus.enableLogging()

    const runner = new GameRunner({
      storyContent: storyWithCutscene,
      eventBus,
    })

    runner.start()
    await runner.enterScene('entrance')
    await runner.use('door')

    const events = eventBus.getLog()
    const cutsceneLines = events.filter((e) => e.type === 'cutscene:line')

    // Should have narration and dialogue lines
    const narrationLine = cutsceneLines.find(
      (e) => e.type === 'cutscene:line' && !('speaker' in e && e.speaker)
    )
    const dialogueLine = cutsceneLines.find(
      (e) => e.type === 'cutscene:line' && 'speaker' in e && e.speaker === 'narrator'
    )

    expect(narrationLine).toBeDefined()
    expect(dialogueLine).toBeDefined()
  })
})

describe('loadActsFromDirectory', () => {
  it('should load and sort act files from directory', async () => {
    const storyDir = join(__dirname, '../../../adventures/shadow-over-innsmouth/story')
    const actContents = await loadActsFromDirectory(storyDir)

    // Should load all 4 acts
    expect(actContents.length).toBe(4)

    // First act should contain Act 1 content
    expect(actContents[0]).toContain('bus_station')
    expect(actContents[0]).toContain('act: 1')

    // Last act should contain Act 4 content
    expect(actContents[3]).toContain('act: 4')
  })

  it('should work with GameRunner for full game setup', async () => {
    const storyDir = join(__dirname, '../../../adventures/shadow-over-innsmouth/story')
    const actContents = await loadActsFromDirectory(storyDir)

    const eventBus = new EventBus()
    const runner = new GameRunner({
      actContents,
      eventBus,
    })

    expect(runner.getCurrentAct()).toBe(1)
    expect(runner.hasNextAct()).toBe(true)

    // Start and verify first scene
    runner.start()
    await runner.enterScene('bus_station')
    expect(runner.getState().getCurrentScene()).toBe('bus_station')
  })
})
