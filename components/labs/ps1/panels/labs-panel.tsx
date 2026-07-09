'use client'

import { labs } from '@/lib/labs-manifest'
import { PanelShell, PSX_UI } from './panel-shell'

// Toy-plastic spine colors per box, cycled from the PSX accent family.
const SPINES = [PSX_UI.orange, PSX_UI.blue, PSX_UI.red, PSX_UI.yellow]

export function LabsPanel({ onClose }: { onClose: () => void }) {
  return (
    <PanelShell title="labs · shelf" onClose={onClose} sticker="collect">
      <ul className="flex flex-col gap-2.5">
        {labs.map((lab, i) => {
          const href = lab.href ?? `/labs/${lab.slug}`
          const attic = lab.status === 'attic'
          return (
            <li key={lab.slug}>
              <a
                href={href}
                className="flex min-h-[44px] items-stretch gap-3 border-2 outline-none transition-colors focus-visible:ring-2"
                style={{ borderColor: PSX_UI.borderSoft, background: 'rgba(0,0,0,0.28)' }}
              >
                {/* Game-box spine. */}
                <span
                  aria-hidden="true"
                  className="w-2 shrink-0"
                  style={{ background: SPINES[i % SPINES.length] }}
                />
                <span className="flex flex-1 flex-col gap-1 py-2 pr-3">
                  <span className="flex flex-wrap items-center gap-2">
                    <span
                      className="text-[14px] font-black uppercase tracking-[0.06em]"
                      style={{
                        color: PSX_UI.ink,
                        fontFamily: "'Arial Black','Helvetica Neue',Arial,sans-serif",
                      }}
                    >
                      {lab.title}
                    </span>
                    {attic ? (
                      <span
                        className="px-1.5 py-0.5 font-mono text-[9px] lowercase tracking-[0.14em]"
                        style={{
                          color: '#1a120c',
                          background: PSX_UI.orange,
                          transform: 'rotate(-2deg)',
                          boxShadow: '1px 1px 0 rgba(0,0,0,0.4)',
                        }}
                      >
                        retired to the attic
                      </span>
                    ) : (
                      <span
                        className="font-mono text-[9px] lowercase tracking-[0.16em]"
                        style={{ color: PSX_UI.teal }}
                      >
                        {lab.status}
                      </span>
                    )}
                  </span>
                  <span
                    className="max-w-[56ch] font-mono text-[11px] leading-snug"
                    style={{ color: PSX_UI.inkDim }}
                  >
                    {lab.thesis}
                  </span>
                </span>
              </a>
            </li>
          )
        })}
      </ul>

      <a
        href="/labs"
        className="mt-4 inline-flex min-h-[44px] items-center border-2 px-3 font-mono text-[12px] lowercase tracking-[0.12em] outline-none transition-colors focus-visible:ring-2"
        style={{ borderColor: PSX_UI.borderSoft, color: PSX_UI.teal, background: 'rgba(0,0,0,0.35)' }}
      >
        &#8592; gallery
      </a>
    </PanelShell>
  )
}
