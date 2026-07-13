import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import OverviewModule from '@/components/labs/curator/modules/overview'
import { useCuratorStore } from '@/components/labs/curator/store'

const initial = useCuratorStore.getState()
beforeEach(() => useCuratorStore.setState(initial, true))

describe('OverviewModule', () => {
  it('shows sample-data captions by default', () => {
    render(<OverviewModule />)
    expect(screen.getAllByText('Sample data').length).toBeGreaterThan(0)
  })

  it('hides sample data and shows the pending state when the preference is off', () => {
    useCuratorStore.setState((s) => ({ preferences: { ...s.preferences, showSampleData: false } }))
    render(<OverviewModule />)
    expect(screen.queryByText('Sample data')).not.toBeInTheDocument()
    expect(screen.getByText(/Analytics integration pending/)).toBeInTheDocument()
    expect(screen.getByText('Capability Utilization')).toBeInTheDocument()
  })
})
