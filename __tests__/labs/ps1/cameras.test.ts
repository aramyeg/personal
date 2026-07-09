import { describe, expect, it } from 'vitest'
import {
  ANGLES,
  ANGLE_ORDER,
  experienceReducer,
  initialState,
} from '@/components/labs/ps1/scene/cameras'

const booted = { ...initialState, booted: true }

describe('experienceReducer', () => {
  it('gates everything behind boot', () => {
    expect(experienceReducer(initialState, { type: 'CUT', dir: 1 })).toBe(initialState)
    expect(experienceReducer(initialState, { type: 'OPEN_PANEL', panel: 'menu' })).toBe(
      initialState
    )
  })

  it('BOOT_DONE flips booted to true and returns a new object', () => {
    const s = experienceReducer(initialState, { type: 'BOOT_DONE' })
    expect(s).not.toBe(initialState)
    expect(s.booted).toBe(true)
    expect(s.angle).toBe('room')
    expect(s.panel).toBeNull()
  })

  it('cycles angles with wrap in both directions', () => {
    let s = booted
    for (const a of [...ANGLE_ORDER.slice(1), ANGLE_ORDER[0]]) {
      s = experienceReducer(s, { type: 'CUT', dir: 1 })
      expect(s.angle).toBe(a)
    }
    expect(experienceReducer(booted, { type: 'CUT', dir: -1 }).angle).toBe(ANGLE_ORDER[3])
  })

  it('cycles angles backward with wrap through the whole order', () => {
    let s = booted
    // starting at 'room' (index 0), dir -1 visits the order in reverse, wrapping to 'tv' first
    for (const a of [...ANGLE_ORDER].reverse()) {
      s = experienceReducer(s, { type: 'CUT', dir: -1 })
      expect(s.angle).toBe(a)
    }
  })

  it('CUT_TO jumps directly to the given angle', () => {
    const s = experienceReducer(booted, { type: 'CUT_TO', angle: 'tv' })
    expect(s.angle).toBe('tv')
  })

  it('CUT and CUT_TO are ignored before boot', () => {
    expect(experienceReducer(initialState, { type: 'CUT', dir: 1 })).toBe(initialState)
    expect(experienceReducer(initialState, { type: 'CUT_TO', angle: 'tv' })).toBe(initialState)
  })

  it('a panel blocks cuts and ESCAPE closes it', () => {
    const open = experienceReducer(booted, { type: 'OPEN_PANEL', panel: 'skills' })
    expect(open.panel).toBe('skills')
    expect(experienceReducer(open, { type: 'CUT', dir: 1 })).toBe(open)
    expect(experienceReducer(open, { type: 'CUT_TO', angle: 'tv' })).toBe(open)
    expect(experienceReducer(open, { type: 'ESCAPE' }).panel).toBeNull()
    expect(experienceReducer(booted, { type: 'ESCAPE' })).toBe(booted)
  })

  it('OPEN_PANEL is ignored before boot', () => {
    expect(experienceReducer(initialState, { type: 'OPEN_PANEL', panel: 'menu' })).toBe(
      initialState
    )
  })

  it('CLOSE_PANEL closes an open panel and is identity when already closed', () => {
    const open = experienceReducer(booted, { type: 'OPEN_PANEL', panel: 'contact' })
    expect(experienceReducer(open, { type: 'CLOSE_PANEL' }).panel).toBeNull()
    expect(experienceReducer(booted, { type: 'CLOSE_PANEL' })).toBe(booted)
  })

  it('TOGGLE_SOUND flips soundOn', () => {
    const on = experienceReducer(booted, { type: 'TOGGLE_SOUND' })
    expect(on.soundOn).toBe(true)
    const off = experienceReducer(on, { type: 'TOGGLE_SOUND' })
    expect(off.soundOn).toBe(false)
  })

  it('never mutates', () => {
    const frozen = Object.freeze({ ...booted })
    expect(() => experienceReducer(frozen, { type: 'CUT', dir: 1 })).not.toThrow()
  })

  it('identical no-op transitions return the same reference', () => {
    expect(experienceReducer(initialState, { type: 'ESCAPE' })).toBe(initialState)
    expect(experienceReducer(booted, { type: 'ESCAPE' })).toBe(booted)
    expect(experienceReducer(booted, { type: 'CLOSE_PANEL' })).toBe(booted)
  })

  it('all four angles have sane fov and distinct positions', () => {
    const pos = new Set(Object.values(ANGLES).map((a) => a.position.join(',')))
    expect(pos.size).toBe(4)
    for (const a of Object.values(ANGLES)) expect(a.fov).toBeGreaterThanOrEqual(45)
  })

  it('ANGLE_ORDER matches the four angle ids in the documented order', () => {
    expect(ANGLE_ORDER).toEqual(['room', 'desk', 'shelf', 'tv'])
  })

  it('every angle id in ANGLES matches its key and has lowercase label', () => {
    for (const [key, a] of Object.entries(ANGLES)) {
      expect(a.id).toBe(key)
      expect(a.label).toBe(a.label.toLowerCase())
    }
  })

  it('initialState matches the documented shape', () => {
    expect(initialState).toEqual({
      booted: false,
      angle: 'room',
      panel: null,
      soundOn: false,
    })
  })
})
