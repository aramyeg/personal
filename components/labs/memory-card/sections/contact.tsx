'use client'

/**
 * ContactSection — act 5, "save your progress?".
 *
 * The save-prompt close: three monospace rows (email / github / linkedin from
 * the shared constants), each a real link with a `copy` button that swaps to
 * `copied` for a beat — copying a contact is how you "save" it. Beneath, the
 * quiet footer: back to the gallery, cross-links to the other labs in the hall
 * (this one excluded), the CC-BY attributions the 3D assets are licensed under
 * (a license LAW, not decoration), and the copyright line.
 */

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, useReducedMotion, type Variants } from 'framer-motion'
import { siteConfig, socialLinks } from '@/lib/constants'
import { hallLabs } from '@/lib/labs-manifest'
import { MC, TYPE, GLYPH_PATHS, SECTION_ACCENT, paperAlpha } from '../tokens'
import { anton, monoFamily } from '../fonts'
import { useMemoryCardAudioContext } from '../audio-context'

const CONTACT_ACCENT = MC.glyphs[SECTION_ACCENT.contact]
const EASE: [number, number, number, number] = [0.16, 1, 0.3, 1]
const THIS_LAB = 'memory-card'
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

/** CC-BY attributions for the lab's 3D assets. Both lines are required to
 *  render (license law); lowercase per lab copy law. Plain text — the Sketchfab
 *  source pages aren't linked rather than risk a wrong URL. */
const ATTRIBUTIONS = [
  'crt model by meipal (cc by 4.0)',
  'character by humans of the world (cc by 4.0)',
]

/** The other labs in the hall, this one excluded — footer cross-links. */
const OTHER_LABS = hallLabs
  .filter((lab) => lab.slug !== THIS_LAB)
  .map((lab) => ({ title: lab.title, href: lab.href ?? `/labs/${lab.slug}` }))

/**
 * Copy `text` to the clipboard, permission-safe. Prefers the async Clipboard
 * API and falls back to a hidden-textarea `execCommand` for non-secure
 * contexts. Never rejects — the caller only reacts to the boolean.
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

const reveal: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: ({ reduced }: { reduced: boolean }) => ({
    opacity: 1,
    y: 0,
    transition: reduced ? { duration: 0 } : { duration: 0.7, ease: EASE },
  }),
}

const footLink =
  'inline-flex min-h-[44px] items-center rounded-md px-1 transition-colors hover:text-[color:var(--mc-ring)] focus-visible:outline-none focus-visible:[outline:2px_solid_var(--mc-ring)] focus-visible:[outline-offset:3px]'

export type ContactSectionProps = {
  /** Override the media query (client islands otherwise read it themselves). */
  reduced?: boolean
}

export function ContactSection({ reduced: reducedProp }: ContactSectionProps) {
  const systemReduced = useReducedMotion()
  const reduced = reducedProp ?? systemReduced ?? false
  const audio = useMemoryCardAudioContext()
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
    <section
      id="contact"
      style={{ ['--mc-ring' as string]: CONTACT_ACCENT, background: MC.ink, color: MC.paper }}
      className="relative px-6 py-20 sm:px-12 sm:py-32"
    >
      <motion.div
        custom={{ reduced }}
        variants={reveal}
        initial="hidden"
        animate={reduced ? 'show' : undefined}
        whileInView={reduced ? undefined : 'show'}
        viewport={reduced ? undefined : { once: true, amount: 0.3 }}
        className="mx-auto w-full max-w-[52rem]"
      >
        {/* Eyebrow — the section marker + its one accent glyph (triangle). */}
        <div className="mb-6 flex items-center gap-3">
          <svg aria-hidden="true" viewBox="0 0 24 24" width="12" height="12" fill="none">
            <path d={GLYPH_PATHS.triangle} stroke={CONTACT_ACCENT} strokeWidth={2} strokeLinejoin="round" />
          </svg>
          <span
            style={{ fontFamily: monoFamily, fontSize: TYPE.label, letterSpacing: '0.24em', color: paperAlpha(0.55) }}
            className="lowercase"
          >
            act 05 · contact
          </span>
        </div>

        {/* Save-prompt heading. The accent lands once, on the closing mark. */}
        <h2
          style={{
            fontFamily: anton.style.fontFamily,
            fontSize: 'clamp(2.75rem, 8.5vw, 5.75rem)',
            lineHeight: 0.94,
            letterSpacing: '-0.005em',
            textTransform: 'uppercase',
          }}
        >
          save your progress
          <span style={{ color: CONTACT_ACCENT }}>?</span>
        </h2>

        {/* Contact rows — each a real link with a copy affordance. */}
        <ul className="mt-12 flex flex-col sm:mt-16">
          {ROWS.map((row) => (
            <li
              key={row.key}
              className="flex items-center justify-between gap-4 border-t py-5 last:border-b sm:py-6"
              style={{ borderColor: paperAlpha(0.14) }}
            >
              <div className="flex min-w-0 flex-col gap-1.5">
                <span
                  style={{ fontFamily: monoFamily, fontSize: '0.6875rem', letterSpacing: '0.24em', color: paperAlpha(0.45) }}
                  className="lowercase"
                >
                  {row.label}
                </span>
                <a
                  href={row.href}
                  style={{ fontFamily: monoFamily, fontSize: '1.25rem', letterSpacing: '-0.01em', color: MC.paper }}
                  className="truncate rounded-sm transition-colors hover:text-[color:var(--mc-ring)] focus-visible:outline-none focus-visible:[outline:2px_solid_var(--mc-ring)] focus-visible:[outline-offset:4px]"
                >
                  {row.value}
                </a>
              </div>
              <button
                type="button"
                data-cursor="triangle"
                onClick={() => onCopy(row)}
                aria-label={`copy ${row.label}`}
                style={{
                  fontFamily: monoFamily,
                  fontSize: '0.75rem',
                  letterSpacing: '0.12em',
                  color: copied === row.key ? CONTACT_ACCENT : paperAlpha(0.7),
                  borderColor: copied === row.key ? CONTACT_ACCENT : paperAlpha(0.24),
                }}
                className="flex h-11 min-w-[5.5rem] shrink-0 items-center justify-center rounded-md border px-4 lowercase transition-colors hover:border-[color:var(--mc-ring)] focus-visible:outline-none focus-visible:[outline:2px_solid_var(--mc-ring)] focus-visible:[outline-offset:3px]"
              >
                {copied === row.key ? 'copied' : 'copy'}
              </button>
            </li>
          ))}
        </ul>

        {/* Footer — gallery return, lab cross-links, licenses, copyright. */}
        <footer
          data-testid="contact-footer"
          className="mt-16 flex flex-col gap-6 border-t pt-8 sm:mt-24"
          style={{ borderColor: paperAlpha(0.12) }}
        >
          <nav aria-label="Labs" className="flex flex-wrap items-center gap-x-6 gap-y-1">
            <Link
              href="/labs"
              data-cursor="triangle"
              style={{ fontFamily: monoFamily, fontSize: TYPE.label, letterSpacing: '0.06em', color: paperAlpha(0.7) }}
              className={`${footLink} lowercase`}
            >
              <span aria-hidden="true" className="mr-2">
                ←
              </span>
              gallery
            </Link>
            {OTHER_LABS.map((lab) => (
              <Link
                key={lab.href}
                href={lab.href}
                data-cursor="triangle"
                style={{ fontFamily: monoFamily, fontSize: TYPE.label, letterSpacing: '0.06em', color: paperAlpha(0.5) }}
                className={`${footLink} lowercase`}
              >
                {lab.title}
              </Link>
            ))}
          </nav>

          <div className="flex flex-col gap-1">
            {ATTRIBUTIONS.map((line) => (
              <span
                key={line}
                style={{ fontFamily: monoFamily, fontSize: '0.6875rem', letterSpacing: '0.06em', color: paperAlpha(0.34) }}
                className="lowercase"
              >
                {line}
              </span>
            ))}
          </div>

          <span
            style={{ fontFamily: monoFamily, fontSize: '0.6875rem', letterSpacing: '0.1em', color: paperAlpha(0.4) }}
            className="lowercase"
          >
            © {new Date().getFullYear()} aram yeghiazaryan
          </span>
        </footer>
      </motion.div>
    </section>
  )
}

export default ContactSection
