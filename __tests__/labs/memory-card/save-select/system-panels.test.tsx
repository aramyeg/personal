import { afterEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

// next/font/google is compiled away by Next's loader — unavailable under
// vitest. Stub the font module with inert style objects.
vi.mock('@/components/labs/memory-card/fonts', () => ({
  anton: { className: 'anton', style: { fontFamily: 'Anton' } },
  grotesk: { className: 'grotesk', style: { fontFamily: 'Space Grotesk' } },
  monoFamily: 'monospace',
}))

// The contact panel's copy rows fire the blip from their own handler; a no-op
// actions context is all the panels need under vitest.
vi.mock('@/components/labs/memory-card/audio-context', () => ({
  useMemoryCardAudioActions: () => ({
    blip: vi.fn(),
    select: vi.fn(),
    back: vi.fn(),
    toggleSound: vi.fn(),
    boot: () => false,
  }),
}))

import { BioPanel } from '@/components/labs/memory-card/panels/bio-panel'
import { StackPanel } from '@/components/labs/memory-card/panels/stack-panel'
import { ContactPanel } from '@/components/labs/memory-card/panels/contact-panel'
import { buildSaves } from '@/components/labs/memory-card/save-select/saves'
import { WRITTEN_WITH } from '@/components/labs/memory-card/lib/written-with'
import { siteConfig } from '@/lib/constants'
import { projects } from '@/data/projects'

const saves = buildSaves(projects)
const bioSave = saves.find((s) => s.kind === 'bio')!
const stackSave = saves.find((s) => s.kind === 'stack')!
const contactSave = saves.find((s) => s.kind === 'contact')!

// jsdom ships neither a clipboard nor execCommand; each clipboard test stubs the
// path it exercises, and this resets both to absent afterwards.
afterEach(() => {
  Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true, writable: true })
  Object.defineProperty(document, 'execCommand', { value: undefined, configurable: true, writable: true })
  vi.restoreAllMocks()
})

describe('BioPanel', () => {
  it('renders the opening bio sentence verbatim from the about section', () => {
    const { container } = render(<BioPanel save={bioSave} />)
    expect(container.textContent).toContain(
      "For the last eight years I've built production applications for banks, messaging platforms, and startups."
    )
  })

  it('names the person in a heading', () => {
    render(<BioPanel save={bioSave} />)
    expect(screen.getByRole('heading', { name: /aram yeghiazaryan/i })).toBeInTheDocument()
  })
})

describe('StackPanel', () => {
  it('lists all seven written-with entries with their names and notes', () => {
    render(<StackPanel save={stackSave} />)
    expect(WRITTEN_WITH).toHaveLength(7)
    for (const entry of WRITTEN_WITH) {
      expect(screen.getByText(entry.name)).toBeInTheDocument()
      expect(screen.getByText(entry.note)).toBeInTheDocument()
    }
  })
})

describe('ContactPanel', () => {
  it('frames itself as a save-progress confirm dialog', () => {
    render(<ContactPanel save={contactSave} onClose={vi.fn()} />)
    expect(screen.getByRole('heading', { name: /save your progress/i })).toBeInTheDocument()
  })

  it('offers a mailto CTA as the yes option', () => {
    render(<ContactPanel save={contactSave} onClose={vi.fn()} />)
    const yes = screen.getByRole('link', { name: /yes/i })
    expect(yes).toHaveAttribute('href', `mailto:${siteConfig.email}`)
  })

  it('closes the dialog when the no option is chosen', () => {
    const onClose = vi.fn()
    render(<ContactPanel save={contactSave} onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: /no/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('renders three copy rows — email, github, linkedin', () => {
    render(<ContactPanel save={contactSave} onClose={vi.fn()} />)
    expect(screen.getByRole('button', { name: /copy email/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /copy github/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /copy linkedin/i })).toBeInTheDocument()
  })

  it('copies a row value via the clipboard API and flips the button to copied', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      value: { writeText },
      configurable: true,
    })
    render(<ContactPanel save={contactSave} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /copy email/i }))
    expect(await screen.findByText('copied')).toBeInTheDocument()
    expect(writeText).toHaveBeenCalledWith(siteConfig.email)
  })

  it('falls back to execCommand when the clipboard API is unavailable', async () => {
    Object.defineProperty(navigator, 'clipboard', { value: undefined, configurable: true })
    const exec = vi.fn().mockReturnValue(true)
    Object.defineProperty(document, 'execCommand', { value: exec, configurable: true, writable: true })
    render(<ContactPanel save={contactSave} onClose={vi.fn()} />)
    fireEvent.click(screen.getByRole('button', { name: /copy email/i }))
    expect(await screen.findByText('copied')).toBeInTheDocument()
    expect(exec).toHaveBeenCalledWith('copy')
  })
})

describe('system panels — character-agnostic law', () => {
  const GENDERED = /\b(she|her|hers)\b/i

  it('renders no gendered pronouns in the bio panel', () => {
    const { container } = render(<BioPanel save={bioSave} />)
    expect(container.textContent).not.toMatch(GENDERED)
  })

  it('renders no gendered pronouns in the stack panel', () => {
    const { container } = render(<StackPanel save={stackSave} />)
    expect(container.textContent).not.toMatch(GENDERED)
  })

  it('renders no gendered pronouns in the contact panel', () => {
    const { container } = render(<ContactPanel save={contactSave} onClose={vi.fn()} />)
    expect(container.textContent).not.toMatch(GENDERED)
  })
})

describe('system panels — claims law', () => {
  it('never renders a lead title in any system panel', () => {
    const { container: bio, unmount: u1 } = render(<BioPanel save={bioSave} />)
    expect(bio.textContent).not.toMatch(/lead/i)
    u1()
    const { container: stack, unmount: u2 } = render(<StackPanel save={stackSave} />)
    expect(stack.textContent).not.toMatch(/lead/i)
    u2()
    const { container: contact, unmount: u3 } = render(
      <ContactPanel save={contactSave} onClose={vi.fn()} />
    )
    expect(contact.textContent).not.toMatch(/lead/i)
    u3()
  })
})
