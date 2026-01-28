import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Aram Yeghiazaryan | Senior Frontend Engineer',
  description: 'Senior Frontend Engineer with 8+ years of experience building exceptional web and mobile applications. Specializing in React, Next.js, and TypeScript.',
  keywords: ['Frontend Engineer', 'React', 'Next.js', 'TypeScript', 'React Native', 'Technical Lead'],
  authors: [{ name: 'Aram Yeghiazaryan' }],
  openGraph: {
    title: 'Aram Yeghiazaryan | Senior Frontend Engineer',
    description: 'Senior Frontend Engineer with 8+ years of experience building exceptional web and mobile applications.',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Aram Yeghiazaryan | Senior Frontend Engineer',
    description: 'Senior Frontend Engineer with 8+ years of experience building exceptional web and mobile applications.',
  },
  robots: {
    index: true,
    follow: true,
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">
        {children}
      </body>
    </html>
  )
}
