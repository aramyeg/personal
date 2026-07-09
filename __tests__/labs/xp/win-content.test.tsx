import { beforeEach, describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import { WinAbout } from '@/components/labs/xp/win-about'
import { WinResume } from '@/components/labs/xp/win-resume'
import { useXpStore } from '@/components/labs/xp/store'
import { experiences } from '@/data'

beforeEach(() => useXpStore.setState({ windows: [], chaos: 'idle', startOpen: false, activeId: null }))

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
