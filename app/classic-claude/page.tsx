import type { Metadata } from 'next'
import { Header } from '@/components/layout'
import { Hero } from '@/components/sections/hero'
import { About } from '@/components/sections/about'
import { Skills } from '@/components/sections/skills'
import { ExperienceBento } from '@/components/sections/experience-bento'
import { Projects } from '@/components/sections/projects'
import { StateDemo } from '@/components/sections/state-demo'
import { Contact } from '@/components/sections/contact'
import { Footer } from '@/components/sections/footer'

export const metadata: Metadata = {
  title: 'Classic Claude | Aram Yeghiazaryan',
  description:
    'The original portfolio — standard AI with a twist: warm terracotta and cream, pixel avatar, Bricolage Grotesque. The control every experiment is measured against.',
}

export default function ClassicClaudePage() {
  return (
    <>
      <Header />
      <main id="main-content" role="main">
        <Hero />
        <About />
        <Skills />
        <StateDemo />
        <ExperienceBento />
        <Projects />
        <Contact />
      </main>
      <Footer />
    </>
  )
}
