import { useXpStore, type XpAppId } from './store'

export const APPS: Record<XpAppId, { title: string; icon: string; w: number; h: number }> = {
  'my-computer':       { title: 'My Computer',            icon: '🖥️', w: 560, h: 380 },
  'my-projects':       { title: 'My Projects',            icon: '📁', w: 640, h: 440 },
  'project-detail':    { title: 'Project',                icon: '📄', w: 520, h: 420 },
  resume:              { title: 'resume.doc - WordPad',   icon: '📝', w: 620, h: 500 },
  about:               { title: 'about-me.txt - Notepad', icon: '🗒️', w: 480, h: 360 },
  messenger:           { title: 'Aram - Conversation',    icon: '💬', w: 420, h: 480 },
  'internet-explorer': { title: 'aram.dev - Microsoft Internet Explorer', icon: '🌐', w: 760, h: 540 },
  'add-remove':        { title: 'Add or Remove Programs', icon: '🧩', w: 640, h: 480 },
  'recycle-bin':       { title: 'Recycle Bin',            icon: '🗑️', w: 560, h: 400 },
}

export const DESKTOP_ICONS: { app: XpAppId | 'chaos'; label: string; icon: string }[] = [
  { app: 'my-computer', label: 'My Computer', icon: APPS['my-computer'].icon },
  { app: 'my-projects', label: 'My Projects', icon: APPS['my-projects'].icon },
  { app: 'resume', label: 'resume.doc', icon: APPS.resume.icon },
  { app: 'about', label: 'about-me.txt', icon: APPS.about.icon },
  { app: 'messenger', label: 'Messenger', icon: APPS.messenger.icon },
  { app: 'internet-explorer', label: 'Internet Explorer', icon: APPS['internet-explorer'].icon },
  { app: 'recycle-bin', label: 'Recycle Bin', icon: APPS['recycle-bin'].icon },
  { app: 'chaos', label: 'free_ringtones.exe', icon: '🎵' },
]

export const isCoarse = () =>
  typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches

export function openApp(app: XpAppId, param?: string, title?: string) {
  const meta = APPS[app]
  useXpStore.getState().openWindow(app, {
    param,
    title: title ?? meta.title,
    maximized: isCoarse(),
    w: meta.w,
    h: meta.h,
  })
}
