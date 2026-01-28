import type { Metadata, Viewport } from 'next'
import { Providers } from './providers'
import '@/lib/fonts'
import './globals.css'

export const metadata: Metadata = {
  title: 'Aram Yeghiazaryan | Senior Frontend Engineer',
  description:
    'Senior Frontend Engineer with 8+ years of experience building exceptional web and mobile applications. Specializing in React, Next.js, and TypeScript.',
  keywords: [
    'Frontend Engineer',
    'React',
    'Next.js',
    'TypeScript',
    'React Native',
    'Technical Lead',
    'Aram Yeghiazaryan',
  ],
  authors: [{ name: 'Aram Yeghiazaryan' }],
  creator: 'Aram Yeghiazaryan',
  openGraph: {
    title: 'Aram Yeghiazaryan | Senior Frontend Engineer',
    description:
      'Senior Frontend Engineer with 8+ years of experience building exceptional web and mobile applications.',
    type: 'website',
    locale: 'en_US',
    siteName: 'Aram Yeghiazaryan Portfolio',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Aram Yeghiazaryan | Senior Frontend Engineer',
    description:
      'Senior Frontend Engineer with 8+ years of experience building exceptional web and mobile applications.',
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
    { media: '(prefers-color-scheme: light)', color: '#fafafa' },
    { media: '(prefers-color-scheme: dark)', color: '#131316' },
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
