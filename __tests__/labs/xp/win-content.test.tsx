import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WinAbout } from '@/components/labs/xp/win-about'
import { WinResume } from '@/components/labs/xp/win-resume'
import { useXpStore, type XpWindow } from '@/components/labs/xp/store'
import { WinProjects } from '@/components/labs/xp/win-projects'
import { WinProjectDetail } from '@/components/labs/xp/win-project-detail'
import { WinMyComputer } from '@/components/labs/xp/win-my-computer'
import { experiences, projects } from '@/data'

beforeEach(() => useXpStore.setState({ windows: [], chaos: 'idle', startOpen: false, activeId: null }))

const fakeWin: XpWindow = { id: 'x', app: 'about', title: 't', x: 0, y: 0, w: 100, h: 100, z: 1, minimized: false, maximized: false }

describe('notepad + wordpad', () => {
  it('notepad shows the bio with the correct role', () => {
    render(<WinAbout />)
    expect(screen.getByText(/Senior Frontend Engineer/)).toBeInTheDocument()
    expect(screen.queryByText(/lead/i)).toBeNull()
  })

  it('wordpad renders every experience entry', () => {
    render(<WinResume />)
    for (const e of experiences) {
      expect(screen.getByText(new RegExp(e.company))).toBeInTheDocument()
    }
  })
})

describe('explorer windows', () => {
  it('lists every project as a folder; double-click opens a detail window', () => {
    render(<WinProjects />)
    for (const p of projects) expect(screen.getByText(p.title)).toBeInTheDocument()
    fireEvent.doubleClick(screen.getByText(projects[0].title))
    expect(useXpStore.getState().windows.some((w) => w.id === `project-detail:${projects[0].id}`)).toBe(true)
  })

  it('project detail renders the project for win.param', () => {
    const p = projects[0]
    render(<WinProjectDetail win={{ ...fakeWin, app: 'project-detail', param: p.id }} />)
    expect(screen.getByText(new RegExp(p.role))).toBeInTheDocument()
    for (const t of p.technologies) expect(screen.getByText(t)).toBeInTheDocument()
  })

  it('my computer opens shortcuts', () => {
    render(<WinMyComputer />)
    fireEvent.doubleClick(screen.getByText('Add or Remove Programs'))
    expect(useXpStore.getState().windows.some((w) => w.app === 'add-remove')).toBe(true)
  })
})
