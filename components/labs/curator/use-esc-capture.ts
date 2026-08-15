import { useEffect } from 'react'

/** Close an overlay on Escape BEFORE GalleryChrome's bubble listener navigates.
 *  Capture-phase + preventDefault; GalleryChrome checks e.defaultPrevented. */
export function useEscCapture(active: boolean, onClose: () => void): void {
  useEffect(() => {
    if (!active) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      onClose()
    }
    window.addEventListener('keydown', onKey, { capture: true })
    return () => window.removeEventListener('keydown', onKey, { capture: true })
  }, [active, onClose])
}
