import { beforeEach, describe, expect, it, vi } from 'vitest'
import { EventBus } from './EventBus'
import { GameRunner } from './GameRunner'
import { GameState } from './GameState'

describe('Inventory Management', () => {
  let gameRunner: GameRunner
  let eventBus: EventBus
  let eventSpy: any

  beforeEach(() => {
    eventBus = new EventBus()
    eventSpy = vi.spyOn(eventBus, 'emit')

    // Minimal story content
    const storyContent = `
SCENE start
  location: "Start"
  DESCRIPTION
    Start scene
  END
END
    `

    gameRunner = new GameRunner({
      storyContent,
      eventBus,
      initialState: new GameState(),
    })

    gameRunner.start()
  })

  it('addItem adds to inventory and emits event', () => {
    gameRunner.addItem('sword')

    expect(gameRunner.hasItem('sword')).toBe(true)
    expect(eventSpy).toHaveBeenCalledWith({
      type: 'inventory:add',
      itemId: 'sword',
    })
  })

  it('removeItem removes from inventory and emits event', () => {
    gameRunner.addItem('potion')
    eventSpy.mockClear() // Clear the add event

    gameRunner.removeItem('potion')

    expect(gameRunner.hasItem('potion')).toBe(false)
    expect(eventSpy).toHaveBeenCalledWith({
      type: 'inventory:remove',
      itemId: 'potion',
    })
  })

  it('hasItem checks inventory', () => {
    expect(gameRunner.hasItem('key')).toBe(false)
    gameRunner.addItem('key')
    expect(gameRunner.hasItem('key')).toBe(true)
  })

  it('getInventory returns all items', () => {
    gameRunner.addItem('apple')
    gameRunner.addItem('book')

    const inventory = gameRunner.getInventory()
    expect(inventory).toContain('apple')
    expect(inventory).toContain('book')
    expect(inventory.length).toBe(2)
  })

  it('useItemOn emits event', () => {
    gameRunner.addItem('key')

    gameRunner.useItemOn('key', 'door')

    expect(eventSpy).toHaveBeenCalledWith({
      type: 'inventory:use',
      itemId: 'key',
      targetId: 'door',
    })
  })

  it('useItemOn checks if user has item', () => {
    // User doesn't have 'missing_item'
    gameRunner.useItemOn('missing_item', 'door')

    expect(eventSpy).not.toHaveBeenCalledWith({
      type: 'inventory:use',
      itemId: 'missing_item',
      targetId: 'door',
    })
  })
})
