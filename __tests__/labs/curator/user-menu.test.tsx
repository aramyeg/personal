import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { AppShell } from '@/components/labs/curator/app-shell'

const refresh = vi.fn()
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh }) }))

const EMAIL = 'operator@curator.app'

function renderShell() {
  return render(<AppShell email={EMAIL}>{<div />}</AppShell>)
}

function trigger() {
  return screen.getByRole('button', { name: /aram yeghiazaryan/i })
}

describe('AppShell user menu', () => {
  beforeEach(() => {
    refresh.mockClear()
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 })))
  })
  afterEach(() => vi.unstubAllGlobals())

  it('opens on trigger click and closes on re-click', () => {
    renderShell()
    expect(screen.queryByText(EMAIL)).not.toBeInTheDocument()
    fireEvent.click(trigger())
    expect(screen.getByText(EMAIL)).toBeInTheDocument()
    fireEvent.click(trigger())
    expect(screen.queryByText(EMAIL)).not.toBeInTheDocument()
  })

  it('closes on Escape and marks the event defaultPrevented', () => {
    renderShell()
    fireEvent.click(trigger())
    expect(screen.getByText(EMAIL)).toBeInTheDocument()
    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    fireEvent(document.body, escape)
    expect(escape.defaultPrevented).toBe(true)
    expect(screen.queryByText(EMAIL)).not.toBeInTheDocument()
  })

  it('closes on pointerdown outside the menu', () => {
    renderShell()
    fireEvent.click(trigger())
    expect(screen.getByText(EMAIL)).toBeInTheDocument()
    fireEvent.pointerDown(document.body)
    expect(screen.queryByText(EMAIL)).not.toBeInTheDocument()
  })

  it('Sign out DELETEs the session then refreshes the router', async () => {
    renderShell()
    fireEvent.click(trigger())
    fireEvent.click(screen.getByRole('button', { name: /^sign out$/i }))
    await waitFor(() => expect(refresh).toHaveBeenCalled())
    expect(fetch).toHaveBeenCalledWith('/api/labs/curator/session', expect.objectContaining({ method: 'DELETE' }))
  })
})
