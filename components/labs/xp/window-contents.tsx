'use client'

import type { ComponentType } from 'react'
import type { XpAppId, XpWindow } from './store'
import { WinAbout } from './win-about'
import { WinResume } from './win-resume'
import { WinProjects } from './win-projects'
import { WinProjectDetail } from './win-project-detail'
import { WinMyComputer } from './win-my-computer'

function Stub({ win }: { win: XpWindow }) {
  return <div style={{ padding: 12 }}>{win.title}</div>
}

export const WINDOW_CONTENTS: Record<XpAppId, ComponentType<{ win: XpWindow }>> = {
  'my-computer': WinMyComputer,
  'my-projects': WinProjects,
  'project-detail': WinProjectDetail,
  resume: WinResume,
  about: WinAbout,
  messenger: Stub,
  'internet-explorer': Stub,
  'add-remove': Stub,
  'recycle-bin': Stub,
}
