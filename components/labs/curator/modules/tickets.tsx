'use client'

import { useState, type ChangeEvent } from 'react'
import { siteConfig } from '@/lib/constants'
import { useCuratorStore } from '../store'
import {
  CATEGORY_LABELS,
  detailsSchema,
  requesterSchema,
  ticketId,
  ticketMailto,
  type TicketDraft,
} from '../ticket-schema'

type Step = 0 | 1 | 2

type TicketsState = {
  step: Step
  draft: Partial<TicketDraft>
  errors: Record<string, string>
}

const STEPS: { label: string }[] = [
  { label: 'Requester' },
  { label: 'Details' },
  { label: 'Review' },
]

const PRIORITIES: { id: TicketDraft['priority']; label: string }[] = [
  { id: 'low', label: 'Low' },
  { id: 'normal', label: 'Normal' },
  { id: 'high', label: 'High' },
]

const INITIAL_STATE: TicketsState = {
  step: 0,
  draft: { name: '', email: '', category: 'job-opportunity', priority: 'normal', message: '' },
  errors: {},
}

const FIELD_CLS =
  'w-full rounded-[6px] border border-[var(--c-border)] bg-[var(--c-surface)] px-3 py-2 text-[13px] outline-none focus:border-[var(--c-blue)]'
const LABEL_CLS = 'mb-1.5 block text-[12px] font-medium text-[var(--c-text)]'
const ERROR_CLS = 'mt-1 text-[11px] text-[var(--c-bad)]'
const PRIMARY_BTN_CLS =
  'rounded-[6px] bg-[var(--c-blue)] px-4 py-2 text-[13px] font-medium text-white transition-colors duration-150 hover:brightness-110'
const SECONDARY_BTN_CLS =
  'rounded-[6px] border border-[var(--c-border)] bg-[var(--c-surface)] px-4 py-2 text-[13px] font-medium text-[var(--c-text)] transition-colors duration-150 hover:bg-[var(--c-hover)]'

function fieldErrorsFrom(issues: { path: PropertyKey[]; message: string }[]): Record<string, string> {
  const errors: Record<string, string> = {}
  for (const issue of issues) {
    const key = String(issue.path[0])
    if (!(key in errors)) errors[key] = issue.message
  }
  return errors
}

function ProgressIndicator({ step }: { step: Step }) {
  return (
    <div className="mb-6 flex items-center">
      {STEPS.map((s, i) => {
        const completed = i < step
        const current = i === step
        const circleCls = completed
          ? 'bg-[var(--c-navy)] text-white'
          : current
            ? 'text-[var(--c-text)] ring-2 ring-[var(--c-blue)]'
            : 'text-[var(--c-text-soft)] border border-[var(--c-border)]'
        return (
          <div key={s.label} className="flex flex-1 items-center last:flex-none">
            <div className="flex flex-col items-center gap-1.5">
              <span
                aria-hidden
                className={`flex h-[22px] w-[22px] items-center justify-center rounded-full font-[family-name:var(--font-data)] text-[11px] ${circleCls}`}
              >
                {i + 1}
              </span>
              <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--c-text-soft)]">{s.label}</span>
            </div>
            {i < STEPS.length - 1 && (
              <span aria-hidden className="mx-2 mb-[18px] h-px flex-1 bg-[var(--c-border)]" />
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function TicketsModule() {
  const pushToast = useCuratorStore((s) => s.pushToast)
  const [state, setState] = useState<TicketsState>(INITIAL_STATE)

  function updateDraft(patch: Partial<TicketDraft>) {
    setState((s) => ({ ...s, draft: { ...s.draft, ...patch } }))
  }

  function handleContinueFromRequester() {
    const parsed = requesterSchema.safeParse(state.draft)
    if (!parsed.success) {
      setState((s) => ({ ...s, errors: fieldErrorsFrom(parsed.error.issues) }))
      return
    }
    setState((s) => ({ ...s, draft: { ...s.draft, ...parsed.data }, errors: {}, step: 1 }))
  }

  function handleContinueFromDetails() {
    const parsed = detailsSchema.safeParse(state.draft)
    if (!parsed.success) {
      setState((s) => ({ ...s, errors: fieldErrorsFrom(parsed.error.issues) }))
      return
    }
    setState((s) => ({ ...s, draft: { ...s.draft, ...parsed.data }, errors: {}, step: 2 }))
  }

  function handleBack() {
    setState((s) => ({ ...s, step: Math.max(0, s.step - 1) as Step, errors: {} }))
  }

  function handleSubmit() {
    const fullDraft = state.draft as TicketDraft
    const id = ticketId(Date.now())
    pushToast({ title: `Ticket ${id} created`, description: 'Expected response time: 1 business day.' })
    window.location.href = ticketMailto(fullDraft, siteConfig.email)
    setState(INITIAL_STATE)
  }

  return (
    <div className="space-y-4">
      <header>
        <h1 className="text-[18px] font-semibold">Tickets</h1>
        <p className="mt-1 text-[12px] text-[var(--c-text-soft)]">Support requests route directly to the operator.</p>
      </header>

      <div className="max-w-[560px] rounded-[6px] border border-[var(--c-border)] bg-[var(--c-surface)] p-6">
        <ProgressIndicator step={state.step} />

        {state.step === 0 && (
          <div className="space-y-4">
            <div>
              <label htmlFor="ticket-name" className={LABEL_CLS}>Full name</label>
              <input
                id="ticket-name"
                type="text"
                value={state.draft.name ?? ''}
                onChange={(e: ChangeEvent<HTMLInputElement>) => updateDraft({ name: e.target.value })}
                className={FIELD_CLS}
              />
              {state.errors.name && <p className={ERROR_CLS}>{state.errors.name}</p>}
            </div>
            <div>
              <label htmlFor="ticket-email" className={LABEL_CLS}>Email</label>
              <input
                id="ticket-email"
                type="text"
                value={state.draft.email ?? ''}
                onChange={(e: ChangeEvent<HTMLInputElement>) => updateDraft({ email: e.target.value })}
                className={FIELD_CLS}
              />
              {state.errors.email && <p className={ERROR_CLS}>{state.errors.email}</p>}
            </div>
            <div className="flex justify-end">
              <button type="button" onClick={handleContinueFromRequester} className={PRIMARY_BTN_CLS}>
                Continue
              </button>
            </div>
          </div>
        )}

        {state.step === 1 && (
          <div className="space-y-4">
            <div>
              <label htmlFor="ticket-category" className={LABEL_CLS}>Category</label>
              <select
                id="ticket-category"
                value={state.draft.category ?? 'job-opportunity'}
                onChange={(e) => updateDraft({ category: e.target.value as TicketDraft['category'] })}
                className={FIELD_CLS}
              >
                {(Object.entries(CATEGORY_LABELS) as [TicketDraft['category'], string][]).map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
              {state.errors.category && <p className={ERROR_CLS}>{state.errors.category}</p>}
            </div>

            <div>
              <span className={LABEL_CLS}>Priority</span>
              <div role="radiogroup" aria-label="Priority" className="flex gap-2">
                {PRIORITIES.map((p) => {
                  const checked = state.draft.priority === p.id
                  return (
                    <button
                      key={p.id}
                      type="button"
                      role="radio"
                      aria-checked={checked}
                      onClick={() => updateDraft({ priority: p.id })}
                      className={`rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors duration-150 ${
                        checked
                          ? 'border-[var(--c-navy)] bg-[var(--c-navy)] text-white'
                          : 'border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-text)] hover:bg-[var(--c-hover)]'
                      }`}
                    >
                      {p.label}
                    </button>
                  )
                })}
              </div>
              {state.errors.priority && <p className={ERROR_CLS}>{state.errors.priority}</p>}
            </div>

            <div>
              <label htmlFor="ticket-message" className={LABEL_CLS}>Message</label>
              <textarea
                id="ticket-message"
                rows={5}
                value={state.draft.message ?? ''}
                onChange={(e) => updateDraft({ message: e.target.value })}
                className={FIELD_CLS}
              />
              {state.errors.message && <p className={ERROR_CLS}>{state.errors.message}</p>}
            </div>

            <div className="flex justify-between">
              <button type="button" onClick={handleBack} className={SECONDARY_BTN_CLS}>Back</button>
              <button type="button" onClick={handleContinueFromDetails} className={PRIMARY_BTN_CLS}>Continue</button>
            </div>
          </div>
        )}

        {state.step === 2 && (
          <div className="space-y-4">
            <dl className="space-y-3">
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--c-text-soft)]">Full name</dt>
                <dd className="text-[13px]">{state.draft.name}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--c-text-soft)]">Email</dt>
                <dd className="text-[13px]">{state.draft.email}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--c-text-soft)]">Category</dt>
                <dd className="text-[13px]">{CATEGORY_LABELS[state.draft.category ?? 'job-opportunity']}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--c-text-soft)]">Priority</dt>
                <dd className="text-[13px] capitalize">{state.draft.priority}</dd>
              </div>
              <div>
                <dt className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--c-text-soft)]">Message</dt>
                <dd className="whitespace-pre-wrap text-[13px]">{state.draft.message}</dd>
              </div>
            </dl>
            <div className="flex justify-between">
              <button type="button" onClick={handleBack} className={SECONDARY_BTN_CLS}>Back</button>
              <button type="button" onClick={handleSubmit} className={PRIMARY_BTN_CLS}>Submit ticket</button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
