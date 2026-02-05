'use client'

import { useState, memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MapPin, Briefcase, GraduationCap, Globe, ChevronRight, Sparkles } from 'lucide-react'
import { FadeIn, StaggerChildren, StaggerItem, TextReveal } from '@/components/animation'
import { cn } from '@/lib/utils'

const highlights = [
  {
    icon: Briefcase,
    label: '8+ Years',
    description: 'Frontend Experience',
    detail: 'From startups to enterprise-scale applications',
    color: 'from-primary/20 to-primary/5',
  },
  {
    icon: Globe,
    label: 'Remote',
    description: 'International Teams',
    detail: 'Switzerland, Germany, Estonia, Ireland, UAE',
    color: 'from-sky-500/20 to-sky-500/5',
  },
  {
    icon: MapPin,
    label: 'Armenia',
    description: 'Based in Yerevan',
    detail: 'Available for global remote collaboration',
    color: 'from-amber-500/20 to-amber-500/5',
  },
  {
    icon: GraduationCap,
    label: 'Marketing',
    description: 'to Code (2016)',
    detail: 'Self-taught developer with business insight',
    color: 'from-rose-500/20 to-rose-500/5',
  },
]

const funFacts = [
  { emoji: '🎸', fact: 'Heavy metal fueled coding sessions' },
  { emoji: '🎮', fact: 'Casual gamer when not debugging' },
  { emoji: '📚', fact: 'Always learning something new' },
  { emoji: '🎵', fact: 'Black Sabbath, Led Zeppelin enthusiast' },
]

// Memoized header to prevent re-animation when card state changes
const AboutHeader = memo(function AboutHeader() {
  return (
    <FadeIn>
      <div className="flex items-center gap-3 mb-4">
        <TextReveal
          text="About Me"
          as="h2"
          className="text-3xl sm:text-4xl font-bold"
        />
        <motion.div
          animate={{ rotate: [0, 10, -10, 0] }}
          transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
        >
          <Sparkles className="h-6 w-6 text-primary" />
        </motion.div>
      </div>
      <div className="h-1 w-12 bg-primary rounded-full mb-8" />
    </FadeIn>
  )
})

export function About() {
  const [expandedCard, setExpandedCard] = useState<string | null>(null)
  const [showFunFacts, setShowFunFacts] = useState(false)

  return (
    <section id="about" className="py-24 sm:py-32 relative overflow-hidden">
      {/* Decorative background elements */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          className="absolute top-20 right-10 w-72 h-72 rounded-full bg-primary/5 blur-3xl"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <motion.div
          className="absolute bottom-20 left-10 w-96 h-96 rounded-full bg-accent/5 blur-3xl"
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{ duration: 10, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>

      <div className="section-container relative">
        <AboutHeader />

        <div className="grid lg:grid-cols-5 gap-12">
          {/* Bio with animated paragraphs */}
          <div className="lg:col-span-3 space-y-6">
            <FadeIn delay={0.1}>
              <motion.p
                className="text-lg text-muted-foreground leading-relaxed"
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5 }}
              >
                I&apos;m a{' '}
                <motion.span
                  className="text-foreground font-medium inline-block"
                  whileHover={{ scale: 1.05, color: 'var(--primary)' }}
                >
                  Senior Frontend Engineer
                </motion.span>{' '}
                and{' '}
                <motion.span
                  className="text-foreground font-medium inline-block"
                  whileHover={{ scale: 1.05, color: 'var(--primary)' }}
                >
                  Technical Lead
                </motion.span>{' '}
                with over 8 years of experience building production applications for international
                clients.
              </motion.p>
            </FadeIn>

            <FadeIn delay={0.2}>
              <motion.p
                className="text-muted-foreground leading-relaxed"
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.1 }}
              >
                My journey started in 2016 when I transitioned from marketing to software
                development. Since then, I&apos;ve worked remotely for companies across{' '}
                <span className="text-foreground font-medium">
                  Switzerland, Germany, Estonia, Ireland, and the UAE
                </span>
                , specializing in fintech and enterprise platforms.
              </motion.p>
            </FadeIn>

            <FadeIn delay={0.3}>
              <motion.p
                className="text-muted-foreground leading-relaxed"
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.2 }}
              >
                Currently at{' '}
                <motion.span
                  className="text-primary font-medium cursor-pointer"
                  whileHover={{ scale: 1.05 }}
                >
                  xDataGroup
                </motion.span>
                , I lead frontend development for AMIO Bank&apos;s retail banking platform while
                collaborating directly with founders on an early-stage PropTech startup.
              </motion.p>
            </FadeIn>

            <FadeIn delay={0.4}>
              <motion.p
                className="text-muted-foreground leading-relaxed"
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.3 }}
              >
                I&apos;m passionate about building performant, accessible interfaces and mentoring
                developers. When I&apos;m not coding, I&apos;m exploring the latest in React,
                TypeScript, and modern web technologies.
              </motion.p>
            </FadeIn>

            {/* Fun facts toggle */}
            <FadeIn delay={0.5}>
              <motion.button
                onClick={() => setShowFunFacts(!showFunFacts)}
                className="flex items-center gap-2 text-sm text-primary hover:text-primary/80 transition-colors mt-4"
                whileHover={{ x: 5 }}
              >
                <ChevronRight
                  className={cn(
                    'h-4 w-4 transition-transform duration-300',
                    showFunFacts && 'rotate-90'
                  )}
                />
                {showFunFacts ? 'Hide fun facts' : 'Show fun facts about me'}
              </motion.button>

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
            </FadeIn>
          </div>

          {/* Interactive highlight cards */}
          <StaggerChildren className="lg:col-span-2" staggerDelay={0.1} delayStart={0.3}>
            {/* CSS containment prevents layout shift from propagating to other sections */}
            <div className="grid grid-cols-2 gap-4" style={{ contain: 'layout' }}>
              {highlights.map((item) => (
                <StaggerItem key={item.label}>
                  <motion.div
                    data-testid="about-card"
                    className={cn(
                      'relative p-4 rounded-xl bg-card border border-border cursor-pointer overflow-hidden group',
                      'hover:border-primary/50 transition-colors duration-300'
                    )}
                    style={{
                      contain: 'layout',
                      minHeight: '130px',
                    }}
                    onClick={() =>
                      setExpandedCard(expandedCard === item.label ? null : item.label)
                    }
                    whileHover={{ scale: 1.02, y: -2 }}
                    whileTap={{ scale: 0.98 }}
                    layout="position"
                  >
                    {/* Gradient background on hover */}
                    <div
                      className={cn(
                        'absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-300',
                        item.color
                      )}
                    />

                    <div className="relative">
                      <motion.div
                        animate={expandedCard === item.label ? { rotate: 360 } : { rotate: 0 }}
                        transition={{ duration: 0.5 }}
                      >
                        <item.icon className="h-5 w-5 text-primary mb-3" />
                      </motion.div>
                      <p className="font-semibold">{item.label}</p>
                      <p className="text-sm text-muted-foreground">{item.description}</p>

                      {/* Expanded detail */}
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
                  </motion.div>
                </StaggerItem>
              ))}
            </div>

            {/* Click hint */}
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              className="text-xs text-muted-foreground text-center mt-4"
            >
              Click cards for more details
            </motion.p>
          </StaggerChildren>
        </div>
      </div>
    </section>
  )
}
