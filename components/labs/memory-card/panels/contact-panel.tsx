'use client'

/**
 * ContactPanel — the "save?" save (slot 06), opened onto the paper panel as a
 * PlayStation memory-card CONFIRM DIALOG: "save your progress?" with a yes/no
 * row. Copying a contact is how you "save" it, so YES starts an email and NO
 * returns to the select screen (closing via the injected `onClose`, which fires
 * the back() blip exactly like every other panel close). Beneath the prompt, the
 * three contact rows carry the same copy→copied affordance the ContactSection
 * used, and the CC-BY attributions the lab's 3D assets are licensed under.
 *
 * Content-only: rendered inside `PanelShell` by the screen. Rows + `copyText` +
 * the `copiedTimer` unmount-clear guard are ported verbatim from
 * `sections/contact.tsx`.
 */

import { useEffect, useRef, useState } from 'react'
import { MC, inkAlpha, withAlpha } from '../tokens'
import { grotesk, monoFamily } from '../fonts'
import { useMemoryCardAudioActions } from '../audio-context'
import { siteConfig, socialLinks } from '@/lib/constants'
import type { SaveSlot } from '../save-select/saves'

const COPIED_MS = 1600

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

/** CC-BY attributions for the lab's 3D assets. Both lines are required to render
 *  (license law); lowercase per lab copy law. Plain text — the Sketchfab source
 *  pages aren't linked rather than risk a wrong URL. */
const ATTRIBUTIONS = [
  'crt model by meipal (cc by 4.0)',
  'character by humans of the world (cc by 4.0)',
]

/**
 * Copy `text` to the clipboard, permission-safe. Prefers the async Clipboard
 * API and falls back to a hidden-textarea `execCommand` for non-secure
 * contexts. Never rejects — the caller only reacts to the boolean. (Ported
 * verbatim from `sections/contact.tsx`.)
 */
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

export type ContactPanelProps = {
  save: SaveSlot
  /** Close the dialog — fires the back() blip and returns to select. */
  onClose: () => void
}

export function ContactPanel({ save, onClose }: ContactPanelProps) {
  const accent = save.accent
  const audio = useMemoryCardAudioActions()
  const [copied, setCopied] = useState<string | null>(null)
  const copiedTimer = useRef<number | undefined>(undefined)
  useEffect(() => () => window.clearTimeout(copiedTimer.current), [])

  const onCopy = async (row: Row) => {
    audio.blip()
    const ok = await copyText(row.value)
    if (!ok) return
    setCopied(row.key)
    window.clearTimeout(copiedTimer.current)
    copiedTimer.current = window.setTimeout(
      () => setCopied((k) => (k === row.key ? null : k)),
      COPIED_MS
    )
  }

  return (
    <div className="flex flex-col" style={{ ['--mc-ring' as string]: accent }}>
      {/* Header — slot chip + label. */}
      <header className="flex items-center gap-2">
        <span
          className="inline-flex items-center uppercase"
          style={{
            fontFamily: monoFamily,
            fontSize: '0.5625rem',
            letterSpacing: '0.2em',
            color: accent,
            border: `1px solid ${withAlpha(accent, 0.5)}`,
            borderRadius: 3,
            padding: '3px 7px',
          }}
        >
          save {save.slot}
        </span>
        <span
          className="lowercase"
          style={{
            fontFamily: monoFamily,
            fontSize: '0.5625rem',
            letterSpacing: '0.24em',
            color: inkAlpha(0.4),
          }}
        >
          save?
        </span>
      </header>

      {/* Confirm prompt — the signature PS1 memory-card save dialog. */}
      <h2
        className="mt-4 uppercase"
        style={{
          fontFamily: grotesk.style.fontFamily,
          fontWeight: 700,
          fontSize: 'clamp(1.75rem, 4.4vw, 2.75rem)',
          lineHeight: 1.0,
          letterSpacing: '0.002em',
          color: MC.ink,
        }}
      >
        save your progress
        <span style={{ color: accent }}>?</span>
      </h2>

      {/* Yes / No row. Yes = mailto (start an email); No = close + back(). */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:max-w-sm">
        <a
          href={`mailto:${siteConfig.email}`}
          aria-label="yes, email me"
          data-cursor="triangle"
          className="inline-flex min-h-[44px] items-center justify-center gap-2 rounded-md border uppercase transition-colors focus-visible:outline-none focus-visible:[outline:2px_solid_var(--mc-ring)] focus-visible:[outline-offset:3px]"
          style={{
            fontFamily: monoFamily,
            fontSize: '0.75rem',
            letterSpacing: '0.16em',
            color: accent,
            borderColor: withAlpha(accent, 0.55),
            background: withAlpha(accent, 0.08),
          }}
        >
          <span aria-hidden="true">▸</span>
          yes
        </a>
        <button
          type="button"
          onClick={onClose}
          aria-label="no, back to select"
          data-cursor="triangle"
          className="inline-flex min-h-[44px] items-center justify-center rounded-md border uppercase transition-colors hover:border-[color:var(--mc-ring)] focus-visible:outline-none focus-visible:[outline:2px_solid_var(--mc-ring)] focus-visible:[outline-offset:3px]"
          style={{
            fontFamily: monoFamily,
            fontSize: '0.75rem',
            letterSpacing: '0.16em',
            color: inkAlpha(0.6),
            borderColor: inkAlpha(0.28),
          }}
        >
          no
        </button>
      </div>

      <p
        className="mt-3 lowercase"
        style={{
          fontFamily: monoFamily,
          fontSize: '0.625rem',
          letterSpacing: '0.08em',
          color: inkAlpha(0.45),
        }}
      >
        yes starts an email · no returns to select
      </p>

      {/* Contact rows — each a real link with a copy affordance ("copied" = saved). */}
      <ul className="mt-8 flex flex-col">
        {ROWS.map((row) => (
          <li
            key={row.key}
            className="flex items-center justify-between gap-4 border-t py-4 last:border-b"
            style={{ borderColor: inkAlpha(0.14) }}
          >
            <div className="flex min-w-0 flex-col gap-1">
              <span
                className="lowercase"
                style={{
                  fontFamily: monoFamily,
                  fontSize: '0.5625rem',
                  letterSpacing: '0.24em',
                  color: inkAlpha(0.42),
                }}
              >
                {row.label}
              </span>
              <a
                href={row.href}
                className="truncate rounded-sm transition-colors hover:text-[color:var(--mc-ring)] focus-visible:outline-none focus-visible:[outline:2px_solid_var(--mc-ring)] focus-visible:[outline-offset:4px]"
                style={{
                  fontFamily: monoFamily,
                  fontSize: '0.9375rem',
                  letterSpacing: '-0.01em',
                  color: MC.ink,
                }}
              >
                {row.value}
              </a>
            </div>
            <button
              type="button"
              data-cursor="triangle"
              onClick={() => onCopy(row)}
              aria-label={`copy ${row.label}`}
              className="flex h-11 min-w-[5rem] shrink-0 items-center justify-center rounded-md border px-3 lowercase transition-colors hover:border-[color:var(--mc-ring)] focus-visible:outline-none focus-visible:[outline:2px_solid_var(--mc-ring)] focus-visible:[outline-offset:3px]"
              style={{
                fontFamily: monoFamily,
                fontSize: '0.6875rem',
                letterSpacing: '0.12em',
                color: copied === row.key ? accent : inkAlpha(0.6),
                borderColor: copied === row.key ? withAlpha(accent, 0.55) : inkAlpha(0.24),
              }}
            >
              {copied === row.key ? 'copied' : 'copy'}
            </button>
          </li>
        ))}
      </ul>

      {/* Attribution — the two CC-BY lines the lab's 3D assets ship under. */}
      <div className="mt-7 flex flex-col gap-1">
        {ATTRIBUTIONS.map((line) => (
          <span
            key={line}
            className="lowercase"
            style={{
              fontFamily: monoFamily,
              fontSize: '0.625rem',
              letterSpacing: '0.06em',
              color: inkAlpha(0.4),
            }}
          >
            {line}
          </span>
        ))}
      </div>
    </div>
  )
}

export default ContactPanel
