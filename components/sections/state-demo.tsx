'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Terminal, Sparkles, ChevronRight, Coffee, Code2, Zap, Heart } from 'lucide-react'
import { FadeIn } from '@/components/animation'
import { cn } from '@/lib/utils'

type CommandOutput = {
  id: string
  command: string
  output: string | React.ReactNode
  type: 'success' | 'error' | 'info' | 'special'
}

const ASCII_LOGO = `
   _____
  /  _  \\____________    _____
 /  /_\\  \\_  __ \\__  \\  /     \\
/    |    \\  | \\// __ \\|  Y Y  \\
\\____|__  /__|  (____  /__|_|  /
        \\/           \\/      \\/
`

const COMMANDS: Record<string, () => { output: string | React.ReactNode; type: CommandOutput['type'] }> = {
  help: () => ({
    output: `Available commands:
  whoami       - Who am I?
  skills       - My tech stack
  music        - Current coding playlist
  joke         - Developer humor
  contact      - How to reach me
  projects     - Featured work
  ascii        - Show ASCII art
  motivate     - Need motivation?
  clear        - Clear terminal
  neofetch     - System info (dev edition)`,
    type: 'info',
  }),
  whoami: () => ({
    output: `Aram Yeghiazaryan
├── Role: Senior Frontend Engineer & Technical Lead
├── Location: Yerevan, Armenia 🇦🇲
├── Experience: 8+ years
├── Specialty: React, TypeScript, Zustand, Next.js
└── Status: Building cool things at xDataGroup 🚀`,
    type: 'success',
  }),
  skills: () => ({
    output: `Tech Stack:
┌─ Frontend ────────────────────────┐
│ React ██████████████████████ 95%  │
│ TypeScript ████████████████████ 92%│
│ Next.js ██████████████████░░ 88%  │
│ Zustand ████████████████████ 90%  │
└───────────────────────────────────┘
┌─ Tools ───────────────────────────┐
│ TanStack Query, Shadcn/ui, Tailwind│
│ GraphQL, REST, Node.js, Git        │
└───────────────────────────────────┘`,
    type: 'success',
  }),
  music: () => ({
    output: `🎸 Coding Playlist:
├── Black Sabbath - Paranoid
├── Led Zeppelin - Kashmir
├── Polyphia - G.O.A.T.
├── MF DOOM - Doomsday
├── Gorillaz - Feel Good Inc
├── System of a Down - Chop Suey!
└── Currently: ${['Black Sabbath', 'Led Zeppelin', 'Polyphia', 'MF DOOM', 'Gorillaz', 'SOAD'][Math.floor(Math.random() * 6)]}

🤘 ░░▒▓█████████████████▓▒░░ 🤘`,
    type: 'special',
  }),
  joke: () => {
    const jokes = [
      "Why do programmers prefer dark mode?\nBecause light attracts bugs! 🐛",
      "A SQL query walks into a bar, walks up to two tables and asks...\n'Can I join you?' 🍺",
      "Why do Java developers wear glasses?\nBecause they can't C# 👓",
      "!false - It's funny because it's true 🤣",
      "There are only 10 types of people:\nThose who understand binary and those who don't 🔢",
      "What's a programmer's favorite hangout place?\nFoo Bar 🍸",
    ]
    return {
      output: jokes[Math.floor(Math.random() * jokes.length)],
      type: 'special',
    }
  },
  contact: () => ({
    output: `📫 Let's Connect:
├── Email: aram@example.com
├── GitHub: github.com/aram
├── LinkedIn: linkedin.com/in/aram
└── Or scroll down to the contact section! 👇`,
    type: 'success',
  }),
  projects: () => ({
    output: `🚀 Featured Projects:
┌─────────────────────────────────────────┐
│ AMIO Bank iBank [CURRENT]               │
│ └── Technical Lead @ xDataGroup         │
├─────────────────────────────────────────┤
│ 360dialog Platform                      │
│ └── 50K+ businesses, 4B+ messages       │
├─────────────────────────────────────────┤
│ SNB Mobile Banking                      │
│ └── 5M+ downloads, 4.7★ rating          │
└─────────────────────────────────────────┘
↑ Check the Projects section above!`,
    type: 'success',
  }),
  ascii: () => ({
    output: ASCII_LOGO,
    type: 'special',
  }),
  motivate: () => {
    const quotes = [
      '"Code is like humor. When you have to explain it, it\'s bad."\n— Cory House',
      '"First, solve the problem. Then, write the code."\n— John Johnson',
      '"The best error message is the one that never shows up."\n— Thomas Fuchs',
      '"Simplicity is the soul of efficiency."\n— Austin Freeman',
      '"Make it work, make it right, make it fast."\n— Kent Beck',
    ]
    return {
      output: `💡 ${quotes[Math.floor(Math.random() * quotes.length)]}`,
      type: 'special',
    }
  },
  neofetch: () => ({
    output: `         .--.              aram@portfolio
        |o_o |             ──────────────────
        |:_/ |             OS: Developer Edition
       //   \\ \\            Host: xDataGroup
      (|     | )           Kernel: React 19.x
     /'\\_   _/\`\\           Uptime: 8+ years coding
     \\___)=(___/           Packages: Too many node_modules
                           Shell: Zsh + Oh-My-Zsh
                           Terminal: This portfolio
                           CPU: Metal-powered 🤘
                           Memory: Stack Overflow tabs`,
    type: 'info',
  }),
}

export function StateDemo() {
  const [input, setInput] = useState('')
  const [history, setHistory] = useState<CommandOutput[]>([
    {
      id: 'welcome',
      command: '',
      output: `Welcome to Aram's Interactive Terminal! 🖥️
Type 'help' to see available commands.`,
      type: 'info',
    },
  ])
  const [commandHistory, setCommandHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const terminalRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight
    }
  }, [history])

  const handleCommand = (cmd: string) => {
    const trimmedCmd = cmd.trim().toLowerCase()

    if (!trimmedCmd) return

    setCommandHistory((prev) => [...prev, trimmedCmd])
    setHistoryIndex(-1)

    if (trimmedCmd === 'clear') {
      setHistory([])
      return
    }

    const commandFn = COMMANDS[trimmedCmd]
    if (commandFn) {
      const result = commandFn()
      setHistory((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          command: cmd,
          output: result.output,
          type: result.type,
        },
      ])
    } else {
      setHistory((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          command: cmd,
          output: `Command not found: ${trimmedCmd}\nType 'help' for available commands.`,
          type: 'error',
        },
      ])
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleCommand(input)
      setInput('')
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (commandHistory.length > 0) {
        const newIndex = historyIndex < commandHistory.length - 1 ? historyIndex + 1 : historyIndex
        setHistoryIndex(newIndex)
        setInput(commandHistory[commandHistory.length - 1 - newIndex] || '')
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (historyIndex > 0) {
        const newIndex = historyIndex - 1
        setHistoryIndex(newIndex)
        setInput(commandHistory[commandHistory.length - 1 - newIndex] || '')
      } else {
        setHistoryIndex(-1)
        setInput('')
      }
    }
  }

  const focusInput = () => {
    inputRef.current?.focus()
  }

  return (
    <section id="playground" className="py-24 sm:py-32">
      <div className="section-container">
        <FadeIn>
          <div className="flex items-center gap-3 mb-4">
            <Terminal className="h-8 w-8 text-primary" />
            <h2 className="text-3xl sm:text-4xl font-bold">Interactive Terminal</h2>
          </div>
          <div className="h-1 w-12 bg-primary rounded-full mb-4" />
          <p className="text-muted-foreground max-w-2xl mb-8">
            A fun way to explore! Type commands to learn more about me. Try{' '}
            <code className="px-1.5 py-0.5 rounded bg-muted text-primary text-sm">help</code> to get
            started.
          </p>
        </FadeIn>

        <FadeIn delay={0.1}>
          <div
            className="bg-gray-950 rounded-2xl border border-gray-800 overflow-hidden shadow-2xl cursor-text"
            onClick={focusInput}
          >
            {/* Terminal header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800">
              <div className="flex items-center gap-2">
                <div className="flex gap-1.5">
                  <span className="w-3 h-3 rounded-full bg-red-500" />
                  <span className="w-3 h-3 rounded-full bg-yellow-500" />
                  <span className="w-3 h-3 rounded-full bg-green-500" />
                </div>
                <span className="ml-2 text-xs text-gray-400 font-mono">aram@portfolio ~ zsh</span>
              </div>
              <div className="flex items-center gap-2 text-gray-500">
                <Sparkles className="h-4 w-4" />
              </div>
            </div>

            {/* Terminal content */}
            <div
              ref={terminalRef}
              className="p-4 min-h-[400px] max-h-[500px] overflow-y-auto font-mono text-sm"
              role="log"
              aria-live="polite"
              aria-label="Terminal output"
            >
              <AnimatePresence>
                {history.map((item) => (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-4"
                  >
                    {item.command && (
                      <div className="flex items-center gap-2 text-green-400 mb-1">
                        <ChevronRight className="h-4 w-4" />
                        <span>{item.command}</span>
                      </div>
                    )}
                    <pre
                      className={cn(
                        'whitespace-pre-wrap pl-6',
                        item.type === 'success' && 'text-green-300',
                        item.type === 'error' && 'text-red-400',
                        item.type === 'info' && 'text-blue-300',
                        item.type === 'special' && 'text-amber-300'
                      )}
                    >
                      {item.output}
                    </pre>
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* Input line */}
              <div className="flex items-center gap-2 text-green-400">
                <ChevronRight className="h-4 w-4" />
                <input
                  ref={inputRef}
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-1 bg-transparent outline-none text-green-300 caret-green-400"
                  placeholder="Type a command..."
                  aria-label="Terminal command input"
                />
                <motion.span
                  className="w-2 h-5 bg-green-400"
                  animate={{ opacity: [1, 0] }}
                  transition={{ duration: 0.5, repeat: Infinity, repeatType: 'reverse' }}
                />
              </div>
            </div>
          </div>
        </FadeIn>

        {/* Quick command suggestions */}
        <FadeIn delay={0.2}>
          <div className="mt-6 flex flex-wrap gap-2">
            <span className="text-sm text-muted-foreground mr-2">Try:</span>
            {['help', 'whoami', 'skills', 'joke', 'music', 'neofetch'].map((cmd) => (
              <motion.button
                key={cmd}
                onClick={() => {
                  setInput(cmd)
                  inputRef.current?.focus()
                }}
                className="px-3 py-1.5 rounded-full bg-muted hover:bg-muted/80 text-sm font-mono text-muted-foreground hover:text-foreground transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                {cmd}
              </motion.button>
            ))}
          </div>
        </FadeIn>

        {/* Feature highlights */}
        <FadeIn delay={0.3} className="mt-8">
          <div className="grid sm:grid-cols-4 gap-4">
            {[
              { icon: Code2, label: 'Interactive', desc: 'Real terminal experience' },
              { icon: Coffee, label: 'Fun', desc: 'Easter eggs included' },
              { icon: Zap, label: 'Fast', desc: 'Instant responses' },
              { icon: Heart, label: 'Made with ❤️', desc: 'Built with React' },
            ].map((feature, index) => (
              <motion.div
                key={feature.label}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.1 }}
                className="p-4 rounded-xl bg-card border border-border text-center"
              >
                <feature.icon className="h-5 w-5 text-primary mx-auto mb-2" />
                <h3 className="font-semibold text-sm">{feature.label}</h3>
                <p className="text-xs text-muted-foreground">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </FadeIn>
      </div>
    </section>
  )
}
