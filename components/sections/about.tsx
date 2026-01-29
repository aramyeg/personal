'use client'

import { MapPin, Briefcase, GraduationCap, Globe } from 'lucide-react'
import { FadeIn, StaggerChildren, StaggerItem } from '@/components/animation'

const highlights = [
  { icon: Briefcase, label: '8+ Years', description: 'Frontend Experience' },
  { icon: Globe, label: 'Remote', description: 'International Teams' },
  { icon: MapPin, label: 'Armenia', description: 'Based in Yerevan' },
  { icon: GraduationCap, label: 'Marketing', description: 'to Code (2016)' },
]

export function About() {
  return (
    <section id="about" className="py-24 sm:py-32">
      <div className="section-container">
        <FadeIn>
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">About</h2>
          <div className="h-1 w-12 bg-primary rounded-full mb-8" />
        </FadeIn>

        <div className="grid lg:grid-cols-5 gap-12">
          {/* Bio */}
          <FadeIn className="lg:col-span-3 space-y-6" delay={0.1}>
            <p className="text-lg text-muted-foreground leading-relaxed">
              I&apos;m a <span className="text-foreground font-medium">Senior Frontend Engineer</span> and{' '}
              <span className="text-foreground font-medium">Technical Lead</span> with over 8 years
              of experience building production applications for international clients.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              My journey started in 2016 when I transitioned from marketing to software development.
              Since then, I&apos;ve worked remotely for companies across{' '}
              <span className="text-foreground">Switzerland, Germany, Estonia, Ireland, and the UAE</span>,
              specializing in fintech and enterprise platforms.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              Currently at <span className="text-primary font-medium">xDataGroup</span>, I lead
              frontend development for AMIO Bank&apos;s retail banking platform while collaborating
              directly with founders on an early-stage PropTech startup.
            </p>
            <p className="text-muted-foreground leading-relaxed">
              I&apos;m passionate about building performant, accessible interfaces and mentoring
              developers. When I&apos;m not coding, I&apos;m exploring the latest in React, TypeScript,
              and modern web technologies.
            </p>
          </FadeIn>

          {/* Quick facts */}
          <StaggerChildren className="lg:col-span-2" staggerDelay={0.1} delayStart={0.3}>
            <div className="grid grid-cols-2 gap-4">
              {highlights.map((item) => (
                <StaggerItem key={item.label}>
                  <div className="p-4 rounded-xl bg-card border border-border hover:border-primary/50 transition-colors">
                    <item.icon className="h-5 w-5 text-primary mb-3" />
                    <p className="font-semibold">{item.label}</p>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                  </div>
                </StaggerItem>
              ))}
            </div>
          </StaggerChildren>
        </div>
      </div>
    </section>
  )
}
