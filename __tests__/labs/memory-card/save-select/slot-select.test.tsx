import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'

// next/font/google is compiled away by Next's loader — stub the family strings.
vi.mock('@/components/labs/memory-card/fonts', () => ({
  anton: { className: 'anton', style: { fontFamily: 'Anton' } },
  grotesk: { className: 'grotesk', style: { fontFamily: 'Space Grotesk' } },
  monoFamily: 'monospace',
}))

// Direct action spies — the list fires sounds inside its own handlers.
const blip = vi.fn()
const select = vi.fn()
vi.mock('@/components/labs/memory-card/audio-context', () => ({
  useMemoryCardAudioActions: () => ({
    blip,
    select,
    back: vi.fn(),
    toggleSound: vi.fn(),
    boot: () => false,
  }),
}))

import { SlotSelect } from '@/components/labs/memory-card/save-select/slot-select'
import { buildSaves } from '@/components/labs/memory-card/save-select/saves'
import { projects } from '@/data/projects'

const saves = buildSaves(projects)

function setup(activeIndex = 0) {
  blip.mockClear()
  select.mockClear()
  const onHighlight = vi.fn()
  const onActivate = vi.fn()
  const utils = render(
    <SlotSelect
      saves={saves}
      activeIndex={activeIndex}
      onHighlight={onHighlight}
      onActivate={onActivate}
    />
  )
  // Row buttons only (the active card also renders a LOAD button, excluded here).
  const rows = saves.map((save) =>
    screen.getByRole('button', { name: new RegExp(`^slot ${save.slot}`, 'i') })
  )
  return { ...utils, onHighlight, onActivate, rows }
}

describe('SlotSelect', () => {
  it('is a listbox named "save files" with one row per save (slots 01–06)', () => {
    setup()
    const list = screen.getByRole('list', { name: /save files/i })
    for (const save of saves) {
      expect(
        within(list).getByRole('button', { name: new RegExp(`^slot ${save.slot}`, 'i') })
      ).toBeInTheDocument()
    }
  })

  it('makes exactly the active row focusable, the rest tabIndex -1 (roving)', () => {
    const { rows, container } = setup(2)
    rows.forEach((row, i) => expect(row.tabIndex).toBe(i === 2 ? 0 : -1))
    expect(rows[2]).toHaveAttribute('aria-current', 'true')
    // Mirrors the e2e contract: exactly one literal tabindex=0 in the list — the
    // active row; the expanded card's LOAD button never joins the roving cursor.
    expect(container.querySelectorAll('#save-index button[tabindex="0"]')).toHaveLength(1)
  })

  it('ArrowDown highlights and focuses the next row', () => {
    const { rows, onHighlight } = setup(0)
    rows[0].focus()
    fireEvent.keyDown(rows[0], { key: 'ArrowDown' })
    expect(onHighlight).toHaveBeenCalledWith(1)
    expect(document.activeElement).toBe(rows[1])
  })

  it('ArrowDown wraps from the last row back to the first', () => {
    const { rows, onHighlight } = setup(saves.length - 1)
    rows[saves.length - 1].focus()
    fireEvent.keyDown(rows[saves.length - 1], { key: 'ArrowDown' })
    expect(onHighlight).toHaveBeenCalledWith(0)
    expect(document.activeElement).toBe(rows[0])
  })

  it('ArrowUp wraps from the first row to the last', () => {
    const { rows, onHighlight } = setup(0)
    rows[0].focus()
    fireEvent.keyDown(rows[0], { key: 'ArrowUp' })
    expect(onHighlight).toHaveBeenCalledWith(saves.length - 1)
    expect(document.activeElement).toBe(rows[saves.length - 1])
  })

  it('Home and End jump to the ends', () => {
    const { rows, onHighlight } = setup(2)
    fireEvent.keyDown(rows[2], { key: 'Home' })
    expect(onHighlight).toHaveBeenLastCalledWith(0)
    fireEvent.keyDown(rows[2], { key: 'End' })
    expect(onHighlight).toHaveBeenLastCalledWith(saves.length - 1)
  })

  it('Enter activates the highlighted save (and plays the load sound)', () => {
    const { rows, onActivate } = setup(1)
    fireEvent.keyDown(rows[1], { key: 'Enter' })
    expect(onActivate).toHaveBeenCalledWith(saves[1])
    expect(select).toHaveBeenCalledTimes(1)
  })

  it('activates a system save too (Enter opens its dialog upstream)', () => {
    const systemIndex = saves.findIndex((s) => s.kind !== 'project')
    const { rows, onActivate } = setup(systemIndex)
    fireEvent.keyDown(rows[systemIndex], { key: 'Enter' })
    expect(onActivate).toHaveBeenCalledWith(saves[systemIndex])
    expect(select).toHaveBeenCalledTimes(1)
  })

  it('a click on a non-active row highlights it, never activates', () => {
    const { rows, onHighlight, onActivate } = setup(0)
    fireEvent.click(rows[3])
    expect(onHighlight).toHaveBeenCalledWith(3)
    expect(onActivate).not.toHaveBeenCalled()
  })

  it('a second click — on the already-active row — activates it (touch two-tap)', () => {
    const { rows, onActivate } = setup(2)
    fireEvent.click(rows[2])
    expect(onActivate).toHaveBeenCalledWith(saves[2])
  })

  it('the active row expands with a LOAD control naming its slot and title', () => {
    setup(0)
    const load = screen.getByRole('button', { name: /load slot 01/i })
    expect(load).toHaveAccessibleName(/amio bank ibank/i)
  })

  it('renders titles in true casing — iBank intact, system slots title-cased (casing law)', () => {
    setup(0)
    // Product name survives with no uppercase transform.
    expect(screen.getByRole('button', { name: /^slot 01/i })).toHaveTextContent('AMIO Bank iBank')
    // System labels render as true-cased titles, not the lowercase data copy.
    expect(screen.getByRole('button', { name: /^slot 04/i })).toHaveTextContent('System Data')
    expect(screen.getByRole('button', { name: /^slot 06/i })).toHaveTextContent('Save?')
  })

  it('shows the active project story and its stats in the expanded card', () => {
    setup(0)
    // The one-line story (folded from the old story band) plus a metric stat
    // (phrase unique to the stat grid — not echoed in the description).
    expect(screen.getByText(/internet banking platform/i)).toBeInTheDocument()
    expect(screen.getByText(/ongoing development/i)).toBeInTheDocument()
  })

  it('never renders a lead title (claims law)', () => {
    const { container } = setup(0)
    expect(container.textContent).not.toMatch(/lead/i)
  })
})
