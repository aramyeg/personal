'use client'

import type { ComponentType } from 'react'
import type { XpAppId, XpWindow } from './store'
import { WinAbout } from './win-about'
import { WinResume } from './win-resume'
import { WinProjects } from './win-projects'
import { WinProjectDetail } from './win-project-detail'
import { WinMyComputer } from './win-my-computer'
import { WinAddRemove } from './win-add-remove'
import { WinRecycleBin } from './win-recycle-bin'
import { WinMessenger } from './win-messenger'
import { WinIE } from './win-ie'

export const WINDOW_CONTENTS: Record<XpAppId, ComponentType<{ win: XpWindow }>> = {
  'my-computer': WinMyComputer,
  'my-projects': WinProjects,
  'project-detail': WinProjectDetail,
  resume: WinResume,
  about: WinAbout,
  messenger: WinMessenger,
  'internet-explorer': WinIE,
  'add-remove': WinAddRemove,
  'recycle-bin': WinRecycleBin,
}
