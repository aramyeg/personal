'use client'

import { useState } from 'react'
import { siteConfig, socialLinks } from '@/lib/constants'
import { PanelShell, PSX_UI } from './panel-shell'

type Row = { key: string; label: string; value: string; href: string }

const ROWS: Row[] = [
  { key: 'email', label: 'email', value: siteConfig.email, href: `mailto:${siteConfig.email}` },
  ...socialLinks.map((s) => ({
    key: s.name.toLowerCase(),
    label: s.name.toLowerCase(),
    value: s.url.replace(/^https?:\/\//, ''),
    href: s.url,
  })),
]

/** Copy to clipboard with a permission-safe fallback for non-secure contexts. */
async function copyText(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

export function ContactPanel({ onClose }: { onClose: () => void }) {
  const [copied, setCopied] = useState<string | null>(null)

  const onCopy = async (row: Row) => {
    const ok = await copyText(row.value)
    if (!ok) return
    setCopied(row.key)
    window.setTimeout(() => setCopied((k) => (k === row.key ? null : k)), 1500)
  }

  return (
    <PanelShell title="contact · pager" onClose={onClose} sticker="msg">
      <ul className="flex flex-col gap-3">
        {ROWS.map((row) => (
          <li
            key={row.key}
            className="border-2 px-3 py-2.5"
            style={{ borderColor: PSX_UI.borderSoft, background: 'rgba(0,0,0,0.3)' }}
          >
            <div
              className="mb-1.5 font-mono text-[10px] uppercase tracking-[0.2em]"
              style={{ color: PSX_UI.inkDim }}
            >
              {row.label}
            </div>
            <div className="flex min-h-[44px] items-center justify-between gap-3">
              <a
                href={row.href}
                className="truncate font-mono text-[13px] tracking-[0.02em] outline-none focus-visible:ring-2"
                style={{ color: PSX_UI.teal }}
              >
                {row.value}
              </a>
              <button
                type="button"
                onClick={() => onCopy(row)}
                aria-label={`copy ${row.label}`}
                className="flex min-h-[44px] shrink-0 items-center border-2 px-3 font-mono text-[11px] lowercase tracking-[0.12em] outline-none transition-colors focus-visible:ring-2"
                style={{
                  borderColor: PSX_UI.borderSoft,
                  color: copied === row.key ? PSX_UI.yellow : PSX_UI.ink,
                  background: 'rgba(0,0,0,0.35)',
                }}
              >
                {copied === row.key ? 'copied' : 'copy'}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </PanelShell>
  )
}
