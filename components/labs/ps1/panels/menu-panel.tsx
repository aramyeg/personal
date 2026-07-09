'use client'

import { siteConfig } from '@/lib/constants'
import type { PanelId } from '../scene/cameras'
import { PanelShell, PSX_UI } from './panel-shell'

type NavId = Exclude<PanelId, null | 'menu'>

/** Mirror of the CRT boot menu — the other five panels as one big select list. */
const ITEMS: { id: NavId; label: string; note: string }[] = [
  { id: 'about', label: 'about', note: 'bio · career · where i work' },
  { id: 'projects', label: 'projects', note: 'saved work, by slot' },
  { id: 'skills', label: 'skills', note: 'stack levels by category' },
  { id: 'contact', label: 'contact', note: 'email · linkedin · github' },
  { id: 'labs', label: 'labs', note: 'the other experiments' },
]

export function MenuPanel({
  onClose,
  onNavigate,
}: {
  onClose: () => void
  onNavigate: (panel: Exclude<PanelId, null>) => void
}) {
  return (
    <PanelShell title="ay-01 · menu" onClose={onClose} sticker="slot 1">
      <p
        className="mb-5 max-w-[52ch] font-mono text-[12px] leading-relaxed"
        style={{ color: PSX_UI.inkDim }}
      >
        {siteConfig.description}
      </p>

      <ul className="flex flex-col gap-2">
        {ITEMS.map((item) => (
          <li key={item.id}>
            <button
              type="button"
              onClick={() => onNavigate(item.id)}
              className="group flex min-h-[44px] w-full items-center gap-3 border-2 px-3 py-2 text-left outline-none transition-colors focus-visible:ring-2"
              style={{ borderColor: PSX_UI.borderSoft, background: 'rgba(0,0,0,0.28)' }}
            >
              <span
                aria-hidden="true"
                className="font-mono text-sm leading-none transition-transform group-hover:translate-x-0.5"
                style={{ color: PSX_UI.teal }}
              >
                &#9656;
              </span>
              <span
                className="text-[15px] font-black uppercase tracking-[0.1em]"
                style={{
                  color: PSX_UI.ink,
                  fontFamily: "'Arial Black','Helvetica Neue',Arial,sans-serif",
                }}
              >
                {item.label}
              </span>
              <span
                className="ml-auto hidden font-mono text-[11px] lowercase tracking-[0.08em] sm:inline"
                style={{ color: PSX_UI.inkDim }}
              >
                {item.note}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </PanelShell>
  )
}
