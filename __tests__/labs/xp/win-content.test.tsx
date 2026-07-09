import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { WinAbout } from '@/components/labs/xp/win-about'
import { WinResume } from '@/components/labs/xp/win-resume'
import { useXpStore, type XpWindow } from '@/components/labs/xp/store'
import { WinProjects } from '@/components/labs/xp/win-projects'
import { WinProjectDetail } from '@/components/labs/xp/win-project-detail'
import { WinMyComputer } from '@/components/labs/xp/win-my-computer'
import { experiences, projects } from '@/data'
import { WinAddRemove, sizeOnDisk } from '@/components/labs/xp/win-add-remove'
import { WinRecycleBin } from '@/components/labs/xp/win-recycle-bin'
import { atticLabs } from '@/lib/labs-manifest'
import { skills } from '@/data'
import { WinMessenger } from '@/components/labs/xp/win-messenger'
import { WinIE } from '@/components/labs/xp/win-ie'
import { socialLinks } from '@/lib/constants'

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

describe('add or remove programs', () => {
  it('sizeOnDisk scales with years and level', () => {
    expect(sizeOnDisk({ name: 'x', years: 8, category: 'frontend', level: 'expert' })).toBe('1.00 GB')
    expect(sizeOnDisk({ name: 'x', years: 2, category: 'tools', level: 'intermediate' })).toBe('64 MB')
  })

  it('lists every skill as an installed program', () => {
    render(<WinAddRemove />)
    for (const s of skills.slice(0, 5)) expect(screen.getByText(s.name)).toBeInTheDocument()
  })
})

describe('recycle bin', () => {
  it('shows retired labs with retrospectives and a restore link', () => {
    render(<WinRecycleBin />)
    for (const lab of atticLabs) {
      expect(screen.getByText(lab.title)).toBeInTheDocument()
      expect(screen.getByRole('link', { name: `Restore ${lab.title}` })).toHaveAttribute('href', lab.href ?? `/labs/${lab.slug}`)
    }
  })
})

describe('messenger + ie', () => {
  it('messenger renders contact links and a nudge', () => {
    render(<WinMessenger />)
    expect(screen.getByRole('link', { name: /aramyeg96@gmail.com/ })).toHaveAttribute('href', 'mailto:aramyeg96@gmail.com')
    for (const l of socialLinks) expect(screen.getByRole('link', { name: l.name })).toHaveAttribute('href', l.url)
    expect(screen.getByRole('button', { name: 'Send nudge' })).toBeInTheDocument()
  })

  it('ie frames the main site', () => {
    render(<WinIE />)
    expect(screen.getByTitle('aram.dev')).toHaveAttribute('src', '/')
  })
})
