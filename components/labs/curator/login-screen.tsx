'use client'

import { useState, type FormEvent } from 'react'
import { useRouter } from 'next/navigation'
import { z } from 'zod'
import { Badge } from './ui/badge'

const DEMO_EMAIL = 'operator@curator.app'
const DEMO_PASSWORD = 'demo-access'

const credentials = z.object({
  email: z.string().email('Enter a valid email address.'),
  password: z.string().min(1, 'Enter a password.'),
})

type FieldErrors = { email?: string; password?: string }

export function LoginScreen() {
  const router = useRouter()
  const [email, setEmail] = useState(DEMO_EMAIL)
  const [password, setPassword] = useState(DEMO_PASSWORD)
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [formError, setFormError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)

  async function submit(candidateEmail: string, candidatePassword: string): Promise<void> {
    const parsed = credentials.safeParse({ email: candidateEmail, password: candidatePassword })
    if (!parsed.success) {
      const errors: FieldErrors = {}
      for (const issue of parsed.error.issues) {
        const key = issue.path[0]
        if (key === 'email' || key === 'password') errors[key] = issue.message
      }
      setFieldErrors(errors)
      setFormError(null)
      return
    }
    setFieldErrors({})
    setFormError(null)
    setPending(true)
    try {
      const res = await fetch('/api/labs/curator/session', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(parsed.data),
      })
      if (!res.ok) {
        setFormError('Sign-in failed. Try again.')
        return
      }
      router.refresh()
    } catch {
      setFormError('Sign-in failed. Try again.')
    } finally {
      setPending(false)
    }
  }

  function handleSignIn(e: FormEvent<HTMLFormElement>): void {
    e.preventDefault()
    void submit(email, password)
  }

  function handleSso(): void {
    void submit(DEMO_EMAIL, DEMO_PASSWORD)
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-[var(--c-canvas)]">
      <div className="w-full max-w-[360px] rounded-[10px] border border-[var(--c-border)] bg-[var(--c-surface)] p-8 shadow-[0_1px_2px_rgba(15,23,42,0.06)]">
        <div className="mb-6 flex items-center gap-2">
          <span aria-hidden className="h-4 w-4 rounded-[3px] bg-[var(--c-blue)]" />
          <span className="text-[14px] font-semibold tracking-tight">Curator</span>
        </div>

        <form onSubmit={handleSignIn} noValidate>
          <div className="mb-4">
            <label htmlFor="curator-email" className="mb-1.5 block text-[12px] font-medium text-[var(--c-text)]">
              Work email
            </label>
            <input
              id="curator-email"
              type="text"
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-[6px] border border-[var(--c-border)] px-3 py-2 text-[13px] outline-none focus:border-[var(--c-blue)]"
            />
            {fieldErrors.email && <p className="mt-1 text-[11px] text-[var(--c-bad)]">{fieldErrors.email}</p>}
          </div>

          <div className="mb-5">
            <label htmlFor="curator-password" className="mb-1.5 block text-[12px] font-medium text-[var(--c-text)]">
              Password
            </label>
            <input
              id="curator-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-[6px] border border-[var(--c-border)] px-3 py-2 text-[13px] outline-none focus:border-[var(--c-blue)]"
            />
            {fieldErrors.password && <p className="mt-1 text-[11px] text-[var(--c-bad)]">{fieldErrors.password}</p>}
          </div>

          {formError && <p className="mb-4 text-[11px] text-[var(--c-bad)]">{formError}</p>}

          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-[6px] bg-[var(--c-blue)] py-2 text-[13px] font-medium text-white transition-colors duration-150 hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {pending ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="my-5 flex items-center gap-3">
          <span aria-hidden className="h-px flex-1 bg-[var(--c-border)]" />
          <span className="text-[11px] text-[var(--c-text-soft)]">or</span>
          <span aria-hidden className="h-px flex-1 bg-[var(--c-border)]" />
        </div>

        <button
          type="button"
          disabled={pending}
          onClick={handleSso}
          className="w-full rounded-[6px] border border-[var(--c-border)] bg-white py-2 text-[13px] font-medium text-[var(--c-text)] transition-colors duration-150 hover:bg-[var(--c-canvas)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Continue with SSO
        </button>

        <div className="mt-5 flex justify-center">
          <Badge tone="neutral">Demo environment — credentials pre-filled</Badge>
        </div>

        <div className="mt-6 flex items-center justify-center gap-3 text-[11px] text-[var(--c-text-soft)]">
          <button
            type="button"
            title="Contact your workspace administrator."
            className="hover:text-[var(--c-text)]"
          >
            Forgot password?
          </button>
          <span aria-hidden>·</span>
          <button type="button" className="hover:text-[var(--c-text)]">
            Privacy
          </button>
          <span aria-hidden>·</span>
          <button type="button" className="hover:text-[var(--c-text)]">
            Terms
          </button>
          <span aria-hidden>·</span>
          <button type="button" className="hover:text-[var(--c-text)]">
            Status
          </button>
        </div>
      </div>
    </div>
  )
}
