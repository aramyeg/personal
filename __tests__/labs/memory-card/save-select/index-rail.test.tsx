import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

// next/font/google is compiled away by Next's loader — stub the family strings.
vi.mock('@/components/labs/memory-card/fonts', () => ({
  anton: { className: 'anton', style: { fontFamily: 'Anton' } },
  grotesk: { className: 'grotesk', style: { fontFamily: 'Space Grotesk' } },
  monoFamily: 'monospace',
}))

// Direct action spies — the rail fires sounds inside its own handlers.
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

import { IndexRail } from '@/components/labs/memory-card/save-select/index-rail'
import { buildSaves } from '@/components/labs/memory-card/save-select/saves'
import { projects } from '@/data/projects'

const saves = buildSaves(projects)

function setup(activeIndex = 0) {
  blip.mockClear()
  select.mockClear()
  const onHighlight = vi.fn()
  const onActivate = vi.fn()
  const utils = render(
    <IndexRail
      saves={saves}
      activeIndex={activeIndex}
      onHighlight={onHighlight}
      onActivate={onActivate}
    />
  )
  const buttons = screen.getAllByRole('button')
  return { ...utils, onHighlight, onActivate, buttons }
}

describe('IndexRail', () => {
  it('renders one focusable row per save with slot numerals 01–06', () => {
    setup()
    for (const save of saves) {
      expect(screen.getByRole('button', { name: new RegExp(`slot ${save.slot}`, 'i') })).toBeInTheDocument()
    }
  })

  it('makes exactly the active row focusable, the rest tabIndex -1', () => {
    const { buttons } = setup(2)
    expect(buttons).toHaveLength(saves.length)
    buttons.forEach((button, i) => expect(button.tabIndex).toBe(i === 2 ? 0 : -1))
    expect(buttons[2]).toHaveAttribute('aria-current', 'true')
  })

  it('ArrowDown highlights and focuses the next row', () => {
    const { buttons, onHighlight } = setup(0)
    buttons[0].focus()
    fireEvent.keyDown(buttons[0], { key: 'ArrowDown' })
    expect(onHighlight).toHaveBeenCalledWith(1)
    expect(document.activeElement).toBe(buttons[1])
  })

  it('ArrowDown wraps from the last row back to the first', () => {
    const { buttons, onHighlight } = setup(saves.length - 1)
    buttons[saves.length - 1].focus()
    fireEvent.keyDown(buttons[saves.length - 1], { key: 'ArrowDown' })
    expect(onHighlight).toHaveBeenCalledWith(0)
    expect(document.activeElement).toBe(buttons[0])
  })

  it('ArrowUp wraps from the first row to the last', () => {
    const { buttons, onHighlight } = setup(0)
    buttons[0].focus()
    fireEvent.keyDown(buttons[0], { key: 'ArrowUp' })
    expect(onHighlight).toHaveBeenCalledWith(saves.length - 1)
    expect(document.activeElement).toBe(buttons[saves.length - 1])
  })

  it('Enter activates the highlighted save', () => {
    const { buttons, onActivate } = setup(1)
    fireEvent.keyDown(buttons[1], { key: 'Enter' })
    expect(onActivate).toHaveBeenCalledWith(saves[1])
    expect(select).toHaveBeenCalledTimes(1)
  })

  it('plays the load sound when activating a system save (it opens the dialog)', () => {
    const systemIndex = saves.findIndex((s) => s.kind !== 'project')
    const { buttons, onActivate } = setup(systemIndex)
    fireEvent.keyDown(buttons[systemIndex], { key: 'Enter' })
    expect(onActivate).toHaveBeenCalledWith(saves[systemIndex])
    expect(select).toHaveBeenCalledTimes(1)
  })

  it('a click on a non-active row highlights it, never activates', () => {
    const { buttons, onHighlight, onActivate } = setup(0)
    fireEvent.click(buttons[3])
    expect(onHighlight).toHaveBeenCalledWith(3)
    expect(onActivate).not.toHaveBeenCalled()
  })

  it('a second click — on the already-active row — activates it', () => {
    const { buttons, onActivate } = setup(2)
    fireEvent.click(buttons[2])
    expect(onActivate).toHaveBeenCalledWith(saves[2])
  })

  it('blips on a highlight change but not when clicking the already-active row', () => {
    const { buttons } = setup(0)
    fireEvent.keyDown(buttons[0], { key: 'ArrowDown' }) // move → blip
    fireEvent.click(buttons[0]) // active row → activates, no blip
    fireEvent.click(buttons[4]) // non-active row → blip
    expect(blip).toHaveBeenCalledTimes(2)
  })
})
