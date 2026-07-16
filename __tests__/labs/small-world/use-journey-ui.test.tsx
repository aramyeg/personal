import { describe, expect, it } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useJourneyUi } from '@/components/labs/small-world/overlay/use-journey-ui'

function refOf(value: number) {
  return { current: value }
}

const fireScroll = () => act(() => { window.dispatchEvent(new Event('scroll')) })

describe('useJourneyUi', () => {
  it('starts in chapter 0 with no panel', () => {
    const { result } = renderHook(() => useJourneyUi(refOf(0)))
    expect(result.current).toEqual({ chapter: 0, burst: false, panel: null, ended: false })
  })

  it('reports the burst window', () => {
    const ref = refOf(0)
    const { result } = renderHook(() => useJourneyUi(ref))
    ref.current = 0.1 // chapter 0 local 0.6 — inside [0.55, 0.65)
    fireScroll()
    expect(result.current.burst).toBe(true)
    expect(result.current.panel).toBeNull()
  })

  it('reports the panel window with quantized t', () => {
    const ref = refOf(0)
    const { result } = renderHook(() => useJourneyUi(ref))
    ref.current = 0.8 / 6 // chapter 0 local 0.8 — inside [0.65, 0.95)
    fireScroll()
    expect(result.current.panel).not.toBeNull()
    expect(result.current.panel!.chapter).toBe(0)
    expect(result.current.panel!.t).toBeCloseTo(0.5, 1)
    expect((result.current.panel!.t * 40) % 1).toBeCloseTo(0, 6)
  })

  it('reports the ending', () => {
    const ref = refOf(0)
    const { result } = renderHook(() => useJourneyUi(ref))
    ref.current = 1
    fireScroll()
    expect(result.current.ended).toBe(true)
  })

  it('keeps referential stability when nothing changed', () => {
    const ref = refOf(0.2)
    const { result } = renderHook(() => useJourneyUi(ref))
    const before = result.current
    fireScroll()
    expect(result.current).toBe(before)
  })
})
