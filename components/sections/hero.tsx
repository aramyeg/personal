'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowDown } from 'lucide-react'
import { TextReveal, Typewriter, FloatingIcons } from '@/components/animation'
import { siteConfig } from '@/lib/constants'

const taglines = [
  'Building exceptional web experiences',
  'From fintech to proptech and beyond',
  'React, TypeScript, Next.js enthusiast',
  'Remote-first, globally connected',
]

export function Hero() {
  return (
    <section className="relative min-h-screen flex flex-col items-center justify-center px-6 overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent" />
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-accent/10 rounded-full blur-3xl" />
        {/* Additional subtle gradient orbs */}
        <motion.div
          className="absolute top-1/3 right-1/3 w-64 h-64 bg-accent/5 rounded-full blur-3xl"
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      {/* Floating tech icons around avatar */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 1 }}
      >
        <FloatingIcons className="absolute inset-0 hidden sm:block" />
      </motion.div>

      {/* Pixelated Avatar */}
      <motion.div
        className="relative mb-8 z-10"
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
        className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-center z-10"
        delay={0.3}
      />

      {/* Title */}
      <motion.p
        className="mt-4 text-lg sm:text-xl md:text-2xl text-muted-foreground text-center z-10"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.8 }}
      >
        {siteConfig.title}
      </motion.p>

      {/* Animated Tagline with Typewriter */}
      <motion.div
        className="mt-3 h-8 text-sm sm:text-base text-muted-foreground/70 text-center max-w-md z-10"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.5, delay: 1.1 }}
      >
        <Typewriter texts={taglines} typingSpeed={40} deletingSpeed={25} pauseDuration={2500} />
      </motion.div>

      {/* Experience badge */}
      <motion.div
        className="mt-4 px-4 py-1.5 rounded-full bg-muted/50 border border-border z-10"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 1.2 }}
      >
        <span className="text-sm text-muted-foreground">
          8+ years of frontend expertise
        </span>
      </motion.div>

      {/* Status badge */}
      <motion.div
        className="mt-4 flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 z-10"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, delay: 1.4 }}
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
  const [isBlinking, setIsBlinking] = useState(false)

  // Blink animation every 3-5 seconds
  useEffect(() => {
    const blink = () => {
      setIsBlinking(true)
      setTimeout(() => setIsBlinking(false), 150)
    }
    const interval = setInterval(() => {
      blink()
    }, 3000 + Math.random() * 2000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div className="relative">
      {/* Glow effect */}
      <div className="absolute inset-0 bg-primary/20 blur-2xl rounded-full scale-150" />

      {/* Floating avatar container with idle animation */}
      <motion.div
        animate={{
          y: [0, -8, 0],
        }}
        transition={{
          duration: 4,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      >
        {/* Avatar container with pixel art style */}
        <motion.div
          className="relative w-32 h-32 sm:w-40 sm:h-40 rounded-2xl overflow-hidden border-4 border-primary/30"
          style={{ imageRendering: 'pixelated' }}
          animate={{
            scale: [1, 1.02, 1],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          {/* Pixel grid background */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-accent/20" />

          {/* Pixel art avatar */}
          <svg
            viewBox="0 0 16 20"
            className="w-full h-full"
            style={{ imageRendering: 'pixelated' }}
          >
            {/* Background */}
            <rect width="16" height="20" fill="currentColor" className="text-card" />

            {/* Hair - Full head with man-bun at back */}
            {/* Top of head hair */}
            <rect x="4" y="1" width="8" height="1" className="fill-foreground" />
            <rect x="3" y="2" width="10" height="1" className="fill-foreground" />
            <rect x="3" y="3" width="2" height="1" className="fill-foreground" />
            <rect x="11" y="3" width="2" height="1" className="fill-foreground" />
            {/* Man-bun gathered at back-top */}
            <rect x="11" y="1" width="2" height="3" className="fill-foreground" />
            <rect x="12" y="0" width="2" height="2" className="fill-foreground" />
            <rect x="13" y="2" width="1" height="2" className="fill-foreground" />

            {/* Face - Skin tone */}
            <rect x="4" y="3" width="7" height="5" className="fill-amber-200 dark:fill-amber-100" />
            <rect x="5" y="8" width="5" height="1" className="fill-amber-200 dark:fill-amber-100" />

            {/* Eyes - with blink animation */}
            <AnimatePresence mode="wait">
              {isBlinking ? (
                <>
                  <rect x="5" y="5" width="2" height="1" className="fill-foreground/40" />
                  <rect x="9" y="5" width="2" height="1" className="fill-foreground/40" />
                </>
              ) : (
                <>
                  <rect x="5" y="5" width="2" height="2" className="fill-foreground" />
                  <rect x="9" y="5" width="2" height="2" className="fill-foreground" />
                  {/* Eye shine */}
                  <rect x="5" y="5" width="1" height="1" className="fill-white/50" />
                  <rect x="9" y="5" width="1" height="1" className="fill-white/50" />
                </>
              )}
            </AnimatePresence>

            {/* Eyebrows */}
            <rect x="5" y="4" width="2" height="1" className="fill-foreground/60" />
            <rect x="9" y="4" width="2" height="1" className="fill-foreground/60" />

            {/* Nose */}
            <rect x="7" y="6" width="1" height="1" className="fill-amber-300/50 dark:fill-amber-200/50" />

            {/* Friendly smile */}
            <rect x="6" y="7" width="3" height="1" className="fill-foreground/40" />

            {/* Neck */}
            <rect x="6" y="9" width="3" height="1" className="fill-amber-200 dark:fill-amber-100" />

            {/* T-shirt - Black in light mode, off-white in dark mode */}
            {/* Main torso */}
            <rect x="2" y="10" width="11" height="5" className="fill-gray-900 dark:fill-stone-200" />
            {/* Collar detail */}
            <rect x="6" y="10" width="3" height="1" className="fill-gray-800 dark:fill-stone-300" />
            {/* Shoulders */}
            <rect x="1" y="11" width="1" height="4" className="fill-gray-900 dark:fill-stone-200" />
            <rect x="13" y="11" width="1" height="4" className="fill-gray-900 dark:fill-stone-200" />
            {/* Shirt bottom */}
            <rect x="3" y="15" width="9" height="3" className="fill-gray-900 dark:fill-stone-200" />

            {/* Arms - muscular */}
            <rect x="0" y="11" width="1" height="5" className="fill-amber-200 dark:fill-amber-100" />
            <rect x="14" y="11" width="1" height="5" className="fill-amber-200 dark:fill-amber-100" />
            {/* Bicep detail */}
            <rect x="0" y="12" width="1" height="2" className="fill-amber-300/50 dark:fill-amber-200/50" />
            <rect x="14" y="12" width="1" height="2" className="fill-amber-300/50 dark:fill-amber-200/50" />

            {/* Pants/bottom hint */}
            <rect x="4" y="18" width="3" height="2" className="fill-slate-700 dark:fill-slate-600" />
            <rect x="8" y="18" width="3" height="2" className="fill-slate-700 dark:fill-slate-600" />
          </svg>
        </motion.div>
      </motion.div>

      {/* Floating code symbols with enhanced animations */}
      <motion.span
        className="absolute -top-4 -right-6 text-2xl font-mono text-primary/80"
        animate={{ y: [0, -8, 0], rotate: [0, 15, 0], opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        {'</>'}
      </motion.span>
      <motion.span
        className="absolute -bottom-4 -left-6 text-xl font-mono text-accent"
        animate={{ y: [0, 8, 0], rotate: [0, -15, 0], opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 2.5, repeat: Infinity, delay: 0.5, ease: 'easeInOut' }}
      >
        {'{ }'}
      </motion.span>
      <motion.span
        className="absolute top-1/2 -right-8 text-lg font-mono text-muted-foreground"
        animate={{ x: [0, 5, 0], opacity: [0.4, 0.8, 0.4] }}
        transition={{ duration: 4, repeat: Infinity, delay: 1, ease: 'easeInOut' }}
      >
        {'( )'}
      </motion.span>
      <motion.span
        className="absolute top-1/3 -left-8 text-sm font-mono text-primary/60"
        animate={{ y: [0, -6, 0], opacity: [0.3, 0.7, 0.3] }}
        transition={{ duration: 3.5, repeat: Infinity, delay: 0.8, ease: 'easeInOut' }}
      >
        {'=>'}
      </motion.span>
    </div>
  )
}
