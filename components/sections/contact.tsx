'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Mail, MapPin, Github, Linkedin, ArrowUpRight } from 'lucide-react'
import { siteConfig, socialLinks } from '@/lib/constants'

const iconMap: Record<string, typeof Github> = {
  github: Github,
  linkedin: Linkedin,
}

export function Contact() {
  const [rockClicked, setRockClicked] = useState(0)
  const [showConfetti, setShowConfetti] = useState(false)

  const handleRockClick = () => {
    const next = rockClicked + 1
    setRockClicked(next)
    if (next === 5) {
      setShowConfetti(true)
      setTimeout(() => setShowConfetti(false), 3000)
    }
  }

  return (
    <section id="contact" className="py-24 sm:py-32">
      {/* Confetti easter egg */}
      <AnimatePresence>
        {showConfetti && (
          <div className="fixed inset-0 pointer-events-none z-50">
            {[...Array(50)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute w-3 h-3 rounded-full"
                style={{
                  background: ['#b0563d', '#e0a878', '#6b5f52', '#c9803f', '#8c5b45'][i % 5],
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

      <div className="section-container">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Contact</h2>
          <div className="h-1 w-12 bg-primary rounded-full mb-8" />

          <p className="text-lg text-muted-foreground leading-relaxed mb-10">
            Open to remote opportunities — full-time or freelance. If you&apos;re
            building something in fintech, messaging, or anywhere correctness and
            performance matter, I&apos;d like to hear about it. I usually reply
            within a day.
          </p>

          {/* Primary action: email */}
          <a
            href={`mailto:${siteConfig.email}`}
            className="inline-flex items-center gap-3 px-6 py-4 rounded-xl bg-primary text-primary-foreground font-medium hover:bg-primary/90 transition-colors"
          >
            <Mail className="h-5 w-5" />
            {siteConfig.email}
          </a>

          <div className="mt-6 flex items-center gap-2 text-muted-foreground text-sm">
            <MapPin className="h-4 w-4" />
            <span>{siteConfig.location} — remote-first</span>
          </div>

          {/* Social links */}
          <div className="mt-10 flex items-center gap-3">
            {socialLinks.map((link) => {
              const Icon = iconMap[link.icon] || Github
              return (
                <a
                  key={link.name}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-2 px-4 py-2.5 rounded-xl bg-card border border-border hover:border-primary hover:bg-primary/5 transition-colors"
                >
                  <Icon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                  <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                    {link.name}
                  </span>
                  <ArrowUpRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:text-primary transition-all" />
                </a>
              )
            })}

            {/* Quiet easter egg: five clicks earns the horns */}
            <button
              onClick={handleRockClick}
              aria-label="Rock on"
              className="ml-auto px-3 py-2.5 rounded-xl text-lg opacity-60 hover:opacity-100 transition-opacity cursor-pointer"
              title={rockClicked >= 5 ? '🤘' : undefined}
            >
              {rockClicked >= 5 ? '🤘' : '🎸'}
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
