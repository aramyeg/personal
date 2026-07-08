import Link from 'next/link'
import { ArrowLeft, ArrowUpRight } from 'lucide-react'
import { labs } from '@/lib/labs-manifest'

/** The simplified list view of all Style Lab experiments. */
export function LabsList() {
  return (
    <div className="section-container py-16 sm:py-24 max-w-3xl">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-12"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to the main site
      </Link>

      <h1 className="text-4xl sm:text-5xl font-bold tracking-tight mb-4">Style Lab</h1>
      <div className="h-1 w-12 bg-primary rounded-full mb-6" />

      <p className="text-muted-foreground leading-relaxed max-w-xl mb-12">
        One portfolio, many design systems. Every experiment here re-skins the
        same content — my actual work and experience — in a completely different
        visual identity. Some are full sites, some are single scenes, some are
        games. New entries ship regularly.
      </p>

      <div className="space-y-4">
        {labs.map((lab) => (
          <Link
            key={lab.slug}
            href={lab.href ?? `/labs/${lab.slug}`}
            className="group flex items-start gap-5 p-5 rounded-2xl bg-card border border-border hover:border-primary/50 transition-colors"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`/labs/${lab.slug}/poster.jpg`}
              alt={`${lab.title} poster`}
              width={72}
              height={96}
              loading="lazy"
              className="h-24 w-18 shrink-0 rounded-md object-cover border border-border"
            />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3 flex-wrap">
                <h2 className="text-xl font-bold group-hover:text-primary transition-colors">
                  {lab.title}
                </h2>
                <span className="text-xs text-muted-foreground font-mono">{lab.date}</span>
                {lab.status === 'wip' && (
                  <span className="px-2 py-0.5 rounded-full bg-muted text-xs text-muted-foreground">
                    In progress
                  </span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-2 max-w-lg">{lab.thesis}</p>
            </div>
            <ArrowUpRight className="h-5 w-5 shrink-0 text-muted-foreground group-hover:text-primary transition-colors mt-1" />
          </Link>
        ))}
      </div>
    </div>
  )
}
