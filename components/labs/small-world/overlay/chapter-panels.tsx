'use client'
import { panelArtSrc } from '../art-manifest'
import type { Chapter } from '../chapters'
import { easeOutBack } from '../journey-timeline'
import { PALETTE } from '../palette'

const INK_BORDER = `4px solid ${PALETTE.ink}`
const HALFTONE = `radial-gradient(circle, ${PALETTE.ink}18 1px, transparent 1.5px)`

/** One chapter stop's spread: art panel + typeset data panel, comic-tilted. */
export function ChapterPanels({
  chapter,
  index,
  t,
  onAdvance,
}: {
  chapter: Chapter
  index: number
  t: number
  onAdvance: () => void
}) {
  const enter = easeOutBack(Math.min(1, t * 2.2))
  const artSrc = panelArtSrc(chapter.id)
  return (
    <div
      data-testid="sw-panel-tap"
      onClick={onAdvance}
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'auto',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'min(3vw, 28px)',
        flexWrap: 'wrap',
        padding: 'min(6vh, 48px) min(4vw, 40px)',
        background: `rgba(43, 43, 51, ${0.35 * Math.min(1, t * 3)})`,
      }}
    >
      <div
        style={{
          width: 'min(38vw, 340px)',
          minWidth: 220,
          aspectRatio: '2 / 3',
          border: INK_BORDER,
          borderRadius: 6,
          boxShadow: `10px 12px 0 ${PALETTE.ink}`,
          background: chapter.accent,
          overflow: 'hidden',
          transform: `translateY(${(1 - enter) * 60}px) rotate(${-3 * enter}deg) scale(${0.85 + 0.15 * enter})`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {artSrc ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={artSrc} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div
            style={{
              padding: 20,
              textAlign: 'center',
              backgroundImage: HALFTONE,
              backgroundSize: '9px 9px',
              width: '100%',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
            }}
          >
            <span style={{ fontFamily: 'var(--sw-font-panel)', fontSize: 'min(18vw, 120px)', color: PALETTE.ink, lineHeight: 1 }}>
              {index + 1}
            </span>
            <span style={{ fontFamily: 'var(--sw-font-body)', fontWeight: 700, color: PALETTE.ink, fontSize: 14 }}>
              {chapter.theme}
            </span>
          </div>
        )}
      </div>

      <article
        data-testid="sw-panel-data"
        style={{
          width: 'min(40vw, 380px)',
          minWidth: 260,
          border: INK_BORDER,
          borderRadius: 6,
          boxShadow: `-8px 12px 0 ${PALETTE.ink}`,
          background: PALETTE.sky,
          backgroundImage: HALFTONE,
          backgroundSize: '9px 9px',
          padding: '20px 22px',
          transform: `translateY(${(1 - enter) * 90}px) rotate(${2 * enter}deg) scale(${0.85 + 0.15 * enter})`,
          color: PALETTE.ink,
          fontFamily: 'var(--sw-font-body)',
        }}
      >
        <p style={{ fontFamily: 'var(--sw-font-panel)', fontSize: 15, letterSpacing: 1, margin: 0, color: PALETTE.blossomDeep }}>
          Chapter {index + 1} · {chapter.period}
        </p>
        <h2 style={{ fontFamily: 'var(--sw-font-display)', fontSize: 30, lineHeight: 1.05, margin: '6px 0 2px' }}>
          {chapter.company}
        </h2>
        <p style={{ fontWeight: 800, margin: '0 0 2px', fontSize: 15 }}>{chapter.role}</p>
        <p style={{ margin: '0 0 10px', fontSize: 12, opacity: 0.75 }}>{chapter.location}</p>
        <p style={{ fontSize: 13.5, lineHeight: 1.45, margin: '0 0 12px' }}>{chapter.description}</p>
        <ul style={{ margin: '0 0 12px', paddingLeft: 18, fontSize: 12.5, lineHeight: 1.5 }}>
          {chapter.highlights.slice(0, 3).map((h) => (
            <li key={h}>{h}</li>
          ))}
        </ul>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          {chapter.technologies.map((tech) => (
            <span
              key={tech}
              style={{
                fontFamily: 'var(--sw-font-panel)',
                fontSize: 12,
                letterSpacing: 0.8,
                padding: '3px 9px',
                borderRadius: 999,
                border: `2px solid ${PALETTE.ink}`,
                background: chapter.accent,
              }}
            >
              {tech}
            </span>
          ))}
        </div>
      </article>
    </div>
  )
}
