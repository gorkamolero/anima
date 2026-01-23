import { describe, expect, it, vi } from 'vitest'
import { EventBus } from './EventBus'

describe('EventBus', () => {
  it('should allow subscribing and receiving events', () => {
    const bus = new EventBus()
    const handler = vi.fn()

    bus.subscribe(handler)
    bus.emit({ type: 'game:start' })

    expect(handler).toHaveBeenCalledWith({ type: 'game:start' })
  })

  it('should allow unsubscribing', () => {
    const bus = new EventBus()
    const handler = vi.fn()

    const unsubscribe = bus.subscribe(handler)
    unsubscribe()
    bus.emit({ type: 'game:start' })

    expect(handler).not.toHaveBeenCalled()
  })

  it('should notify multiple subscribers', () => {
    const bus = new EventBus()
    const handler1 = vi.fn()
    const handler2 = vi.fn()

    bus.subscribe(handler1)
    bus.subscribe(handler2)
    bus.emit({ type: 'scene:enter', sceneId: 'test', description: [] })

    expect(handler1).toHaveBeenCalled()
    expect(handler2).toHaveBeenCalled()
  })

  it('should log events when logging is enabled', () => {
    const bus = new EventBus()
    bus.enableLogging()

    bus.emit({ type: 'game:start' })
    bus.emit({ type: 'scene:enter', sceneId: 'intro', description: ['Hello'] })

    const log = bus.getLog()
    expect(log).toHaveLength(2)
    expect(log[0].type).toBe('game:start')
    expect(log[1].type).toBe('scene:enter')
  })

  it('should not log events when logging is disabled', () => {
    const bus = new EventBus()

    bus.emit({ type: 'game:start' })

    expect(bus.getLog()).toHaveLength(0)
  })
})
