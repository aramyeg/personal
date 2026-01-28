'use client'

import { motion } from 'framer-motion'
import { Mail, MapPin, Github, Linkedin, ArrowUpRight, Sparkles } from 'lucide-react'
import { FadeIn } from '@/components/animation'
import { siteConfig, socialLinks } from '@/lib/constants'

const iconMap: Record<string, typeof Github> = {
  github: Github,
  linkedin: Linkedin,
}

export function Contact() {
  return (
    <section id="contact" className="py-24 sm:py-32">
      <div className="section-container">
        <div className="max-w-3xl mx-auto text-center">
          <FadeIn>
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Sparkles className="h-4 w-4" />
              {siteConfig.available ? 'Available for new projects' : 'Currently unavailable'}
            </div>
          </FadeIn>

          <FadeIn delay={0.1}>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-bold mb-4">
              Let&apos;s Build Something
              <span className="text-primary"> Amazing</span>
            </h2>
          </FadeIn>

          <FadeIn delay={0.2}>
            <p className="text-lg text-muted-foreground mb-8 max-w-xl mx-auto">
              Have a project in mind? I&apos;d love to hear about it. Drop me an email and
              let&apos;s discuss how we can work together.
            </p>
          </FadeIn>

          <FadeIn delay={0.3}>
            <motion.a
              href={`mailto:${siteConfig.email}`}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              className="group inline-flex items-center gap-3 px-8 py-4 rounded-2xl bg-primary text-primary-foreground text-lg font-semibold shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all"
            >
              <Mail className="h-5 w-5" />
              {siteConfig.email}
              <ArrowUpRight className="h-5 w-5 opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
            </motion.a>
          </FadeIn>

          {/* Location */}
          <FadeIn delay={0.4} className="mt-8">
            <div className="inline-flex items-center gap-2 text-muted-foreground">
              <MapPin className="h-4 w-4" />
              <span>{siteConfig.location}</span>
            </div>
          </FadeIn>

          {/* Social links */}
          <FadeIn delay={0.5} className="mt-8">
            <div className="flex items-center justify-center gap-4">
              {socialLinks.map((link) => {
                const Icon = iconMap[link.icon] || Github
                return (
                  <motion.a
                    key={link.name}
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    whileHover={{ scale: 1.1, y: -2 }}
                    whileTap={{ scale: 0.95 }}
                    className="group flex items-center gap-2 px-4 py-2 rounded-xl bg-card border border-border hover:border-primary/50 transition-colors"
                  >
                    <Icon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                    <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                      {link.name}
                    </span>
                  </motion.a>
                )
              })}
            </div>
          </FadeIn>
        </div>

        {/* Decorative gradient */}
        <div className="mt-16 relative">
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent" />
        </div>
      </div>
    </section>
  )
}
