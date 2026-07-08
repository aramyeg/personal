import { Header } from '@/components/layout'
import { Hero } from '@/components/sections/hero'
import { About } from '@/components/sections/about'
import { Skills } from '@/components/sections/skills'
import { ExperienceBento } from '@/components/sections/experience-bento'
import { Projects } from '@/components/sections/projects'
import { StateDemo } from '@/components/sections/state-demo'
import { Contact } from '@/components/sections/contact'
import { Footer } from '@/components/sections/footer'

export default function Home() {
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
