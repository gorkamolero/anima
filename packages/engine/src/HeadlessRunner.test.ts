/**
 * HeadlessRunner Tests - US-011: Headless Test Runner
 * TDD: Tests written first
 */

import { describe, expect, it } from 'vitest'
import { HeadlessRunner, runHeadless } from './HeadlessRunner'

const MINIMAL_STORY = `
SCENE start
  location: Start
  DESCRIPTION
    You are at the start.
  END
  HOTSPOT door
    name: Door
    USE
      GOTO room2
    END
  END
END

SCENE room2
  location: Room 2
  DESCRIPTION
    You entered room 2.
  END
END
`

describe('HeadlessRunner (US-011)', () => {
  describe('run commands', () => {
    it('should run a sequence of commands', async () => {
      const result = await runHeadless(MINIMAL_STORY, [
        { type: 'enterScene', target: 'start' },
        { type: 'use', target: 'door' },
      ])

      expect(result.commands).toBe(2)
    })

    it('should collect events during run', async () => {
      const result = await runHeadless(MINIMAL_STORY, [{ type: 'enterScene', target: 'start' }])

      expect(result.events.length).toBeGreaterThan(0)
    })
  })

  describe('assertions', () => {
    it('should pass when assertScene matches current scene', async () => {
      const result = await runHeadless(MINIMAL_STORY, [
        { type: 'enterScene', target: 'start' },
        { type: 'assertScene', target: 'start' },
      ])

      expect(result.passed).toBe(true)
      expect(result.failures).toHaveLength(0)
    })

    it('should fail when assertScene does not match', async () => {
      const result = await runHeadless(MINIMAL_STORY, [
        { type: 'enterScene', target: 'start' },
        { type: 'assertScene', target: 'room2' },
      ])

      expect(result.passed).toBe(false)
      expect(result.failures.length).toBeGreaterThan(0)
    })

    it('should pass assertFlag when flag matches', async () => {
      const runner = new HeadlessRunner(MINIMAL_STORY)
      runner.getRunner().start()
      runner.getRunner().getState().setFlag('test', true)

      const result = await runner.run([{ type: 'assertFlag', target: 'test', value: true }])

      expect(result.passed).toBe(true)
    })

    it('should fail assertFlag when flag does not match', async () => {
      const result = await runHeadless(MINIMAL_STORY, [
        { type: 'enterScene', target: 'start' },
        { type: 'assertFlag', target: 'nonexistent', value: true },
      ])

      expect(result.passed).toBe(false)
    })
  })

  describe('HeadlessRunner class', () => {
    it('should expose getRunner for advanced usage', () => {
      const runner = new HeadlessRunner(MINIMAL_STORY)
      expect(runner.getRunner()).toBeDefined()
    })

    it('should reset state between runs', async () => {
      const runner = new HeadlessRunner(MINIMAL_STORY)
      await runner.run([{ type: 'enterScene', target: 'start' }])

      const eventsBefore = runner.getEvents().length
      runner.reset()

      expect(runner.getEvents()).toHaveLength(0)
    })
  })
})
