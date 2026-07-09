import React from 'react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import { PanelShell } from '@/components/labs/ps1/panels/panel-shell'
import { MenuPanel } from '@/components/labs/ps1/panels/menu-panel'
import { ProjectsPanel } from '@/components/labs/ps1/panels/projects-panel'
import { SkillsPanel } from '@/components/labs/ps1/panels/skills-panel'
import { LabsPanel } from '@/components/labs/ps1/panels/labs-panel'
import { projects } from '@/data/projects'
import { skills } from '@/data/skills'
import { labs } from '@/lib/labs-manifest'

afterEach(cleanup)

describe('PanelShell', () => {
  it('focuses the close button on mount and traps Tab within the panel', () => {
    render(
      <PanelShell title="test" onClose={() => {}}>
        <button type="button">alpha</button>
        <button type="button">beta</button>
      </PanelShell>
    )
    const close = screen.getByRole('button', { name: /close/i })
    const beta = screen.getByRole('button', { name: 'beta' })
    const dialog = screen.getByRole('dialog')

    // Focus lands on the close button when the panel mounts.
    expect(document.activeElement).toBe(close)

    // Shift+Tab from the first focusable wraps to the last one still inside.
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(beta)

    // Tab from the last focusable wraps back to the first.
    fireEvent.keyDown(dialog, { key: 'Tab' })
    expect(document.activeElement).toBe(close)
  })

  it('calls onClose when the close button is clicked', () => {
    const onClose = vi.fn()
    render(
      <PanelShell title="test" onClose={onClose}>
        <button type="button">x</button>
      </PanelShell>
    )
    fireEvent.click(screen.getByRole('button', { name: /close/i }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })
})

describe('MenuPanel', () => {
  it('calls onNavigate with the chosen panel id', () => {
    const onNavigate = vi.fn()
    render(<MenuPanel onClose={() => {}} onNavigate={onNavigate} />)
    fireEvent.click(screen.getByRole('button', { name: /projects/i }))
    expect(onNavigate).toHaveBeenCalledWith('projects')
  })
})

describe('ProjectsPanel', () => {
  it('renders every project from data/projects as a save slot', () => {
    render(<ProjectsPanel onClose={() => {}} />)
    for (const project of projects) {
      expect(screen.getByText(project.title)).toBeInTheDocument()
    }
  })
})

describe('SkillsPanel', () => {
  it('renders every skill name from data/skills', () => {
    render(<SkillsPanel onClose={() => {}} />)
    for (const skill of skills) {
      expect(screen.getByText(skill.name)).toBeInTheDocument()
    }
  })
})

describe('LabsPanel', () => {
  it('lists every manifest entry and flags the attic entry', () => {
    render(<LabsPanel onClose={() => {}} />)
    for (const lab of labs) {
      expect(screen.getByText(lab.title)).toBeInTheDocument()
    }
    expect(screen.getByText(/retired to the attic/i)).toBeInTheDocument()
  })
})
