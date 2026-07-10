import { useCuratorStore } from '@/components/labs/curator/store'
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
    expect(persisted.module).toBeUndefined()
    expect(persisted.toasts).toBeUndefined()
  })

  it('marks NPS done', () => {
    useCuratorStore.getState().markNpsDone()
    expect(useCuratorStore.getState().npsDone).toBe(true)
  })
})
