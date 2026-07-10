import { render, screen, fireEvent } from '@testing-library/react'
import { AppShell } from '@/components/labs/curator/app-shell'
import { useCuratorStore } from '@/components/labs/curator/store'

vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: vi.fn() }) }))

const initial = useCuratorStore.getState()
beforeEach(() => {
  useCuratorStore.setState(initial, true)
})

describe('AppShell nav', () => {
  it('clicking a nav item sets the store module and moves aria-current', () => {
    render(
      <AppShell email="operator@curator.app">
        <div />
      </AppShell>,
    )
    const overview = screen.getByRole('button', { name: 'Overview' })
    const pipeline = screen.getByRole('button', { name: 'Pipeline' })
    expect(overview).toHaveAttribute('aria-current', 'page')
    expect(pipeline).not.toHaveAttribute('aria-current')

    fireEvent.click(pipeline)
    expect(useCuratorStore.getState().module).toBe('pipeline')
    expect(pipeline).toHaveAttribute('aria-current', 'page')
    expect(overview).not.toHaveAttribute('aria-current')
  })
})
