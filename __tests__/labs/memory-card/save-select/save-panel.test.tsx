import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, within } from '@testing-library/react'

// next/font/google is compiled away by Next's loader — unavailable under
// vitest. Stub the font module with inert style objects.
vi.mock('@/components/labs/memory-card/fonts', () => ({
  anton: { className: 'anton', style: { fontFamily: 'Anton' } },
  grotesk: { className: 'grotesk', style: { fontFamily: 'Space Grotesk' } },
  monoFamily: 'monospace',
}))

// The panel's CRT head needs a WebGL context jsdom can't provide. Swap the
// shared canvas and the CRT vignette for inert nodes so the panel renders its
// real DOM; the CRT stub echoes its `lines` so we can assert they come from
// project data.
vi.mock('@/components/labs/memory-card/three/stage', () => ({
  VignetteCanvas: ({ children }: { children: ReactNode }) => (
    <div data-testid="vignette-canvas">{children}</div>
  ),
}))
vi.mock('@/components/labs/memory-card/three/crt-vignette', () => ({
  CrtVignette: ({ lines }: { lines: string[] }) => (
    <div data-testid="crt-vignette" data-lines={lines.join('|')} />
  ),
}))

import { SavePanel } from '@/components/labs/memory-card/panels/save-panel'
import { PanelShell } from '@/components/labs/memory-card/panels/panel-shell'
import { projects } from '@/data/projects'

// amio-bank carries a link; snb-mobile does not — the two shapes the panel must
// handle.
const linked = projects.find((p) => p.link)!
const unlinked = projects.find((p) => !p.link)!

describe('SavePanel', () => {
  it('renders the project title as a heading', () => {
    render(<SavePanel project={linked} />)
    expect(
      screen.getByRole('heading', { name: new RegExp(linked.title, 'i') })
    ).toBeInTheDocument()
  })

  it('renders the role and company', () => {
    render(<SavePanel project={linked} />)
    expect(screen.getByText(new RegExp(linked.role))).toBeInTheDocument()
    expect(screen.getByText(/xDataGroup/)).toBeInTheDocument()
  })

  it('renders the year', () => {
    render(<SavePanel project={linked} />)
    expect(screen.getByText(new RegExp(linked.year))).toBeInTheDocument()
  })

  it('renders the longDescription verbatim', () => {
    render(<SavePanel project={linked} />)
    expect(screen.getByText(linked.longDescription!)).toBeInTheDocument()
  })

  it('renders every metric as a list entry, each with a › tick', () => {
    render(<SavePanel project={linked} />)
    const list = screen.getByRole('list', { name: /save data/i })
    for (const metric of linked.metrics!) {
      expect(within(list).getByText(metric)).toBeInTheDocument()
    }
    expect(within(list).getAllByText('›')).toHaveLength(linked.metrics!.length)
  })

  it('renders every technology', () => {
    render(<SavePanel project={linked} />)
    for (const tech of linked.technologies) {
      expect(screen.getByText(tech)).toBeInTheDocument()
    }
  })

  it('renders an external link to project.link when present', () => {
    render(<SavePanel project={linked} />)
    const link = screen.getByRole('link', { name: /open project|visit/i })
    expect(link).toHaveAttribute('href', linked.link)
    expect(link).toHaveAttribute('target', '_blank')
    expect(link.getAttribute('rel')).toContain('noopener')
  })

  it('omits the external link when project.link is absent', () => {
    render(<SavePanel project={unlinked} />)
    expect(screen.queryByRole('link', { name: /open project|visit/i })).toBeNull()
  })

  it('feeds the CRT head uppercase ticker lines drawn from project data', () => {
    render(<SavePanel project={linked} />)
    const lines = screen.getByTestId('crt-vignette').getAttribute('data-lines') ?? ''
    expect(lines).toContain(linked.title.toUpperCase())
    expect(lines).toContain(linked.year.toUpperCase())
    expect(lines).toContain(linked.technologies[0].toUpperCase())
  })

  it('never renders a lead title for any project (claims law)', () => {
    for (const project of projects) {
      const { container, unmount } = render(<SavePanel project={project} />)
      expect(container.textContent).not.toMatch(/lead/i)
      unmount()
    }
  })

  it('promotes the title to an h1 in standalone mode', () => {
    render(<SavePanel project={linked} standalone />)
    expect(
      screen.getByRole('heading', { level: 1, name: new RegExp(linked.title, 'i') })
    ).toBeInTheDocument()
  })
})

describe('PanelShell', () => {
  it('focuses the close button on mount', () => {
    render(
      <PanelShell title="amio bank ibank" onClose={() => {}}>
        <button type="button">alpha</button>
      </PanelShell>
    )
    expect(document.activeElement).toBe(screen.getByRole('button', { name: /close/i }))
  })

  it('traps Tab within the panel — the ends wrap to each other', () => {
    render(
      <PanelShell title="t" onClose={() => {}}>
        <button type="button">alpha</button>
        <button type="button">beta</button>
      </PanelShell>
    )
    const close = screen.getByRole('button', { name: /close/i })
    const beta = screen.getByRole('button', { name: 'beta' })
    const dialog = screen.getByRole('dialog')

    // Close is the first focusable, beta the last. Shift+Tab from the first
    // wraps to the last; Tab from the last wraps back to the first.
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(beta)

    fireEvent.keyDown(dialog, { key: 'Tab' })
    expect(document.activeElement).toBe(close)
  })

  it('Escape calls onClose and stops propagation (owns Esc while open)', () => {
    const onClose = vi.fn()
    const parentKeyDown = vi.fn()
    render(
      <div onKeyDown={parentKeyDown}>
        <PanelShell title="t" onClose={onClose}>
          <button type="button">x</button>
        </PanelShell>
      </div>
    )
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' })
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(parentKeyDown).not.toHaveBeenCalled()
  })

  it('owns Escape even after focus leaves the dialog to <body> (no leak to a window listener)', () => {
    const onClose = vi.fn()
    // Mirrors GalleryChrome's window-level Escape→/labs listener (bubble phase).
    const galleryLikeWindowListener = vi.fn()
    window.addEventListener('keydown', galleryLikeWindowListener)
    try {
      render(
        <PanelShell title="t" onClose={onClose}>
          <button type="button">x</button>
        </PanelShell>
      )
      // A click on non-interactive panel content blurs focus to <body>; Escape
      // from there must still close the panel and never reach the window listener.
      const evt = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
      document.body.dispatchEvent(evt)
      expect(onClose).toHaveBeenCalledTimes(1)
      expect(galleryLikeWindowListener).not.toHaveBeenCalled()
      expect(evt.defaultPrevented).toBe(true)
    } finally {
      window.removeEventListener('keydown', galleryLikeWindowListener)
    }
  })

  it('the close button calls onClose', () => {
    const onClose = vi.fn()
    render(
      <PanelShell title="t" onClose={onClose}>
        <button type="button">x</button>
      </PanelShell>
    )
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('exposes the title as the dialog accessible name', () => {
    render(
      <PanelShell title="amio bank ibank" onClose={() => {}}>
        <button type="button">x</button>
      </PanelShell>
    )
    expect(screen.getByRole('dialog', { name: /amio bank ibank/i })).toBeInTheDocument()
  })
})
