import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SavePanel } from '@/components/labs/memory-card/panels/save-panel'
import { MC, accentFor, inkAlpha } from '@/components/labs/memory-card/tokens'
import { monoFamily } from '@/components/labs/memory-card/fonts'
import { projects } from '@/data/projects'

/** Pre-render one static page per real save; unknown ids fall through to 404. */
export function generateStaticParams() {
  return projects.map((project) => ({ id: project.id }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}): Promise<Metadata> {
  const { id } = await params
  const project = projects.find((p) => p.id === id)
  if (!project) return {}
  return {
    title: `${project.title} — Memory Card`,
    description: project.description,
  }
}

/** Both CC-BY asset attributions — required on every standalone save page too. */
const ATTRIBUTIONS = [
  'crt model by meipal (cc by 4.0)',
  'character by humans of the world (cc by 4.0)',
]

export default async function StandaloneSavePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const project = projects.find((p) => p.id === id)
  if (!project) notFound()

  const index = projects.findIndex((p) => p.id === project.id)
  const accent = accentFor(index < 0 ? 0 : index)
  const year = new Date().getFullYear()

  return (
    <main
      style={{
        background: MC.paper,
        color: MC.ink,
        ['--mc-ring' as string]: accent,
      }}
      className="flex min-h-[100svh] flex-col"
    >
      <div className="mx-auto flex w-full max-w-[46rem] flex-1 flex-col px-6 py-10 sm:px-9">
        <Link
          href="/labs/memory-card"
          data-cursor="triangle"
          className="inline-flex min-h-[44px] w-fit items-center gap-2 rounded-md uppercase transition-colors hover:text-[color:var(--mc-ring)] focus-visible:outline-none focus-visible:[outline:2px_solid_var(--mc-ring)] focus-visible:[outline-offset:2px]"
          style={{
            fontFamily: monoFamily,
            fontSize: '0.6875rem',
            letterSpacing: '0.16em',
            color: inkAlpha(0.55),
          }}
        >
          <span aria-hidden="true" style={{ color: accent }}>
            ←
          </span>
          select file
        </Link>

        <div className="mt-6">
          <SavePanel project={project} standalone />
        </div>

        <footer
          className="mt-12 flex flex-wrap items-center gap-x-4 gap-y-1 border-t pt-4 lowercase"
          style={{
            borderColor: inkAlpha(0.14),
            fontFamily: monoFamily,
            fontSize: '0.625rem',
            letterSpacing: '0.06em',
            color: inkAlpha(0.42),
          }}
        >
          {ATTRIBUTIONS.map((line, i) => (
            <span key={line} className="whitespace-nowrap">
              {i > 0 && (
                <span aria-hidden="true" className="mr-4" style={{ color: inkAlpha(0.22) }}>
                  ·
                </span>
              )}
              {line}
            </span>
          ))}
          <span className="whitespace-nowrap">© {year} aram yeghiazaryan</span>
        </footer>
      </div>
    </main>
  )
}
