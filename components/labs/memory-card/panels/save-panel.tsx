'use client'

/**
 * SavePanel — the loaded save file's data, printed on the paper panel. It reads
 * top-to-bottom as a save-data readout: a small live CRT running the project's
 * ticker (the one 3D moment the panel borrows from the lab's console language),
 * then the slot chip, title, and role line, the long description, the metrics as
 * ticked readout lines, the technology row, and a link out to the live project.
 *
 * Self-contained across both homes: rendered inside `PanelShell` on the
 * intercepting overlay, and directly on the standalone `/save/[id]` page. The
 * only thing `standalone` changes is document semantics — the title becomes the
 * page's `<h1>` instead of the dialog's `<h2>` — so the two never disagree on
 * content. Reduced motion is read via effect-set state so the standalone page's
 * SSR and first client paint stay byte-identical before reconciling.
 */

import { useEffect, useMemo, useState } from 'react'
import { MC, accentFor, inkAlpha, withAlpha, type GlyphName } from '../tokens'
import { grotesk, monoFamily } from '../fonts'
import { VignetteCanvas } from '../three/stage'
import { CrtVignette } from '../three/crt-vignette'
import { projects, type ExtendedProject } from '@/data/projects'

/** Look-dev framing approved for the crt.glb (shared with the About act). */
const CRT_CAMERA = { position: [0.35, 1.72, 6.4] as [number, number, number], fov: 32 }
const CRT_TARGET: [number, number, number] = [0, 1.5, 0]

/** Map an accent hex back to its glyph name for the no-WebGL fallback mark. */
const GLYPH_BY_ACCENT: Record<string, GlyphName> = {
  [MC.glyphs.triangle]: 'triangle',
  [MC.glyphs.circle]: 'circle',
  [MC.glyphs.cross]: 'cross',
  [MC.glyphs.square]: 'square',
}

/** The CRT ticker lines — uppercase (the 5x7 phosphor font has no lowercase),
 *  every line traceable to project data, capped at the screen's 6 rows. */
function crtLines(project: ExtendedProject): string[] {
  return [
    project.title.toUpperCase(),
    `SAVED · ${project.year.toUpperCase()}`,
    ...project.technologies.slice(0, 3).map((t) => t.toUpperCase()),
    'NOW PLAYING',
  ].slice(0, 6)
}

export type SavePanelProps = {
  project: ExtendedProject
  /** Standalone page vs. overlay dialog — promotes the title to the page `<h1>`. */
  standalone?: boolean
}

export function SavePanel({ project, standalone = false }: SavePanelProps) {
  const [reduced, setReduced] = useState(false)
  useEffect(() => {
    setReduced(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  }, [])

  // Slot number + accent mirror the rail exactly (data-order index).
  const { slot, accent } = useMemo(() => {
    const index = projects.findIndex((p) => p.id === project.id)
    const at = index < 0 ? 0 : index
    return { slot: String(at + 1).padStart(2, '0'), accent: accentFor(at) }
  }, [project.id])

  const lines = useMemo(() => crtLines(project), [project])
  const metrics = project.metrics ?? []
  const TitleTag = standalone ? 'h1' : 'h2'
  const fallbackGlyph = GLYPH_BY_ACCENT[accent] ?? 'triangle'

  return (
    <div className="flex flex-col" style={{ ['--mc-ring' as string]: accent }}>
      {/* CRT head — the live console running this save's ticker. */}
      <div
        className="relative mb-6 w-full overflow-hidden rounded-lg"
        style={{
          height: 'clamp(150px, 22vh, 208px)',
          background: MC.abyss,
          border: `1px solid ${inkAlpha(0.16)}`,
        }}
      >
        <VignetteCanvas
          reduced={reduced}
          camera={CRT_CAMERA}
          target={CRT_TARGET}
          envIntensity={0.9}
          shadowRadius={0.001}
          fallbackGlyph={fallbackGlyph}
        >
          <CrtVignette lines={lines} reduced={reduced} />
        </VignetteCanvas>
      </div>

      {/* Header — slot chip, title, role line. */}
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
            save {slot}
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
            loaded
          </span>
        </div>

        {/* Casing law: the loaded title renders in its true casing — no
            `uppercase` transform — so a product name like "iBank" survives
            intact here exactly as it does on the select screen. */}
        <TitleTag
          style={{
            fontFamily: grotesk.style.fontFamily,
            fontWeight: 700,
            fontSize: 'clamp(1.6rem, 3.6vw, 2.4rem)',
            lineHeight: 1.02,
            letterSpacing: '0.005em',
            color: MC.ink,
          }}
        >
          {project.title}
        </TitleTag>

        <p
          className="lowercase"
          style={{
            fontFamily: monoFamily,
            fontSize: '0.75rem',
            letterSpacing: '0.05em',
            color: inkAlpha(0.6),
          }}
        >
          {project.role} · {project.company} · {project.year}
        </p>
      </header>

      {/* Long description — the one paragraph of real prose. */}
      {project.longDescription && (
        <p
          className="mt-5 max-w-[62ch]"
          style={{
            fontFamily: grotesk.style.fontFamily,
            fontSize: 'clamp(0.95rem, 1.4vw, 1.075rem)',
            lineHeight: 1.55,
            color: inkAlpha(0.74),
          }}
        >
          {project.longDescription}
        </p>
      )}

      {/* Metrics — ticked save-data readout lines. */}
      {metrics.length > 0 && (
        <ul aria-label="save data" className="mt-6 flex flex-col gap-2">
          {metrics.map((metric) => (
            <li key={metric} className="flex items-baseline gap-2.5">
              <span
                aria-hidden="true"
                className="shrink-0"
                style={{
                  fontFamily: monoFamily,
                  fontSize: '0.8125rem',
                  lineHeight: 1.3,
                  color: accent,
                }}
              >
                ›
              </span>
              <span
                style={{
                  fontFamily: monoFamily,
                  fontSize: '0.8125rem',
                  lineHeight: 1.3,
                  letterSpacing: '0.01em',
                  color: inkAlpha(0.82),
                }}
              >
                {metric}
              </span>
            </li>
          ))}
        </ul>
      )}

      {/* Technology row. */}
      <div className="mt-6 flex flex-wrap gap-2">
        {project.technologies.map((tech) => (
          <span
            key={tech}
            className="lowercase"
            style={{
              fontFamily: monoFamily,
              fontSize: '0.625rem',
              letterSpacing: '0.08em',
              color: inkAlpha(0.6),
              border: `1px solid ${inkAlpha(0.2)}`,
              borderRadius: 3,
              padding: '4px 8px',
            }}
          >
            {tech}
          </span>
        ))}
      </div>

      {/* Link out to the live project, when one exists. */}
      {project.link && (
        <div className="mt-7">
          <a
            href={project.link}
            target="_blank"
            rel="noopener noreferrer"
            data-cursor="triangle"
            className="group inline-flex min-h-[44px] items-center gap-2 rounded-md border px-4 uppercase transition-colors hover:border-[color:var(--mc-ring)] focus-visible:outline-none focus-visible:[outline:2px_solid_var(--mc-ring)] focus-visible:[outline-offset:3px]"
            style={{
              fontFamily: monoFamily,
              fontSize: '0.6875rem',
              letterSpacing: '0.16em',
              color: MC.ink,
              borderColor: inkAlpha(0.28),
            }}
          >
            open project
            <span
              aria-hidden="true"
              className="transition-transform group-hover:translate-x-0.5"
              style={{ color: accent }}
            >
              →
            </span>
          </a>
        </div>
      )}
    </div>
  )
}

export default SavePanel
