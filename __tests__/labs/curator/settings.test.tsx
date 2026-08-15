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
  it('re-rows the density preview when compact is selected', () => {
    const { container } = render(<SettingsModule />)
    expect(container.querySelector('table[aria-hidden] td.py-1\\.5')).toBeNull()
    fireEvent.click(screen.getByRole('radio', { name: /compact/i }))
    expect(container.querySelector('table[aria-hidden] td.py-1\\.5')).not.toBeNull()
  })
  it('flips the "Engineering annotations" preference switch', () => {
    render(<SettingsModule />)
    const sw = screen.getByRole('switch', { name: /engineering annotations/i })
    expect(sw).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(sw)
    expect(useCuratorStore.getState().preferences.showSpecChips).toBe(false)
  })
  it('flips the "Reduce motion" preference switch', () => {
    render(<SettingsModule />)
    const sw = screen.getByRole('switch', { name: /reduce motion/i })
    expect(sw).toHaveAttribute('aria-checked', 'false')
    fireEvent.click(sw)
    expect(useCuratorStore.getState().preferences.reduceMotion).toBe(true)
  })
  it('flips the "Sample data" preference switch', () => {
    render(<SettingsModule />)
    const sw = screen.getByRole('switch', { name: /sample data/i })
    expect(sw).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(sw)
    expect(useCuratorStore.getState().preferences.showSampleData).toBe(false)
  })
  it('renders read-only profile fields', () => {
    render(<SettingsModule />)
    expect(screen.getByDisplayValue('Aram Yeghiazaryan')).toBeDisabled()
  })
})
