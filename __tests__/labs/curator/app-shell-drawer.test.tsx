import { act, render, screen, fireEvent, within } from '@testing-library/react'
import { AppShell } from '@/components/labs/curator/app-shell'
import { useCuratorStore } from '@/components/labs/curator/store'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

const initial = useCuratorStore.getState()
beforeEach(() => {
  useCuratorStore.setState(initial, true)
})

function renderShell() {
  return render(
    <AppShell email="operator@curator.app">
      <div />
    </AppShell>,
  )
}

describe('AppShell mobile drawer', () => {
  it('is closed by default and opens on hamburger click', () => {
    renderShell()
    expect(screen.queryByRole('dialog', { name: 'Navigation' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }))

    const dialog = screen.getByRole('dialog', { name: 'Navigation' })
    expect(dialog).toBeInTheDocument()
    expect(useCuratorStore.getState().sidebarOpen).toBe(true)
  })

  it('selecting a module in the drawer sets the store module and closes the drawer', () => {
    renderShell()
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }))
    const dialog = screen.getByRole('dialog', { name: 'Navigation' })

    fireEvent.click(within(dialog).getByRole('button', { name: 'Rooms' }))

    expect(useCuratorStore.getState().module).toBe('rooms')
    expect(useCuratorStore.getState().sidebarOpen).toBe(false)
    expect(screen.queryByRole('dialog', { name: 'Navigation' })).not.toBeInTheDocument()
  })

  it('Escape closes the drawer and marks the event defaultPrevented', () => {
    renderShell()
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }))
    expect(screen.getByRole('dialog', { name: 'Navigation' })).toBeInTheDocument()

    const escape = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    fireEvent(document.body, escape)

    expect(escape.defaultPrevented).toBe(true)
    expect(useCuratorStore.getState().sidebarOpen).toBe(false)
    expect(screen.queryByRole('dialog', { name: 'Navigation' })).not.toBeInTheDocument()
  })

  it('backdrop pointerdown closes the drawer', () => {
    renderShell()
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }))
    const dialog = screen.getByRole('dialog', { name: 'Navigation' })

    fireEvent.pointerDown(dialog)

    expect(useCuratorStore.getState().sidebarOpen).toBe(false)
    expect(screen.queryByRole('dialog', { name: 'Navigation' })).not.toBeInTheDocument()
  })

  it('pointerdown inside the drawer panel does not close it', () => {
    renderShell()
    fireEvent.click(screen.getByRole('button', { name: 'Open navigation' }))
    const dialog = screen.getByRole('dialog', { name: 'Navigation' })

    fireEvent.pointerDown(within(dialog).getByRole('button', { name: 'Rooms' }))

    expect(useCuratorStore.getState().sidebarOpen).toBe(true)
    expect(screen.getByRole('dialog', { name: 'Navigation' })).toBeInTheDocument()
  })

  it('wraps store mutation from an external setSidebarOpen(true) call without act warnings', () => {
    renderShell()
    act(() => useCuratorStore.getState().setSidebarOpen(true))
    expect(screen.getByRole('dialog', { name: 'Navigation' })).toBeInTheDocument()
  })
})
