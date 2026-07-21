import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import {
  PlanetLoader,
  SW_LOADER_MAX_WAIT_MS,
  SW_LOADER_MIN_HOLD_MS,
  SW_LOADER_REVEAL_MS,
} from '@/components/labs/small-world/loader/planet-loader'
import { PALETTE } from '@/components/labs/small-world/palette'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

const root = () => document.querySelector('[data-sw-loader]') as HTMLElement | null

describe('PlanetLoader', () => {
  it('holds with the charming caption and a themed, palette-driven backdrop', () => {
    render(<PlanetLoader ready={false} progress={20} />)
    expect(screen.getByText(/rolling up a small world/i)).toBeInTheDocument()
    const el = root()
    expect(el).toBeTruthy()
    expect(el?.getAttribute('data-phase')).toBe('holding')
    // No corporate "Loading…" copy.
    expect(screen.queryByText(/^loading/i)).toBeNull()
    // Palette is the source of truth: tokens are handed to CSS as custom props.
    expect(el?.style.getPropertyValue('--swl-leaf')).toBe(PALETTE.leaf)
    expect(el?.style.getPropertyValue('--swl-clay')).toBe(PALETTE.clayPath)
    expect(el?.style.getPropertyValue('--swl-sky')).toBe(PALETTE.sky)
  })

  it('drives the ring from progress, but only completes (100) once ready', () => {
    const { rerender } = render(<PlanetLoader ready={false} progress={37} />)
    expect(root()?.style.getPropertyValue('--swl-progress')).toBe('37')
    // Never shows a full ring until the scene actually takes over.
    rerender(<PlanetLoader ready={false} progress={100} />)
    expect(root()?.style.getPropertyValue('--swl-progress')).toBe('99')
    rerender(<PlanetLoader ready progress={100} />)
    expect(root()?.style.getPropertyValue('--swl-progress')).toBe('100')
  })

  it('holds the minimum, then reveals and unmounts once ready', () => {
    const { rerender } = render(<PlanetLoader ready={false} progress={0} />)
    rerender(<PlanetLoader ready progress={100} />)
    act(() => vi.advanceTimersByTime(SW_LOADER_MIN_HOLD_MS - 1))
    expect(root()?.getAttribute('data-phase')).toBe('holding')
    act(() => vi.advanceTimersByTime(1))
    expect(root()?.getAttribute('data-phase')).toBe('revealing')
    act(() => vi.advanceTimersByTime(SW_LOADER_REVEAL_MS))
    expect(root()).toBeNull()
  })

  it('gives up waiting at the failsafe and reveals anyway', () => {
    render(<PlanetLoader ready={false} progress={10} />)
    act(() => vi.advanceTimersByTime(SW_LOADER_MAX_WAIT_MS))
    expect(root()?.getAttribute('data-phase')).toBe('revealing')
  })
})
