import { z } from 'zod'

export const requesterSchema = z.object({
  name: z.string().min(2, 'Enter your full name.'),
  email: z.string().email('Enter a valid email address.'),
})
export const detailsSchema = z.object({
  category: z.enum(['job-opportunity', 'freelance', 'speaking', 'other']),
  priority: z.enum(['low', 'normal', 'high']),
  message: z.string().min(20, 'Describe the request in at least 20 characters.'),
})
export const ticketSchema = requesterSchema.merge(detailsSchema)
export type TicketDraft = z.infer<typeof ticketSchema>

export const CATEGORY_LABELS: Record<TicketDraft['category'], string> = {
  'job-opportunity': 'Job opportunity',
  freelance: 'Freelance',
  speaking: 'Speaking',
  other: 'Other',
}

export function ticketId(seed: number): string {
  return `AY-${String(1000 + ((seed * 2654435761) % 9000 + 9000) % 9000).padStart(4, '0')}`
}

export function ticketMailto(draft: TicketDraft, to: string): string {
  const subject = `[${CATEGORY_LABELS[draft.category]}] Inquiry from ${draft.name}`
  const body = `Priority: ${draft.priority}\nFrom: ${draft.name} <${draft.email}>\n\n${draft.message}`
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
}
