'use client'

/**
 * BioPanel — the "system data" save (slot 04) opened onto the paper panel. Where
 * a project save prints a project's data, the system-data save prints the
 * person's: the same ink-on-paper readout language as SavePanel — slot chip,
 * name, role line — carrying the verbatim bio ported from `sections/about.tsx`,
 * then the four career highlights as a compact save-data grid.
 *
 * Content-only: rendered inside `PanelShell` by the screen. Every string here is
 * copied exactly from the About section so the two never disagree; the emphasis
 * runs mark the same phrases About emphasises, recoloured to the save's accent.
 */

import { MC, inkAlpha, withAlpha } from '../tokens'
import { grotesk, monoFamily } from '../fonts'
import { siteConfig } from '@/lib/constants'
import type { SaveSlot } from '../save-select/saves'

/** One inline run of a bio paragraph; `em` phrases are recoloured to the accent. */
type Run = { text: string; em?: boolean }

/**
 * The four bio paragraphs, VERBATIM from `components/sections/about.tsx` (the
 * left-column bio). Held as data (not JSX text) so the exact strings — including
 * apostrophes — survive without HTML-entity escaping, and the emphasised phrases
 * are the same ones About sets in `font-medium`.
 */
const BIO_PARAGRAPHS: ReadonlyArray<ReadonlyArray<Run>> = [
  [
    { text: "I'm a " },
    { text: 'Senior Frontend Engineer', em: true },
    {
      text: ". For the last eight years I've built production applications for banks, messaging platforms, and startups.",
    },
  ],
  [
    {
      text: "My journey started in 2016 when I transitioned from marketing to software development. Since then, I've worked remotely for companies across ",
    },
    { text: 'Switzerland, Germany, Estonia, Ireland, and the UAE', em: true },
    { text: ', specializing in fintech and enterprise platforms.' },
  ],
  [
    { text: 'Currently at ' },
    { text: 'xDataGroup', em: true },
    {
      text: ", I build the frontend of AMIO Bank's retail banking platform while collaborating directly with founders on an early-stage PropTech startup.",
    },
  ],
  [
    {
      text: 'Most of my work sits where correctness matters: moving money, messaging at scale, banking security. I care about interfaces that stay fast and accessible under real load — and about mentoring the developers who build them with me.',
    },
  ],
]

/** The four highlight cards, VERBATIM from About's `highlights` array. */
const HIGHLIGHTS: ReadonlyArray<{ label: string; description: string; detail: string }> = [
  { label: '8 Years', description: 'Frontend Experience', detail: 'From startups to enterprise-scale applications' },
  { label: 'Remote', description: 'International Teams', detail: 'Switzerland, Germany, Estonia, Ireland, UAE' },
  { label: 'Armenia', description: 'Based in Yerevan', detail: 'Available for global remote collaboration' },
  { label: 'Marketing', description: 'to Code (2016)', detail: 'Self-taught developer with business insight' },
]

export type BioPanelProps = { save: SaveSlot }

export function BioPanel({ save }: BioPanelProps) {
  const accent = save.accent
  return (
    <div className="flex flex-col" style={{ ['--mc-ring' as string]: accent }}>
      {/* Header — slot chip + label, name, role line (mirrors SavePanel). */}
      <header className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
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
            system data
          </span>
        </div>

        <h2
          className="uppercase"
          style={{
            fontFamily: grotesk.style.fontFamily,
            fontWeight: 700,
            fontSize: 'clamp(1.6rem, 3.6vw, 2.4rem)',
            lineHeight: 1.02,
            letterSpacing: '0.005em',
            color: MC.ink,
          }}
        >
          {siteConfig.name}
        </h2>

        <p
          className="lowercase"
          style={{
            fontFamily: monoFamily,
            fontSize: '0.75rem',
            letterSpacing: '0.05em',
            color: inkAlpha(0.6),
          }}
        >
          {siteConfig.title} · {siteConfig.location}
        </p>
      </header>

      {/* Bio — the four verbatim paragraphs. */}
      <div className="mt-5 flex max-w-[62ch] flex-col gap-4">
        {BIO_PARAGRAPHS.map((runs, i) => (
          <p
            key={i}
            style={{
              fontFamily: grotesk.style.fontFamily,
              fontSize: 'clamp(0.95rem, 1.4vw, 1.075rem)',
              lineHeight: 1.55,
              color: inkAlpha(0.74),
            }}
          >
            {runs.map((run, j) =>
              run.em ? (
                <span key={j} style={{ color: accent, fontWeight: 600 }}>
                  {run.text}
                </span>
              ) : (
                <span key={j}>{run.text}</span>
              )
            )}
          </p>
        ))}
      </div>

      {/* Highlights — the four career cards as a compact save-data grid. */}
      <ul aria-label="highlights" className="mt-7 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
        {HIGHLIGHTS.map((item) => (
          <li key={item.label} className="flex flex-col gap-1 border-t pt-3" style={{ borderColor: inkAlpha(0.14) }}>
            <span className="flex items-baseline gap-2">
              <span
                aria-hidden="true"
                style={{ fontFamily: monoFamily, fontSize: '0.8125rem', lineHeight: 1, color: accent }}
              >
                ›
              </span>
              <span
                className="uppercase"
                style={{
                  fontFamily: grotesk.style.fontFamily,
                  fontWeight: 700,
                  fontSize: '0.8125rem',
                  letterSpacing: '0.02em',
                  color: MC.ink,
                }}
              >
                {item.label}
              </span>
              <span
                className="lowercase"
                style={{
                  fontFamily: monoFamily,
                  fontSize: '0.6875rem',
                  letterSpacing: '0.04em',
                  color: inkAlpha(0.55),
                }}
              >
                {item.description}
              </span>
            </span>
            <span
              style={{
                fontFamily: monoFamily,
                fontSize: '0.6875rem',
                lineHeight: 1.4,
                letterSpacing: '0.01em',
                color: inkAlpha(0.5),
              }}
            >
              {item.detail}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export default BioPanel
