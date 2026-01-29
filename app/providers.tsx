'use client'

import { ThemeProvider } from 'next-themes'
import type { ReactNode } from 'react'
import { EasterEggProvider } from '@/components/easter-egg-provider'

type ProvidersProps = {
  children: ReactNode
}

export function Providers({ children }: ProvidersProps) {
  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange={false}
    >
      <EasterEggProvider>{children}</EasterEggProvider>
    </ThemeProvider>
  )
}
