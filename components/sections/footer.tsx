'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Github, Linkedin, ArrowUp } from 'lucide-react'
import { siteConfig, socialLinks } from '@/lib/constants'
import { cn } from '@/lib/utils'

const iconMap: Record<string, typeof Github> = {
  github: Github,
  linkedin: Linkedin,
}

const navLinks = [
  { label: 'About', href: '#about' },
  { label: 'Skills', href: '#skills' },
  { label: 'Experience', href: '#experience' },
  { label: 'Projects', href: '#projects' },
  { label: 'Contact', href: '#contact' },
]

type Era = 'modern' | '90s' | '2000s'

const eraConfig = {
  modern: {
    year: new Date().getFullYear(),
    message: null,
  },
  '90s': {
    year: 1999,
    message: '🚧 Under Construction! Best viewed in Netscape Navigator 🚧',
  },
  '2000s': {
    year: 2005,
    message: '✨ Web 2.0 Edition ✨',
  },
}

export function Footer() {
  const [yearClicks, setYearClicks] = useState(0)
  const [era, setEra] = useState<Era>('modern')

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const handleYearClick = () => {
    const newClicks = yearClicks + 1
    setYearClicks(newClicks)

    if (newClicks >= 5) {
      // Cycle through eras
      const nextEra: Era = era === 'modern' ? '90s' : era === '90s' ? '2000s' : 'modern'
      setEra(nextEra)
      setYearClicks(0)

      console.log(
        `%c ⏰ Time traveling to ${nextEra === 'modern' ? 'the present' : `the ${nextEra}`}... `,
        'color: #b0563d; font-style: italic; font-size: 14px;'
      )
    }
  }

  return (
    <footer
      className={cn(
        'py-12 border-t transition-all duration-500',
        era === '90s' && 'bg-gradient-to-r from-fuchsia-500 via-cyan-400 to-yellow-400',
        era === '2000s' && 'bg-gradient-to-b from-blue-600 to-blue-800 text-white',
        era === 'modern' && 'bg-muted/30 border-border'
      )}
      style={era === '90s' ? { fontFamily: 'Comic Sans MS, cursive' } : undefined}
    >
      <div className="section-container">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8">
          {/* Logo/Name */}
          <div className="text-center md:text-left">
            <p className="text-xl font-bold">{siteConfig.name}</p>
            <p className="text-sm text-muted-foreground">{siteConfig.title}</p>
          </div>

          {/* Navigation */}
          <nav
            className="flex flex-wrap items-center justify-center gap-6"
            aria-label="Footer navigation"
          >
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="text-sm text-muted-foreground hover:text-primary transition-colors"
              >
                {link.label}
              </a>
            ))}
          </nav>

          {/* Social links */}
          <div className="flex items-center gap-3">
            {socialLinks.map((link) => {
              const Icon = iconMap[link.icon] || Github
              return (
                <motion.a
                  key={link.name}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.95 }}
                  className="h-9 w-9 rounded-lg bg-card border border-border flex items-center justify-center text-muted-foreground hover:text-primary hover:border-primary/50 transition-colors"
                  aria-label={link.name}
                >
                  <Icon className="h-4 w-4" />
                </motion.a>
              )
            })}
            <motion.button
              onClick={scrollToTop}
              whileHover={{ scale: 1.1, y: -2 }}
              whileTap={{ scale: 0.95 }}
              className="h-9 w-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center"
              aria-label="Scroll to top"
            >
              <ArrowUp className="h-4 w-4" />
            </motion.button>
          </div>
        </div>

        {/* Copyright */}
        <div className={cn(
          'mt-8 pt-8 border-t text-center',
          era === '90s' && 'border-yellow-400',
          era === '2000s' && 'border-blue-400/50',
          era === 'modern' && 'border-border'
        )}>
          <p className={cn(
            'text-xs mt-2',
            era === '90s' && 'text-black',
            era === '2000s' && 'text-blue-200',
            era === 'modern' && 'text-muted-foreground'
          )}>
            &copy;{' '}
            <motion.span
              onClick={handleYearClick}
              className="cursor-pointer hover:text-primary transition-colors inline-block"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              {eraConfig[era].year}
            </motion.span>{' '}
            {siteConfig.name}. All rights reserved.
          </p>

          {/* Era message */}
          <AnimatePresence>
            {eraConfig[era].message && (
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className={cn(
                  'text-xs mt-3 font-medium',
                  era === '90s' && 'text-black animate-pulse',
                  era === '2000s' && 'text-blue-100'
                )}
              >
                {eraConfig[era].message}
              </motion.p>
            )}
          </AnimatePresence>
        </div>
      </div>
    </footer>
  )
}
