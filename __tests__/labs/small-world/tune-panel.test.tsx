import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { TunePanel } from '@/components/labs/small-world/overlay/tune-panel'
import { DIALS, DIAL_KEYS, resetDials } from '@/components/labs/small-world/scene/tunables'
import { LOOK_KEYS } from '@/components/labs/small-world/scene/look-table'

beforeEach(() => resetDials())
afterEach(() => {
  vi.useRealTimers()
  resetDials()
})

describe('TunePanel', () => {
  it('renders one range input per declared dial (renders whatever tunables and look-table declare)', () => {
    render(<TunePanel />)
    const sliders = screen.getAllByRole('slider')
    expect(sliders).toHaveLength(DIAL_KEYS.length + LOOK_KEYS.length)
  })

  it('shows the group headers', () => {
    render(<TunePanel />)
    for (const g of ['boil', 'fields', 'dents']) {
      expect(screen.getByText(g)).toBeTruthy()
    }
  })

  it('a slider write updates the shared dial store', () => {
    render(<TunePanel />)
    const sliders = screen.getAllByRole('slider') as HTMLInputElement[]
    // boilAmp is the first dial (a live dial → applies immediately, no fake timers needed)
    fireEvent.change(sliders[0], { target: { value: '0.05' } })
    expect(DIALS.boilAmp.value).toBeCloseTo(0.05, 6)
  })

  it('reset restores the defaults', () => {
    vi.useFakeTimers()
    render(<TunePanel />)
    const sliders = screen.getAllByRole('slider') as HTMLInputElement[]
    fireEvent.change(sliders[0], { target: { value: '0.05' } })
    expect(DIALS.boilAmp.value).toBe(0.05)
    act(() => {
      screen.getByText('reset').click()
    })
    expect(DIALS.boilAmp.value).toBe(DIALS.boilAmp.default)
  })

  it('collapses and expands', () => {
    render(<TunePanel />)
    expect(screen.getAllByRole('slider').length).toBeGreaterThan(0)
    act(() => {
      screen.getByRole('button', { expanded: true }).click()
    })
    expect(screen.queryAllByRole('slider')).toHaveLength(0)
  })
})
