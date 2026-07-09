'use client'

import type { ComponentType } from 'react'
import type { XpAppId, XpWindow } from './store'
import { WinAbout } from './win-about'
import { WinResume } from './win-resume'

function Stub({ win }: { win: XpWindow }) {
  return <div style={{ padding: 12 }}>{win.title}</div>
}

export const WINDOW_CONTENTS: Record<XpAppId, ComponentType<{ win: XpWindow }>> = {
  'my-computer': Stub,
  'my-projects': Stub,
  'project-detail': Stub,
  resume: WinResume,
  about: WinAbout,
  messenger: Stub,
  'internet-explorer': Stub,
  'add-remove': Stub,
  'recycle-bin': Stub,
}
