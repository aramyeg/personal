import { beforeEach, describe, expect, it } from 'vitest'
import { defaultPipeline, migratePersisted, useCuratorStore } from '@/components/labs/curator/store'
import { OPEN_DEAL_ID } from '@/components/labs/curator/adapters'

const initial = useCuratorStore.getState()
beforeEach(() => {
  useCuratorStore.setState(initial, true)
  window.localStorage.clear()
})

describe('curator store', () => {
  it('starts on overview with the default pipeline', () => {
    const s = useCuratorStore.getState()
    expect(s.module).toBe('overview')
    expect(s.pipeline.sourced).toContain(OPEN_DEAL_ID)
    expect(s.pipeline['closed-won'].length).toBeGreaterThan(0)
  })

  it('counts module visits only on actual change', () => {
    const s = useCuratorStore.getState
    s().setModule('rooms')
    s().setModule('rooms')
    s().setModule('pipeline')
    expect(s().moduleVisits).toBe(2)
  })

  it('moves a pipeline card between columns at an index', () => {
    const s = useCuratorStore.getState
    s().movePipelineCard(OPEN_DEAL_ID, 'offer', 0)
    expect(s().pipeline.sourced).not.toContain(OPEN_DEAL_ID)
    expect(s().pipeline.offer[0]).toBe(OPEN_DEAL_ID)
  })

  it('clamps the insertion index', () => {
    const s = useCuratorStore.getState
    s().movePipelineCard(OPEN_DEAL_ID, 'closed-won', 999)
    const col = s().pipeline['closed-won']
    expect(col[col.length - 1]).toBe(OPEN_DEAL_ID)
  })

  it('caps toasts at 3, dropping the oldest', () => {
    const s = useCuratorStore.getState
    for (let i = 0; i < 4; i++) s().pushToast({ title: `t${i}` })
    expect(s().toasts).toHaveLength(3)
    expect(s().toasts[0].title).toBe('t1')
  })

  it('dismisses a toast by id', () => {
    const s = useCuratorStore.getState
    s().pushToast({ title: 'bye' })
    const id = s().toasts[0].id
    s().dismissToast(id)
    expect(s().toasts).toHaveLength(0)
  })

  it('persists only the intended slice', () => {
    const s = useCuratorStore.getState
    s().setDensity('compact')
    s().setModule('tickets')
    const raw = window.localStorage.getItem('labs-curator')
    expect(raw).toBeTruthy()
    const persisted = JSON.parse(raw as string).state
    expect(persisted.density).toBe('compact')
    expect(persisted.preferences).toEqual(s().preferences)
    expect(persisted.module).toBeUndefined()
    expect(persisted.toasts).toBeUndefined()
  })

  it('marks NPS done', () => {
    useCuratorStore.getState().markNpsDone()
    expect(useCuratorStore.getState().npsDone).toBe(true)
  })

  it('marks the tour done', () => {
    useCuratorStore.getState().markTourDone()
    expect(useCuratorStore.getState().tourDone).toBe(true)
  })

  it('sets tourOpen without persisting it, but persists tourDone', () => {
    const s = useCuratorStore.getState
    s().markTourDone()
    s().setTourOpen(true)
    expect(s().tourOpen).toBe(true)
    const raw = window.localStorage.getItem('labs-curator')
    const persisted = JSON.parse(raw as string).state
    expect(persisted.tourOpen).toBeUndefined()
    expect(persisted.tourDone).toBe(true)
  })

  it('flips a preference', () => {
    const s = useCuratorStore.getState
    expect(s().preferences.showSpecChips).toBe(true)
    s().setPreference('showSpecChips', false)
    expect(s().preferences.showSpecChips).toBe(false)
  })
})

describe('migratePersisted', () => {
  it('upgrades a v1 state by dropping notifications and injecting default preferences', () => {
    const legacy = {
      density: 'compact',
      notifications: { productUpdates: true },
      pipeline: { ...defaultPipeline() },
      npsDone: true,
    }
    const migrated = migratePersisted(legacy, 1)
    expect(migrated.preferences).toEqual({ showSpecChips: true, reduceMotion: false, showSampleData: true })
    expect(migrated).not.toHaveProperty('notifications')
    expect(migrated.density).toBe('compact')
    expect(migrated.npsDone).toBe(true)
    expect(migrated.pipeline).toEqual(legacy.pipeline)
  })

  it('defaults tourDone to false for a v1 state that predates the tour', () => {
    const legacy = { density: 'compact', pipeline: { ...defaultPipeline() }, npsDone: true }
    const migrated = migratePersisted(legacy, 1)
    expect(migrated.tourDone).toBe(false)
  })

  it('carries tourDone forward for an existing v2 state', () => {
    const existing = {
      density: 'compact',
      preferences: { showSpecChips: true, reduceMotion: false, showSampleData: true },
      pipeline: { ...defaultPipeline() },
      npsDone: true,
      tourDone: true,
    }
    const migrated = migratePersisted(existing, 2)
    expect(migrated.tourDone).toBe(true)
  })

  it('defaults tourDone to false for an existing v2 state that predates the tour key', () => {
    const existing = {
      density: 'compact',
      preferences: { showSpecChips: true, reduceMotion: false, showSampleData: true },
      pipeline: { ...defaultPipeline() },
      npsDone: false,
    }
    const migrated = migratePersisted(existing, 2)
    expect(migrated.tourDone).toBe(false)
  })
})
