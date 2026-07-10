import { render, screen, waitFor } from '@testing-library/react'
import { ModuleHost } from '@/components/labs/curator/module-host'
import { useCuratorStore } from '@/components/labs/curator/store'

const initial = useCuratorStore.getState()
beforeEach(() => {
  window.history.replaceState(null, '', '/labs/curator')
  useCuratorStore.setState(initial, true)
})

describe('ModuleHost', () => {
  it('renders the overview module by default', async () => {
    render(<ModuleHost />)
    expect(await screen.findByRole('heading', { name: 'Overview' })).toBeInTheDocument()
  })

  it('switches modules from the store and syncs the URL', async () => {
    render(<ModuleHost />)
    useCuratorStore.getState().setModule('pipeline')
    await waitFor(() => expect(window.location.search).toBe('?m=pipeline'))
  })

  it('adopts a valid ?m= on mount and the URL param survives adoption', async () => {
    window.history.replaceState(null, '', '/labs/curator?m=settings')
    render(<ModuleHost />)
    await waitFor(() => expect(useCuratorStore.getState().module).toBe('settings'))
    await waitFor(() => expect(window.location.search).toBe('?m=settings'))
  })

  it('ignores an invalid ?m=', async () => {
    window.history.replaceState(null, '', '/labs/curator?m=finance')
    render(<ModuleHost />)
    await waitFor(() => expect(useCuratorStore.getState().module).toBe('overview'))
  })
})
