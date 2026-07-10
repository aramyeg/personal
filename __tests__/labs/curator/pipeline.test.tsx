import { render, screen, within } from '@testing-library/react'
import PipelineModule from '@/components/labs/curator/modules/pipeline'
import { useCuratorStore } from '@/components/labs/curator/store'
import { OPEN_DEAL_ID } from '@/components/labs/curator/adapters'
import { experiences } from '@/data/experience'

const initial = useCuratorStore.getState()
beforeEach(() => useCuratorStore.setState(initial, true))

describe('PipelineModule', () => {
  it('renders four columns with counts', () => {
    render(<PipelineModule />)
    const closedWon = screen.getByTestId('column-closed-won')
    expect(within(closedWon).getAllByTestId('deal-card')).toHaveLength(experiences.length)
    expect(within(screen.getByTestId('column-sourced')).getByText('Your Company')).toBeInTheDocument()
  })
  it('reflects store moves', () => {
    useCuratorStore.getState().movePipelineCard(OPEN_DEAL_ID, 'offer', 0)
    render(<PipelineModule />)
    expect(within(screen.getByTestId('column-offer')).getByText('Your Company')).toBeInTheDocument()
  })
  it('renders tenure as the deal value on won cards', () => {
    render(<PipelineModule />)
    const closedWon = screen.getByTestId('column-closed-won')
    expect(within(closedWon).getAllByText(/\d+ mo/).length).toBeGreaterThan(0)
  })
  it('renders an em-dash win rate when closed-won is empty', () => {
    const { pipeline, movePipelineCard } = useCuratorStore.getState()
    for (const id of [...pipeline['closed-won']]) movePipelineCard(id, 'sourced', 0)
    render(<PipelineModule />)
    expect(screen.getByText(/win rate —/)).toBeInTheDocument()
    expect(screen.queryByText(/NaN/)).toBeNull()
  })
})
