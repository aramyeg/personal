'use client'

import { useXpStore } from './store'
import { WindowFrame } from './window-frame'
import { WINDOW_CONTENTS } from './window-contents'

export function WindowsLayer() {
  const windows = useXpStore((s) => s.windows)
  return (
    <>
      {windows.map((win) => {
        const Content = WINDOW_CONTENTS[win.app]
        return (
          <WindowFrame key={win.id} win={win}>
            <Content win={win} />
          </WindowFrame>
        )
      })}
    </>
  )
}
