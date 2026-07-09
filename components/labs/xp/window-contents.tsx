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
  'my-computer': WinMyComputer as ComponentType<{ win: XpWindow }>,
  'my-projects': WinProjects as ComponentType<{ win: XpWindow }>,
  'project-detail': WinProjectDetail,
  resume: WinResume as ComponentType<{ win: XpWindow }>,
  about: WinAbout as ComponentType<{ win: XpWindow }>,
  messenger: WinMessenger as ComponentType<{ win: XpWindow }>,
  'internet-explorer': WinIE as ComponentType<{ win: XpWindow }>,
  'add-remove': WinAddRemove as ComponentType<{ win: XpWindow }>,
  'recycle-bin': WinRecycleBin as ComponentType<{ win: XpWindow }>,
}
