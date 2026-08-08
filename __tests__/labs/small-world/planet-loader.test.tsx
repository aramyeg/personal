import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, render, screen } from '@testing-library/react'
import {
  PlanetLoader,
  SW_LOADER_BYTE_ARC,
  SW_LOADER_MAX_WAIT_MS,
  SW_LOADER_MIN_HOLD_MS,
  SW_LOADER_REVEAL_MS,
} from '@/components/labs/small-world/loader/planet-loader'
import { PALETTE } from '@/components/labs/small-world/palette'

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

const root = () => document.querySelector('[data-sw-loader]') as HTMLElement | null

describe('PlanetLoader', () => {
  it('holds with the colouring-stage chip and a palette-driven paper plate', () => {
    render(<PlanetLoader ready={false} progress={20} />)
    expect(screen.getByText('colouring her world')).toBeInTheDocument()
    const el = root()
    expect(el).toBeTruthy()
    expect(el?.getAttribute('data-phase')).toBe('holding')
    // No corporate "Loading…" copy.
    expect(screen.queryByText(/^loading/i)).toBeNull()
    // Palette is the source of truth: tokens are handed to CSS as custom props.
    expect(el?.style.getPropertyValue('--swl-ink')).toBe(PALETTE.ink)
    expect(el?.style.getPropertyValue('--swl-clay')).toBe(PALETTE.clayPath)
    expect(el?.style.getPropertyValue('--swl-paper')).toBe(PALETTE.pagePaper)
  })

  it('maps byte progress onto the 88-arc, completing (100) only once ready', () => {
    const { rerender } = render(<PlanetLoader ready={false} progress={37} />)
    expect(root()?.style.getPropertyValue('--swl-progress')).toBe(
      String(Math.round((37 * SW_LOADER_BYTE_ARC) / 100))
    )
    // Fully-fetched bytes still stop at the byte arc: the last stretch of the
    // lap belongs to parse/bake and only `ready` closes it.
    rerender(<PlanetLoader ready={false} progress={100} />)
    expect(root()?.style.getPropertyValue('--swl-progress')).toBe(String(SW_LOADER_BYTE_ARC))
    rerender(<PlanetLoader ready progress={100} />)
    expect(root()?.style.getPropertyValue('--swl-progress')).toBe('100')
  })

  it('swaps the chip copy to the clay stage at the top of the byte arc', () => {
    render(<PlanetLoader ready progress={100} />)
    expect(screen.getByText('rolling the clay')).toBeInTheDocument()
    expect(screen.queryByText('colouring her world')).toBeNull()
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

  it('marks the revealing phase on the root (class + data-phase) for the iris exit', () => {
    const { rerender } = render(<PlanetLoader ready={false} progress={0} />)
    rerender(<PlanetLoader ready progress={100} />)
    act(() => vi.advanceTimersByTime(SW_LOADER_MIN_HOLD_MS))
    const el = root()
    expect(el?.getAttribute('data-phase')).toBe('revealing')
    // The revealing class is what flips pointer-events off and opens the iris.
    expect(el?.className).toContain('revealing')
    act(() => vi.advanceTimersByTime(SW_LOADER_REVEAL_MS))
    expect(root()).toBeNull()
  })

  it('gives up waiting at the failsafe and reveals anyway', () => {
    render(<PlanetLoader ready={false} progress={10} />)
    act(() => vi.advanceTimersByTime(SW_LOADER_MAX_WAIT_MS))
    expect(root()?.getAttribute('data-phase')).toBe('revealing')
  })
})
