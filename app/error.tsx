'use client'

/**
 * Root error boundary. The museum's front door must degrade to the printed
 * catalogue, never to the framework's default error screen — a rejected
 * museum chunk or a scene crash lands here.
 */
export default function RootError({ reset }: { error: Error; reset: () => void }) {
  return (
    <main
      className="grid min-h-screen place-items-center bg-[#1e0b10] px-6 text-center text-[#efe8da]"
      style={{ fontFamily: "Georgia, 'Times New Roman', serif" }}
    >
      <div>
        <p className="font-mono text-[11px] uppercase tracking-[0.3em] text-[#d6b968]">
          Museum of Experiments
        </p>
        <h1 className="mt-3 text-2xl font-bold">The gallery hit a snag</h1>
        <p className="mt-2 text-sm italic text-[#cfc5b2]">
          The collection is still available in print.
        </p>
        <div className="mt-6 flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={reset}
            className="rounded-full border border-[#8a6a24] bg-gradient-to-b from-[#d6b968] to-[#b08d3f] px-5 py-2 font-mono text-xs uppercase tracking-[0.2em] text-[#1e0b10]"
          >
            Try again
          </button>
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages -- deliberate
              hard navigation: the error boundary only resets on pathname change
              (/ → /?view=list is search-only), and a full document load is the
              safest recovery from a poisoned client state */}
          <a
            href="/?view=list"
            className="font-mono text-xs uppercase tracking-[0.2em] text-[#d6b968] underline underline-offset-4"
          >
            View the catalogue
          </a>
        </div>
      </div>
    </main>
  )
}
