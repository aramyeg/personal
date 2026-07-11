import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

vi.mock('@/components/labs/memory-card/fonts', () => ({
  anton: { className: 'anton', style: { fontFamily: 'Anton' } },
  grotesk: { className: 'grotesk', style: { fontFamily: 'Space Grotesk' } },
  monoFamily: 'monospace',
}))

// The LOAD button fires the select() blip from its own handler — capture it so
// we can assert it only sounds for saves that actually load.
const select = vi.fn()
vi.mock('@/components/labs/memory-card/audio-context', () => ({
  useMemoryCardAudioActions: () => ({
    blip: vi.fn(),
    select,
    back: vi.fn(),
    toggleSound: vi.fn(),
    boot: () => false,
  }),
}))

import { StoryBand } from '@/components/labs/memory-card/save-select/story-band'
import { buildSaves } from '@/components/labs/memory-card/save-select/saves'
import { projects } from '@/data/projects'

const saves = buildSaves(projects)
const projectSave = saves.find((s) => s.kind === 'project')! // slot 01, AMIO
const countedSave = saves[1] // slot 02, 360dialog — numeric metrics
const bioSave = saves.find((s) => s.kind === 'bio')!
const stackSave = saves.find((s) => s.kind === 'stack')!
const contactSave = saves.find((s) => s.kind === 'contact')!

describe('StoryBand', () => {
  it('tells a project story: title, role/company, and technologies', () => {
    render(<StoryBand save={projectSave} />)
    expect(screen.getByRole('heading', { name: /amio bank ibank/i })).toBeInTheDocument()
    expect(screen.getByText(/senior frontend engineer · xdatagroup/i)).toBeInTheDocument()
    expect(screen.getByText('next.js')).toBeInTheDocument()
    expect(screen.getByText('typescript')).toBeInTheDocument()
  })

  it('renders a numeric metric at its full value on first paint (counter seed)', () => {
    render(<StoryBand save={countedSave} />)
    expect(screen.getByText('50,000')).toBeInTheDocument()
    expect(screen.getByText('businesses')).toBeInTheDocument()
  })

  it('names the active save on the LOAD control', () => {
    render(<StoryBand save={projectSave} />)
    expect(screen.getByRole('button', { name: /load slot 01/i })).toHaveAccessibleName(
      /amio bank ibank/i
    )
  })

  it('shows the bio save as system data with the name and bio line', () => {
    render(<StoryBand save={bioSave} />)
    expect(screen.getByRole('heading', { name: /aram yeghiazaryan/i })).toBeInTheDocument()
    expect(screen.getByText(/senior frontend engineer · yerevan/i)).toBeInTheDocument()
  })

  it('lists the written-with entries for the stack save', () => {
    render(<StoryBand save={stackSave} />)
    expect(screen.getByRole('heading', { name: /written with/i })).toBeInTheDocument()
    expect(screen.getByText('React')).toBeInTheDocument()
    expect(screen.getByText('three.js')).toBeInTheDocument()
  })

  it('renders reachable contact rows for the contact save', () => {
    render(<StoryBand save={contactSave} />)
    const email = screen.getByRole('link', { name: /aramyeg96@gmail.com/i })
    expect(email).toHaveAttribute('href', 'mailto:aramyeg96@gmail.com')
    expect(screen.getByRole('link', { name: /github\.com/i })).toBeInTheDocument()
  })

  it('plays the load sound when the LOAD button fires on a project save', () => {
    select.mockClear()
    render(<StoryBand save={projectSave} onLoad={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /load slot 01/i }))
    expect(select).toHaveBeenCalledTimes(1)
  })

  it('does not play the load sound when the LOAD button fires on a system save', () => {
    select.mockClear()
    render(<StoryBand save={bioSave} onLoad={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /load slot/i }))
    expect(select).not.toHaveBeenCalled()
  })

  it('never renders a lead title (claims law)', () => {
    for (const save of saves) {
      const { container, unmount } = render(<StoryBand save={save} />)
      expect(container.textContent).not.toMatch(/lead/i)
      unmount()
    }
  })
})
