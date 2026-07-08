'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MapPin, Briefcase, GraduationCap, Globe, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

const highlights = [
  {
    icon: Briefcase,
    label: '8 Years',
    description: 'Frontend Experience',
    detail: 'From startups to enterprise-scale applications',
  },
  {
    icon: Globe,
    label: 'Remote',
    description: 'International Teams',
    detail: 'Switzerland, Germany, Estonia, Ireland, UAE',
  },
  {
    icon: MapPin,
    label: 'Armenia',
    description: 'Based in Yerevan',
    detail: 'Available for global remote collaboration',
  },
  {
    icon: GraduationCap,
    label: 'Marketing',
    description: 'to Code (2016)',
    detail: 'Self-taught developer with business insight',
  },
]

const funFacts = [
  { emoji: '🎸', fact: 'Heavy metal fueled coding sessions' },
  { emoji: '🎮', fact: 'Casual gamer when not debugging' },
  { emoji: '📚', fact: 'Always learning something new' },
  { emoji: '🎵', fact: 'Black Sabbath, Led Zeppelin enthusiast' },
]

export function About() {
  const [expandedCard, setExpandedCard] = useState<string | null>(null)
  const [showFunFacts, setShowFunFacts] = useState(false)

  return (
    <section id="about" className="py-24 sm:py-32">
      <div className="section-container">
        <h2 className="text-3xl sm:text-4xl font-bold mb-4">About Me</h2>
        <div className="h-1 w-12 bg-primary rounded-full mb-8" />

        <div className="grid lg:grid-cols-5 gap-12">
          <div className="lg:col-span-3 space-y-6">
            <p className="text-lg text-muted-foreground leading-relaxed">
              I&apos;m a{' '}
              <span className="text-foreground font-medium">Senior Frontend Engineer</span>. For
              the last eight years I&apos;ve built production applications for banks, messaging
              platforms, and startups.
            </p>

            <p className="text-muted-foreground leading-relaxed">
              My journey started in 2016 when I transitioned from marketing to software
              development. Since then, I&apos;ve worked remotely for companies across{' '}
              <span className="text-foreground font-medium">
                Switzerland, Germany, Estonia, Ireland, and the UAE
              </span>
              , specializing in fintech and enterprise platforms.
            </p>

            <p className="text-muted-foreground leading-relaxed">
              Currently at <span className="text-primary font-medium">xDataGroup</span>, I build
              the frontend of AMIO Bank&apos;s retail banking platform while collaborating
              directly with founders on an early-stage PropTech startup.
            </p>

            <p className="text-muted-foreground leading-relaxed">
              Most of my work sits where correctness matters: moving money, messaging at scale,
              banking security. I care about interfaces that stay fast and accessible under real
              load — and about mentoring the developers who build them with me.
            </p>

            {/* Fun facts toggle */}
            <div>
              <button
                onClick={() => setShowFunFacts(!showFunFacts)}
                className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors mt-4"
              >
                <ChevronRight
                  className={cn(
                    'h-4 w-4 transition-transform duration-300',
                    showFunFacts && 'rotate-90'
                  )}
                />
                {showFunFacts ? 'Hide fun facts' : 'Show fun facts about me'}
              </button>

              <AnimatePresence>
                {showFunFacts && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <div className="grid grid-cols-2 gap-3 mt-4">
                      {funFacts.map((item, index) => (
                        <motion.div
                          key={item.fact}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.1 }}
                          className="flex items-center gap-2 p-3 rounded-lg bg-muted/50 text-sm"
                        >
                          <span className="text-lg">{item.emoji}</span>
                          <span className="text-muted-foreground">{item.fact}</span>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Interactive highlight cards */}
          <div className="lg:col-span-2">
            {/* CSS containment prevents layout shift from propagating to other sections */}
            <div className="grid grid-cols-2 gap-4" style={{ contain: 'layout' }}>
              {highlights.map((item) => (
                <div
                  key={item.label}
                  data-testid="about-card"
                  className={cn(
                    'relative p-4 rounded-xl bg-card border border-border cursor-pointer',
                    'hover:border-primary/50 hover:bg-primary/5 transition-colors duration-300'
                  )}
                  style={{ contain: 'layout', minHeight: '130px' }}
                  onClick={() =>
                    setExpandedCard(expandedCard === item.label ? null : item.label)
                  }
                >
                  <item.icon className="h-5 w-5 text-primary mb-3" />
                  <p className="font-semibold">{item.label}</p>
                  <p className="text-sm text-muted-foreground">{item.description}</p>

                  <AnimatePresence mode="wait">
                    {expandedCard === item.label && (
                      <motion.p
                        key={`${item.label}-detail`}
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="text-xs text-primary mt-2 overflow-hidden"
                      >
                        {item.detail}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>

            <p className="text-xs text-muted-foreground text-center mt-4">
              Click cards for more details
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
