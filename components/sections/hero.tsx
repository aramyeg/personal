'use client'

import { motion } from 'framer-motion'
import { ArrowDown } from 'lucide-react'
import { TextReveal } from '@/components/animation'
import { siteConfig } from '@/lib/constants'

export function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-6">
      {/* Background gradient */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
      </div>

      {/* Pixelated Avatar */}
      <motion.div
        className="relative mb-8"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1] }}
      >
        <PixelAvatar />
      </motion.div>

      {/* Name */}
      <TextReveal
        text={siteConfig.name}
        as="h1"
        className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-center"
        delay={0.3}
      />

      {/* Title */}
      <motion.p
        className="mt-4 text-lg sm:text-xl md:text-2xl text-muted-foreground text-center"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.8 }}
      >
        {siteConfig.title}
      </motion.p>

      {/* Tagline */}
      <motion.p
        className="mt-2 text-sm sm:text-base text-muted-foreground/70 text-center max-w-md"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 1.1 }}
      >
        8+ years crafting exceptional web & mobile experiences
      </motion.p>

      {/* Status badge */}
      <motion.div
        className="mt-6 flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, delay: 1.3 }}
      >
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
        </span>
        <span className="text-sm text-primary font-medium">
          Available for opportunities
        </span>
      </motion.div>

      {/* Scroll indicator */}
      <motion.a
        href="#about"
        className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 1.5 }}
        onClick={(e) => {
          e.preventDefault()
          document.querySelector('#about')?.scrollIntoView({ behavior: 'smooth' })
        }}
      >
        <span className="text-xs uppercase tracking-widest">Scroll</span>
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
        >
          <ArrowDown className="h-4 w-4" />
        </motion.div>
      </motion.a>
    </section>
  )
}

function PixelAvatar() {
  // 8-bit style avatar - buff figure with man-bun
  // Using CSS to create a pixelated effect
  return (
    <div className="relative">
      {/* Glow effect */}
      <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full scale-150" />

      {/* Avatar container with pixel art style */}
      <div
        className="relative w-32 h-32 sm:w-40 sm:h-40 rounded-2xl overflow-hidden border-4 border-primary/30"
        style={{ imageRendering: 'pixelated' }}
      >
        {/* Pixel grid background */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/20" />

        {/* Simplified pixel art representation */}
        <svg
          viewBox="0 0 16 16"
          className="w-full h-full"
          style={{ imageRendering: 'pixelated' }}
        >
          {/* Background */}
          <rect width="16" height="16" fill="currentColor" className="text-card" />

          {/* Man-bun */}
          <rect x="6" y="1" width="4" height="2" className="fill-foreground" />
          <rect x="7" y="0" width="2" height="1" className="fill-foreground" />

          {/* Head */}
          <rect x="5" y="3" width="6" height="5" className="fill-amber-200 dark:fill-amber-100" />

          {/* Hair sides */}
          <rect x="4" y="3" width="1" height="3" className="fill-foreground" />
          <rect x="11" y="3" width="1" height="3" className="fill-foreground" />

          {/* Eyes */}
          <rect x="6" y="5" width="1" height="1" className="fill-foreground" />
          <rect x="9" y="5" width="1" height="1" className="fill-foreground" />

          {/* Smile */}
          <rect x="7" y="6" width="2" height="1" className="fill-foreground/50" />

          {/* Neck */}
          <rect x="7" y="8" width="2" height="1" className="fill-amber-200 dark:fill-amber-100" />

          {/* Shoulders/Body (buff) */}
          <rect x="3" y="9" width="10" height="4" className="fill-primary" />
          <rect x="2" y="10" width="1" height="3" className="fill-primary" />
          <rect x="13" y="10" width="1" height="3" className="fill-primary" />

          {/* Arms (muscular) */}
          <rect x="1" y="10" width="1" height="4" className="fill-amber-200 dark:fill-amber-100" />
          <rect x="14" y="10" width="1" height="4" className="fill-amber-200 dark:fill-amber-100" />

          {/* Torso */}
          <rect x="5" y="13" width="6" height="3" className="fill-primary" />
        </svg>
      </div>

      {/* Floating code symbols */}
      <motion.span
        className="absolute -top-2 -right-4 text-2xl"
        animate={{ y: [0, -5, 0], rotate: [0, 10, 0] }}
        transition={{ duration: 3, repeat: Infinity }}
      >
        {'</>'}
      </motion.span>
      <motion.span
        className="absolute -bottom-2 -left-4 text-xl text-primary"
        animate={{ y: [0, 5, 0], rotate: [0, -10, 0] }}
        transition={{ duration: 2.5, repeat: Infinity, delay: 0.5 }}
      >
        {'{ }'}
      </motion.span>
    </div>
  )
}
