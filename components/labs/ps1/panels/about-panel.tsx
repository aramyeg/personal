'use client'

import { PanelShell, PSX_UI } from './panel-shell'

/**
 * Bio copy, ported faithfully from components/sections/about.tsx (the canonical
 * source) — same facts, no lead-title claims: Senior Frontend Engineer who
 * mentors, never "leading".
 */
const BIO = [
  "I'm a Senior Frontend Engineer. For the last eight years I've built production applications for banks, messaging platforms, and startups.",
  'My journey started in 2016 when I transitioned from marketing to software development. Since then, I’ve worked remotely for companies across Switzerland, Germany, Estonia, Ireland, and the UAE, specializing in fintech and enterprise platforms.',
  "Currently at xDataGroup, I build the frontend of AMIO Bank's retail banking platform while collaborating directly with founders on an early-stage PropTech startup.",
  'Most of my work sits where correctness matters: moving money, messaging at scale, banking security. I care about interfaces that stay fast and accessible under real load — and about mentoring the developers who build them with me.',
]

// The v1 hero tagline, kept verbatim.
const TAGLINE = '8 yrs · fintech systems · Yerevan → worldwide'

export function AboutPanel({ onClose }: { onClose: () => void }) {
  return (
    <PanelShell title="about · profile" onClose={onClose} sticker="1999">
      {/* Caps stat strip — the hero tagline as a BIOS spec line. */}
      <div
        className="mb-5 flex items-center gap-2 border-2 px-3 py-2 font-mono text-[11px] uppercase tracking-[0.14em]"
        style={{
          borderColor: PSX_UI.borderSoft,
          color: PSX_UI.ink,
          background: 'rgba(0,0,0,0.28)',
        }}
      >
        <span aria-hidden="true" style={{ color: PSX_UI.teal }}>
          &#9632;
        </span>
        {TAGLINE}
      </div>

      <div className="flex flex-col gap-4">
        {BIO.map((para, i) => (
          <p
            key={i}
            className="max-w-[62ch] text-[13px] leading-relaxed"
            style={{ color: i === 0 ? PSX_UI.ink : PSX_UI.inkDim }}
          >
            {para}
          </p>
        ))}
      </div>
    </PanelShell>
  )
}
