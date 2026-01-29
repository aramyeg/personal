'use client'

import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Mail,
  MapPin,
  Github,
  Linkedin,
  ArrowUpRight,
  Sparkles,
  Heart,
  Zap,
  Star,
  Send,
  MessageCircle,
  Rocket,
} from 'lucide-react'
import { FadeIn } from '@/components/animation'
import { siteConfig, socialLinks } from '@/lib/constants'

const iconMap: Record<string, typeof Github> = {
  github: Github,
  linkedin: Linkedin,
}

const floatingEmojis = ['🚀', '💻', '🎸', '⚡', '✨', '🎯', '💡', '🔥']

const funPhrases = [
  "Let's make something awesome! 🚀",
  "Warning: May contain excessive enthusiasm 🔥",
  "Metal-powered coding sessions 🎸",
  "Ready to turn ideas into reality ✨",
  "Let's build the future together 💡",
]

export function Contact() {
  const [emailHovered, setEmailHovered] = useState(false)
  const [rockClicked, setRockClicked] = useState(0)
  const [showConfetti, setShowConfetti] = useState(false)
  const [currentPhrase, setCurrentPhrase] = useState(0)
  const [powerLevel, setPowerLevel] = useState(0)

  // Rotate fun phrases
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentPhrase((prev) => (prev + 1) % funPhrases.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  // Power level animation
  useEffect(() => {
    const interval = setInterval(() => {
      setPowerLevel((prev) => (prev < 100 ? prev + Math.random() * 10 : 100))
    }, 100)
    if (powerLevel >= 100) clearInterval(interval)
    return () => clearInterval(interval)
  }, [powerLevel])

  const handleRockClick = () => {
    setRockClicked((prev) => prev + 1)
    if (rockClicked === 4) {
      setShowConfetti(true)
      setTimeout(() => setShowConfetti(false), 3000)
    }
  }

  return (
    <section id="contact" className="py-24 sm:py-32 relative overflow-hidden">
      {/* Animated background particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(15)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute text-2xl"
            style={{
              left: `${(i * 7) % 100}%`,
            }}
            initial={{
              y: '100vh',
              opacity: 0,
            }}
            animate={{
              y: '-100px',
              opacity: [0, 0.6, 0],
            }}
            transition={{
              duration: 12 + (i % 5) * 2,
              repeat: Infinity,
              delay: i * 0.8,
              ease: 'linear',
            }}
          >
            {floatingEmojis[i % floatingEmojis.length]}
          </motion.div>
        ))}
      </div>

      {/* Confetti explosion */}
      <AnimatePresence>
        {showConfetti && (
          <div className="fixed inset-0 pointer-events-none z-50">
            {[...Array(50)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-3 h-3 rounded-full"
                style={{
                  background: ['#ff6b6b', '#ffd93d', '#6bcb77', '#4d96ff', '#ff6b9d'][i % 5],
                  left: '50%',
                  top: '50%',
                }}
                initial={{ scale: 0 }}
                animate={{
                  x: (Math.random() - 0.5) * 800,
                  y: (Math.random() - 0.5) * 800,
                  scale: [0, 1, 0],
                  rotate: Math.random() * 720,
                }}
                transition={{ duration: 2, ease: 'easeOut' }}
              />
            ))}
          </div>
        )}
      </AnimatePresence>

      <div className="section-container relative">
        <div className="max-w-4xl mx-auto">
          {/* Dramatic header */}
          <FadeIn>
            <div className="text-center mb-8">
              <motion.div
                className="inline-flex items-center gap-2 px-6 py-2 rounded-full bg-gradient-to-r from-primary/20 via-accent/20 to-primary/20 text-primary font-bold mb-6"
                animate={{
                  boxShadow: [
                    '0 0 20px rgba(var(--primary), 0.3)',
                    '0 0 40px rgba(var(--primary), 0.5)',
                    '0 0 20px rgba(var(--primary), 0.3)',
                  ],
                }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Sparkles className="h-5 w-5" />
                {siteConfig.available ? '🟢 READY TO ROCK!' : 'Currently on a mission'}
                <Sparkles className="h-5 w-5" />
              </motion.div>

              <motion.h2
                className="text-4xl sm:text-5xl lg:text-6xl font-black mb-4"
                initial={{ scale: 0.5, opacity: 0 }}
                whileInView={{ scale: 1, opacity: 1 }}
                viewport={{ once: true }}
                transition={{ type: 'spring', bounce: 0.4 }}
              >
                Let&apos;s Create Some
                <motion.span
                  className="text-primary block"
                  animate={{
                    scale: [1, 1.05, 1],
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  Magic Together!
                </motion.span>
              </motion.h2>

              {/* Rotating fun phrases */}
              <AnimatePresence mode="wait">
                <motion.p
                  key={currentPhrase}
                  initial={{ y: 20, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  exit={{ y: -20, opacity: 0 }}
                  className="text-xl text-muted-foreground mb-8"
                >
                  {funPhrases[currentPhrase]}
                </motion.p>
              </AnimatePresence>
            </div>
          </FadeIn>

          {/* Developer Power Level */}
          <FadeIn delay={0.1}>
            <div className="mb-12 p-6 rounded-2xl bg-card border border-border">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-500" />
                  Developer Power Level
                </span>
                <span className="text-2xl font-black text-primary">{Math.round(powerLevel)}%</span>
              </div>
              <div className="h-4 rounded-full bg-muted overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-gradient-to-r from-amber-500 via-primary to-rose-500"
                  style={{ width: `${powerLevel}%` }}
                  animate={{
                    boxShadow: powerLevel >= 100 ? '0 0 20px rgba(var(--primary), 0.8)' : 'none',
                  }}
                />
              </div>
              <div className="flex justify-between text-xs text-muted-foreground mt-2">
                <span>Noob</span>
                <span>It&apos;s over 9000!</span>
              </div>
            </div>
          </FadeIn>

          {/* Main CTA - Email */}
          <FadeIn delay={0.2}>
            <div className="text-center mb-12">
              {/* Stable wrapper for consistent hover area */}
              <div
                className="inline-block"
                onMouseEnter={() => setEmailHovered(true)}
                onMouseLeave={() => setEmailHovered(false)}
              >
                <a
                  href={`mailto:${siteConfig.email}`}
                  className="group relative inline-flex items-center gap-4 px-10 py-6 rounded-3xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground text-xl font-bold overflow-visible"
                >
                  <motion.div
                    className="absolute inset-0 rounded-3xl bg-gradient-to-r from-primary to-primary/80"
                    animate={{ scale: emailHovered ? 1.05 : 1 }}
                    transition={{ type: 'spring', stiffness: 300 }}
                    style={{ transformOrigin: 'center' }}
                  />
                {/* Shimmer effect */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-primary/0 via-white/20 to-primary/0"
                  initial={{ x: '-100%' }}
                  animate={{ x: emailHovered ? '100%' : '-100%' }}
                  transition={{ duration: 0.6, ease: 'easeInOut' }}
                />

                <motion.div
                  className="relative z-10"
                  animate={{ rotate: emailHovered ? [0, 15, -15, 0] : 0 }}
                >
                  <Mail className="h-7 w-7" />
                </motion.div>

                <span className="relative z-10">
                  {emailHovered ? "Let's do this! 🚀" : siteConfig.email}
                </span>

                <motion.div
                  className="relative z-10"
                  animate={{ x: emailHovered ? 5 : 0, rotate: emailHovered ? 45 : 0 }}
                  transition={{ type: 'spring' }}
                >
                  <Send className="h-6 w-6" />
                </motion.div>

                {/* Sparkles on hover */}
                <AnimatePresence>
                  {emailHovered && (
                    <>
                      {[...Array(6)].map((_, i) => (
                        <motion.div
                          key={i}
                          className="absolute z-20"
                          style={{
                            left: `${20 + i * 12}%`,
                            top: '50%',
                          }}
                          initial={{ scale: 0, y: 0 }}
                          animate={{
                            scale: [0, 1, 0],
                            y: [(i % 2 === 0 ? -1 : 1) * 30],
                          }}
                          exit={{ scale: 0 }}
                          transition={{ duration: 0.5, delay: i * 0.05 }}
                        >
                          <Star className="h-4 w-4 text-yellow-300" fill="currentColor" />
                        </motion.div>
                      ))}
                    </>
                  )}
                </AnimatePresence>
                </a>
              </div>

              {/* Location - increased spacing from email button */}
              <motion.div
                className="mt-12 inline-flex items-center gap-2 text-muted-foreground"
                whileHover={{ scale: 1.05 }}
              >
                <MapPin className="h-5 w-5" />
                <span>{siteConfig.location} 🇦🇲</span>
                <span className="text-xs ml-1">(Remote-first though!)</span>
              </motion.div>
            </div>
          </FadeIn>

          {/* Fun interaction cards */}
          <FadeIn delay={0.3}>
            <div className="grid sm:grid-cols-3 gap-4 mb-12">
              {/* Music card */}
              <motion.div
                className="p-6 rounded-2xl bg-card border border-border cursor-pointer text-center group"
                onClick={handleRockClick}
                whileHover={{ scale: 1.02, y: -4 }}
                whileTap={{ scale: 0.98 }}
              >
                <motion.div
                  animate={rockClicked > 0 ? { rotate: [0, 10, -10, 0] } : {}}
                  className="text-4xl mb-3"
                >
                  🎸
                </motion.div>
                <h3 className="font-bold mb-1">Rock On!</h3>
                <p className="text-sm text-muted-foreground">
                  Clicked {rockClicked} time{rockClicked !== 1 ? 's' : ''}
                  {rockClicked >= 5 && ' 🤘'}
                </p>
                {rockClicked >= 5 && (
                  <motion.p
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="text-xs text-primary mt-2"
                  >
                    You rock! 🎸🔥
                  </motion.p>
                )}
              </motion.div>

              {/* Quick response card */}
              <motion.div
                className="p-6 rounded-2xl bg-card border border-border text-center"
                whileHover={{ scale: 1.02, y: -4 }}
              >
                <motion.div
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
                  className="text-4xl mb-3 inline-block"
                >
                  ⚡
                </motion.div>
                <h3 className="font-bold mb-1">Lightning Fast</h3>
                <p className="text-sm text-muted-foreground">Usually responds in &lt;24hrs</p>
              </motion.div>

              {/* Availability card */}
              <motion.div
                className="p-6 rounded-2xl bg-card border border-border text-center"
                whileHover={{ scale: 1.02, y: -4 }}
              >
                <motion.div
                  animate={{ scale: [1, 1.2, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="text-4xl mb-3"
                >
                  🎯
                </motion.div>
                <h3 className="font-bold mb-1">Ready to Ship</h3>
                <p className="text-sm text-muted-foreground">Available for freelance</p>
              </motion.div>
            </div>
          </FadeIn>

          {/* Social links - super enhanced */}
          <FadeIn delay={0.4}>
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-4 flex items-center justify-center gap-2">
                <MessageCircle className="h-4 w-4" />
                Or find me on the interwebs
              </p>
              <div className="flex items-center justify-center gap-4">
                {socialLinks.map((link, index) => {
                  const Icon = iconMap[link.icon] || Github
                  return (
                    <motion.a
                      key={link.name}
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.1 }}
                      whileHover={{
                        scale: 1.15,
                        y: -8,
                        rotate: [-5, 5, 0],
                      }}
                      whileTap={{ scale: 0.9 }}
                      className="group flex items-center gap-3 px-6 py-3 rounded-2xl bg-card border border-border hover:border-primary hover:bg-primary/5 transition-all"
                    >
                      <Icon className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
                      <span className="font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                        {link.name}
                      </span>
                      <ArrowUpRight className="h-4 w-4 text-muted-foreground group-hover:text-primary opacity-0 group-hover:opacity-100 transition-all" />
                    </motion.a>
                  )
                })}
              </div>
            </div>
          </FadeIn>

          {/* Fun closing message */}
          <FadeIn delay={0.5}>
            <motion.div
              className="mt-16 text-center"
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
            >
              <motion.div
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-muted text-sm"
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Heart className="h-4 w-4 text-rose-500" fill="currentColor" />
                <span>Made with love, metal, and probably too many hours debugging CSS</span>
                <Rocket className="h-4 w-4 text-primary" />
              </motion.div>
            </motion.div>
          </FadeIn>
        </div>

        {/* Decorative gradient */}
        <div className="mt-16 relative">
          <motion.div
            className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent"
            animate={{ opacity: [0.3, 1, 0.3] }}
            transition={{ duration: 3, repeat: Infinity }}
          />
        </div>
      </div>
    </section>
  )
}
