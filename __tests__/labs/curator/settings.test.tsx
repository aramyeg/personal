import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import SettingsModule from '@/components/labs/curator/modules/settings'
import { useCuratorStore } from '@/components/labs/curator/store'

const initial = useCuratorStore.getState()
beforeEach(() => useCuratorStore.setState(initial, true))

describe('SettingsModule', () => {
  it('switches density through the store', () => {
    render(<SettingsModule />)
    fireEvent.click(screen.getByRole('radio', { name: /compact/i }))
    expect(useCuratorStore.getState().density).toBe('compact')
  })
  it('flips notification switches', () => {
    render(<SettingsModule />)
    const sw = screen.getByRole('switch', { name: /incident alerts/i })
    expect(sw).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(sw)
    expect(useCuratorStore.getState().notifications.incidentAlerts).toBe(true)
  })
  it('renders read-only profile fields', () => {
    render(<SettingsModule />)
    expect(screen.getByDisplayValue('Aram Yeghiazaryan')).toBeDisabled()
  })
})
