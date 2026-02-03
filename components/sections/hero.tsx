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
        className="absolute inset-0 pointer-events-none z-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1, duration: 1 }}
      >
        <FloatingIcons className="absolute inset-0 hidden sm:block opacity-60" />
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

// Pixel particle component for floating sparkles
function PixelParticle({ delay, x, y }: { delay: number; x: number; y: number }) {
  return (
    <motion.div
      className="absolute w-1 h-1 bg-primary/60 dark:bg-primary/80"
      style={{ left: `${x}%`, top: `${y}%` }}
      initial={{ opacity: 0, scale: 0 }}
      animate={{
        opacity: [0, 1, 1, 0],
        scale: [0, 1, 1, 0],
        y: [0, -20, -40, -60],
      }}
      transition={{
        duration: 3,
        delay,
        repeat: Infinity,
        ease: 'easeOut',
      }}
    />
  )
}

function PixelAvatar() {
  const [isBlinking, setIsBlinking] = useState(false)
  const [eyeDirection, setEyeDirection] = useState<'center' | 'left' | 'right'>('center')
  const [clickCount, setClickCount] = useState(0)
  const [showMessage, setShowMessage] = useState<string | null>(null)
  const [isHovered, setIsHovered] = useState(false)

  const clickMessages = [
    '',
    '',
    '',
    'Hey there! 👋',
    'You found me!',
    'Still clicking?',
    "You're persistent! 😄",
    'Okay okay, here is a cookie 🍪',
    'Achievement unlocked: Avatar Clicker!',
    '🎉 You win the clicking game! 🎉',
  ]

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

  // Eye movement - occasionally look left or right
  useEffect(() => {
    const lookAround = () => {
      const directions: ('center' | 'left' | 'right')[] = ['center', 'left', 'right', 'center', 'center']
      const randomDirection = directions[Math.floor(Math.random() * directions.length)]
      setEyeDirection(randomDirection)
      setTimeout(() => setEyeDirection('center'), 800 + Math.random() * 400)
    }
    const interval = setInterval(lookAround, 4000 + Math.random() * 3000)
    return () => clearInterval(interval)
  }, [])

  const handleClick = () => {
    const newCount = clickCount + 1
    setClickCount(newCount)
    if (newCount >= 3 && newCount < clickMessages.length) {
      setShowMessage(clickMessages[newCount])
      setTimeout(() => setShowMessage(null), 2000)
    }
  }

  // Eye position offsets based on direction
  const eyeOffset = eyeDirection === 'left' ? -1 : eyeDirection === 'right' ? 1 : 0

  // Generate particle positions
  const particles = [
    { delay: 0, x: 10, y: 80 },
    { delay: 0.5, x: 85, y: 70 },
    { delay: 1, x: 20, y: 60 },
    { delay: 1.5, x: 75, y: 85 },
    { delay: 2, x: 50, y: 90 },
    { delay: 2.5, x: 30, y: 75 },
  ]

  return (
    <div
      className="relative cursor-pointer"
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Click message */}
      <AnimatePresence>
        {showMessage && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.8 }}
            animate={{ opacity: 1, y: -20, scale: 1 }}
            exit={{ opacity: 0, y: -40 }}
            className="absolute -top-16 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-medium whitespace-nowrap z-50"
          >
            {showMessage}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Multi-layer glow effect */}
      <motion.div
        className="absolute inset-0 rounded-full scale-150"
        animate={{
          opacity: isHovered ? [0.4, 0.6, 0.4] : [0.2, 0.35, 0.2],
        }}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div className="absolute inset-0 bg-primary/30 blur-3xl rounded-full" />
        <div className="absolute inset-2 bg-accent/20 blur-2xl rounded-full" />
      </motion.div>

      {/* Floating pixel particles */}
      <div className="absolute inset-0 overflow-visible pointer-events-none">
        {particles.map((p, i) => (
          <PixelParticle key={i} delay={p.delay} x={p.x} y={p.y} />
        ))}
      </div>

      {/* Floating avatar container with breathing animation */}
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
          className="relative w-32 h-32 sm:w-40 sm:h-40 rounded-2xl overflow-hidden"
          style={{ imageRendering: 'pixelated' }}
          animate={{
            scale: isHovered ? [1.02, 1.05, 1.02] : [1, 1.02, 1],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        >
          {/* Animated border glow */}
          <motion.div
            className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-primary via-accent to-primary opacity-70 dark:opacity-50"
            animate={{
              backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
            }}
            transition={{ duration: 5, repeat: Infinity, ease: 'linear' }}
            style={{ backgroundSize: '200% 200%' }}
          />

          {/* Inner container */}
          <div className="absolute inset-1 rounded-xl overflow-hidden bg-card">
            {/* Animated gradient background */}
            <motion.div
              className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10 dark:from-primary/20 dark:to-accent/20"
              animate={{
                opacity: [0.5, 0.8, 0.5],
              }}
              transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
            />

            {/* Scanline effect overlay */}
            <div
              className="absolute inset-0 pointer-events-none opacity-[0.03] dark:opacity-[0.05]"
              style={{
                backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, currentColor 2px, currentColor 4px)',
              }}
            />

            {/* Pixel art avatar - Enhanced 16x20 grid */}
            <svg
              viewBox="0 0 16 20"
              className="w-full h-full relative z-10"
              style={{ imageRendering: 'pixelated' }}
            >
              {/* Background with subtle gradient */}
              <defs>
                <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" className="[stop-color:hsl(var(--card))]" />
                  <stop offset="100%" className="[stop-color:hsl(var(--muted))]" />
                </linearGradient>
                <linearGradient id="hairGradientLight" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#292524" />
                  <stop offset="100%" stopColor="#44403c" />
                </linearGradient>
                <linearGradient id="hairGradientDark" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#a8a29e" />
                  <stop offset="100%" stopColor="#78716c" />
                </linearGradient>
                <linearGradient id="skinGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                  <stop offset="0%" stopColor="#fde68a" />
                  <stop offset="50%" stopColor="#fcd34d" />
                  <stop offset="100%" stopColor="#f59e0b" />
                </linearGradient>
              </defs>

              <rect width="16" height="20" fill="url(#bgGradient)" />

              {/* === HAIR - Rich brown tones with highlights === */}
              {/* Man-bun highlight */}
              <rect x="7" y="0" width="2" height="1" className="fill-stone-500 dark:fill-stone-300" />
              {/* Man-bun */}
              <rect x="6" y="0" width="4" height="1" className="fill-stone-700 dark:fill-stone-400" />
              <rect x="5" y="1" width="6" height="1" className="fill-stone-700 dark:fill-stone-400" />
              <rect x="6" y="1" width="2" height="1" className="fill-stone-600 dark:fill-stone-300" />

              {/* Top of head - layered shading */}
              <rect x="3" y="2" width="10" height="1" className="fill-stone-800 dark:fill-stone-400" />
              <rect x="4" y="2" width="3" height="1" className="fill-stone-600 dark:fill-stone-300" />
              <rect x="3" y="3" width="10" height="1" className="fill-stone-700 dark:fill-stone-400" />
              <rect x="5" y="3" width="2" height="1" className="fill-stone-500 dark:fill-stone-300" />

              {/* Side hair - with depth */}
              <rect x="2" y="3" width="1" height="6" className="fill-stone-800 dark:fill-stone-500" />
              <rect x="3" y="4" width="1" height="5" className="fill-stone-700 dark:fill-stone-400" />
              <rect x="12" y="4" width="1" height="5" className="fill-stone-700 dark:fill-stone-400" />
              <rect x="13" y="3" width="1" height="6" className="fill-stone-800 dark:fill-stone-500" />
              {/* Hair shine */}
              <rect x="2" y="4" width="1" height="1" className="fill-stone-500 dark:fill-stone-300" />
              <rect x="13" y="4" width="1" height="1" className="fill-stone-500 dark:fill-stone-300" />

              {/* === FACE - Warm skin tones with shading === */}
              {/* Base skin */}
              <rect x="4" y="4" width="8" height="5" className="fill-amber-200 dark:fill-amber-200" />
              {/* Forehead highlight */}
              <rect x="6" y="4" width="4" height="1" className="fill-amber-100 dark:fill-amber-100" />
              {/* Cheek blush */}
              <rect x="4" y="6" width="1" height="2" className="fill-rose-200/50 dark:fill-rose-300/40" />
              <rect x="11" y="6" width="1" height="2" className="fill-rose-200/50 dark:fill-rose-300/40" />
              {/* Jaw shadow */}
              <rect x="4" y="8" width="8" height="1" className="fill-amber-300/70 dark:fill-amber-300/70" />

              {/* Forehead hair strands */}
              <rect x="4" y="4" width="2" height="1" className="fill-stone-700 dark:fill-stone-500" />
              <rect x="10" y="4" width="2" height="1" className="fill-stone-700 dark:fill-stone-500" />

              {/* Eyebrows - expressive */}
              <rect x="5" y="4" width="2" height="1" className="fill-stone-700 dark:fill-stone-600" />
              <rect x="9" y="4" width="2" height="1" className="fill-stone-700 dark:fill-stone-600" />

              {/* === EYES - with direction and blink === */}
              <AnimatePresence mode="wait">
                {isBlinking ? (
                  <>
                    {/* Closed eyes */}
                    <rect x="5" y="6" width="2" height="1" className="fill-stone-800 dark:fill-stone-700" />
                    <rect x="9" y="6" width="2" height="1" className="fill-stone-800 dark:fill-stone-700" />
                  </>
                ) : (
                  <>
                    {/* Eye whites */}
                    <rect x="5" y="5" width="2" height="2" className="fill-white dark:fill-gray-100" />
                    <rect x="9" y="5" width="2" height="2" className="fill-white dark:fill-gray-100" />
                    {/* Pupils - move based on direction */}
                    <rect
                      x={5 + eyeOffset}
                      y="5"
                      width="2"
                      height="2"
                      className="fill-stone-900 dark:fill-stone-800"
                    />
                    <rect
                      x={9 + eyeOffset}
                      y="5"
                      width="2"
                      height="2"
                      className="fill-stone-900 dark:fill-stone-800"
                    />
                    {/* Eye shine */}
                    <rect
                      x={5 + eyeOffset}
                      y="5"
                      width="1"
                      height="1"
                      className="fill-white"
                    />
                    <rect
                      x={9 + eyeOffset}
                      y="5"
                      width="1"
                      height="1"
                      className="fill-white"
                    />
                  </>
                )}
              </AnimatePresence>

              {/* Nose - subtle shadow */}
              <rect x="7" y="7" width="2" height="1" className="fill-amber-300/60 dark:fill-amber-400/50" />

              {/* Mouth - friendly expression */}
              <rect x="6" y="8" width="4" height="1" className="fill-rose-400/70 dark:fill-rose-300/70" />
              <rect x="7" y="8" width="2" height="1" className="fill-rose-500/60 dark:fill-rose-400/60" />

              {/* === NECK === */}
              <rect x="6" y="9" width="4" height="1" className="fill-amber-200 dark:fill-amber-200" />
              {/* Neck shadow */}
              <rect x="6" y="9" width="1" height="1" className="fill-amber-300/60 dark:fill-amber-300/60" />
              <rect x="9" y="9" width="1" height="1" className="fill-amber-300/60 dark:fill-amber-300/60" />

              {/* === T-SHIRT - with folds and shading === */}
              {/* Main shirt body - inverts for theme */}
              <rect x="2" y="10" width="12" height="5" className="fill-stone-900 dark:fill-stone-100" />
              {/* Shirt highlights */}
              <rect x="4" y="11" width="2" height="3" className="fill-stone-800 dark:fill-stone-200" />
              <rect x="10" y="11" width="2" height="3" className="fill-stone-800 dark:fill-stone-200" />
              {/* Shirt shadows/folds */}
              <rect x="6" y="12" width="1" height="2" className="fill-stone-950 dark:fill-stone-50" />
              <rect x="9" y="12" width="1" height="2" className="fill-stone-950 dark:fill-stone-50" />
              {/* Collar V-neck with depth */}
              <rect x="7" y="10" width="2" height="1" className="fill-amber-200 dark:fill-amber-200" />
              <rect x="7" y="11" width="2" height="1" className="fill-stone-800 dark:fill-stone-200" />
              {/* Shoulders */}
              <rect x="1" y="11" width="1" height="4" className="fill-stone-900 dark:fill-stone-100" />
              <rect x="14" y="11" width="1" height="4" className="fill-stone-900 dark:fill-stone-100" />
              {/* Shirt bottom */}
              <rect x="3" y="15" width="10" height="3" className="fill-stone-900 dark:fill-stone-100" />
              <rect x="5" y="15" width="2" height="2" className="fill-stone-800 dark:fill-stone-200" />
              <rect x="9" y="15" width="2" height="2" className="fill-stone-800 dark:fill-stone-200" />

              {/* === ARMS === */}
              <rect x="0" y="11" width="1" height="5" className="fill-amber-200 dark:fill-amber-200" />
              <rect x="15" y="11" width="1" height="5" className="fill-amber-200 dark:fill-amber-200" />
              {/* Arm shadows */}
              <rect x="0" y="14" width="1" height="2" className="fill-amber-300/70 dark:fill-amber-300/70" />
              <rect x="15" y="14" width="1" height="2" className="fill-amber-300/70 dark:fill-amber-300/70" />

              {/* === PANTS === */}
              <rect x="4" y="18" width="3" height="2" className="fill-slate-700 dark:fill-slate-500" />
              <rect x="9" y="18" width="3" height="2" className="fill-slate-700 dark:fill-slate-500" />
              {/* Pants highlights */}
              <rect x="5" y="18" width="1" height="1" className="fill-slate-600 dark:fill-slate-400" />
              <rect x="10" y="18" width="1" height="1" className="fill-slate-600 dark:fill-slate-400" />
            </svg>
          </div>
        </motion.div>
      </motion.div>

      {/* Reflection/shadow below */}
      <motion.div
        className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-24 sm:w-32 h-4 bg-gradient-to-t from-transparent via-primary/10 to-transparent rounded-full blur-sm"
        animate={{
          scaleX: [1, 1.1, 1],
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Floating code symbols - enhanced with glow */}
      <motion.span
        className="absolute -top-2 -right-12 text-2xl font-mono text-primary drop-shadow-[0_0_8px_hsl(var(--primary)/0.5)]"
        animate={{
          y: [0, -8, 0],
          rotate: [0, 10, 0],
          opacity: [0.6, 1, 0.6],
        }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      >
        {'</>'}
      </motion.span>
      <motion.span
        className="absolute top-1/2 -left-14 text-xl font-mono text-accent drop-shadow-[0_0_8px_hsl(var(--accent)/0.5)]"
        animate={{
          x: [0, -5, 0],
          rotate: [0, -10, 0],
          opacity: [0.6, 1, 0.6],
        }}
        transition={{ duration: 2.5, repeat: Infinity, delay: 0.5, ease: 'easeInOut' }}
      >
        {'{ }'}
      </motion.span>
      <motion.span
        className="absolute top-1/2 -right-14 text-lg font-mono text-muted-foreground drop-shadow-[0_0_6px_hsl(var(--muted-foreground)/0.3)]"
        animate={{
          x: [0, 5, 0],
          opacity: [0.5, 0.9, 0.5],
        }}
        transition={{ duration: 4, repeat: Infinity, delay: 1, ease: 'easeInOut' }}
      >
        {'( )'}
      </motion.span>
      <motion.span
        className="absolute -bottom-2 -left-12 text-lg font-mono text-primary drop-shadow-[0_0_6px_hsl(var(--primary)/0.4)]"
        animate={{
          y: [0, 6, 0],
          opacity: [0.5, 0.9, 0.5],
        }}
        transition={{ duration: 3.5, repeat: Infinity, delay: 0.8, ease: 'easeInOut' }}
      >
        {'=>'}
      </motion.span>
    </div>
  )
}
