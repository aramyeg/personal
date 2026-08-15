import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import TicketsModule from '@/components/labs/curator/modules/tickets'
import { useCuratorStore } from '@/components/labs/curator/store'

const initial = useCuratorStore.getState()
beforeEach(() => useCuratorStore.setState(initial, true))

const fillStep1 = () => {
  fireEvent.change(screen.getByLabelText(/full name/i), { target: { value: 'Jane Recruiter' } })
  fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'jane@corp.com' } })
  fireEvent.click(screen.getByRole('button', { name: /continue/i }))
}

describe('TicketsModule', () => {
  it('blocks step 1 on invalid input', () => {
    render(<TicketsModule />)
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(screen.getByText('Enter your full name.')).toBeInTheDocument()
    expect(screen.queryByLabelText(/message/i)).not.toBeInTheDocument()
  })
  it('advances through details to review with entered data', () => {
    render(<TicketsModule />)
    fillStep1()
    fireEvent.change(screen.getByLabelText(/message/i), { target: { value: 'We would like to discuss a senior frontend role.' } })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    expect(screen.getByText(/review/i)).toBeInTheDocument()
    expect(screen.getByText('Jane Recruiter')).toBeInTheDocument()
  })
  it('submits: toast raised and form resets', () => {
    render(<TicketsModule />)
    fillStep1()
    fireEvent.change(screen.getByLabelText(/message/i), { target: { value: 'We would like to discuss a senior frontend role.' } })
    fireEvent.click(screen.getByRole('button', { name: /continue/i }))
    fireEvent.click(screen.getByRole('button', { name: /submit ticket/i }))
    expect(useCuratorStore.getState().toasts[0].title).toMatch(/^Ticket AY-\d{4} created$/)
    expect(screen.getByLabelText(/full name/i)).toHaveValue('')
  })
  it('supports going back without losing data', () => {
    render(<TicketsModule />)
    fillStep1()
    fireEvent.click(screen.getByRole('button', { name: /back/i }))
    expect(screen.getByLabelText(/full name/i)).toHaveValue('Jane Recruiter')
  })
})
