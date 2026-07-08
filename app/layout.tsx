import type { Metadata, Viewport } from 'next'
import { Providers } from './providers'
import '@/lib/fonts'
import './globals.css'

export const metadata: Metadata = {
  title: 'Aram Yeghiazaryan | Senior Frontend Engineer',
  description:
    'Senior Frontend Engineer building the frontend of AMIO Bank’s retail banking platform. Eight years of fintech and enterprise work with React, Next.js, and TypeScript.',
  keywords: [
    'Frontend Engineer',
    'React',
    'Next.js',
    'TypeScript',
    'React Native',
    'Aram Yeghiazaryan',
  ],
  authors: [{ name: 'Aram Yeghiazaryan' }],
  creator: 'Aram Yeghiazaryan',
  openGraph: {
    title: 'Aram Yeghiazaryan | Senior Frontend Engineer',
    description:
      'Senior Frontend Engineer building the frontend of AMIO Bank’s retail banking platform.',
    type: 'website',
    locale: 'en_US',
    siteName: 'Aram Yeghiazaryan Portfolio',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Aram Yeghiazaryan | Senior Frontend Engineer',
    description:
      'Senior Frontend Engineer building the frontend of AMIO Bank’s retail banking platform.',
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-video-preview': -1,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#faf8f5' },
    { media: '(prefers-color-scheme: dark)', color: '#1a1816' },
  ],
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-screen font-sans antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
