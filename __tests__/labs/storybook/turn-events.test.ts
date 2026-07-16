import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  emitTurnLand,
  emitTurnStart,
  isFrozenTurnPose,
  onTurnLand,
  onTurnStart,
} from '@/components/labs/storybook/turn-events'

const setUrl = (search: string) =>
  window.history.replaceState({}, '', `/labs/storybook${search}`)

describe('turn-events bridge', () => {
  it('delivers turn-start events to subscribers with dir + from', () => {
    const seen: unknown[] = []
    const off = onTurnStart((e) => seen.push(e))
    emitTurnStart({ dir: 'next', from: 3 })
    off()
    expect(seen).toEqual([{ dir: 'next', from: 3 }])
  })

  it('delivers turn-land events to subscribers with dir + to', () => {
    const seen: unknown[] = []
    const off = onTurnLand((e) => seen.push(e))
    emitTurnLand({ dir: 'prev', to: 2 })
    off()
    expect(seen).toEqual([{ dir: 'prev', to: 2 }])
  })

  it('stops delivering after unsubscribe', () => {
    const cb = vi.fn()
    const off = onTurnStart(cb)
    emitTurnStart({ dir: 'next', from: 1 })
    off()
    emitTurnStart({ dir: 'next', from: 2 })
    expect(cb).toHaveBeenCalledTimes(1)
  })

  it('fans out to every subscriber and keeps the two channels separate', () => {
    const start = vi.fn()
    const land = vi.fn()
    const start2 = vi.fn()
    const offs = [onTurnStart(start), onTurnStart(start2), onTurnLand(land)]
    emitTurnStart({ dir: 'next', from: 0 })
    expect(start).toHaveBeenCalledTimes(1)
    expect(start2).toHaveBeenCalledTimes(1)
    expect(land).not.toHaveBeenCalled()
    emitTurnLand({ dir: 'next', to: 1 })
    expect(land).toHaveBeenCalledTimes(1)
    for (const off of offs) off()
  })
})

describe('isFrozenTurnPose', () => {
  afterEach(() => setUrl(''))

  it('is true only for a frozen mid-turn pose (?sbpose=<n>:<t>:<dir>)', () => {
    setUrl('?sbpose=3:0.5:next')
    expect(isFrozenTurnPose()).toBe(true)
    setUrl('?sbpose=2:1:prev')
    expect(isFrozenTurnPose()).toBe(true)
  })

  it('is false for a rest pose, a missing param, or a non-numeric t', () => {
    setUrl('?sbpose=3')
    expect(isFrozenTurnPose()).toBe(false)
    setUrl('')
    expect(isFrozenTurnPose()).toBe(false)
    setUrl('?sbpose=3:foo:next')
    expect(isFrozenTurnPose()).toBe(false)
  })
})
