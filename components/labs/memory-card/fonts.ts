/**
 * Fonts for the Memory Card lab, self-hosted at build time via
 * `next/font/google` — zero new packages. Kept separate from `tokens.ts` so
 * the pure token module stays importable in jsdom without pulling in
 * `next/font` machinery; components import both.
 */
import { Anton, Space_Grotesk } from 'next/font/google'

export const anton = Anton({ weight: '400', subsets: ['latin'], display: 'swap' })
export const grotesk = Space_Grotesk({ subsets: ['latin'], display: 'swap' })

/** Mono comes from the globally-loaded fontsource JetBrains Mono (see `lib/fonts.ts`) — no new font here. */
export const monoFamily = 'JetBrains Mono Variable, JetBrains Mono, ui-monospace, monospace'
