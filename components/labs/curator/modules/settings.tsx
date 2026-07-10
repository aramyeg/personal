'use client'

import { siteConfig } from '@/lib/constants'
import { useCuratorStore, type Density } from '../store'
import { Toggle } from '../ui/toggle'

type ProfileField = { id: string; label: string; value: string }
type NotificationKey = 'productUpdates' | 'weeklyDigest' | 'incidentAlerts'

const PROFILE_FIELDS: ProfileField[] = [
  { id: 'profile-name', label: 'Display name', value: siteConfig.name },
  { id: 'profile-title', label: 'Title', value: siteConfig.title },
  { id: 'profile-location', label: 'Location', value: siteConfig.location },
  { id: 'profile-contact', label: 'Contact', value: siteConfig.email },
]

const DENSITIES: { id: Density; label: string }[] = [
  { id: 'comfortable', label: 'Comfortable' },
  { id: 'compact', label: 'Compact' },
]

const NOTIFICATIONS: { key: NotificationKey; label: string; description: string }[] = [
  { key: 'productUpdates', label: 'Product updates', description: 'Release notes for new rooms and modules.' },
  { key: 'weeklyDigest', label: 'Weekly digest', description: 'A summary of portfolio activity, every Monday.' },
  {
    key: 'incidentAlerts',
    label: 'Incident alerts',
    description: 'Immediate notification when anything breaks in production.',
  },
]

const CARD_CLS = 'rounded-[6px] border border-[var(--c-border)] bg-[var(--c-surface)] p-6'
const SECTION_LABEL_CLS = 'text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--c-text-soft)]'
const FIELD_LABEL_CLS = 'mb-1.5 block text-[12px] font-medium text-[var(--c-text)]'
const FIELD_CLS =
  'w-full rounded-[6px] border border-[var(--c-border)] bg-[var(--c-hover)] px-3 py-2 text-[13px] text-[var(--c-text-soft)] outline-none disabled:cursor-not-allowed'
const CAPTION_CLS = 'mt-4 text-[11px] text-[var(--c-text-soft)]'

export default function SettingsModule() {
  const density = useCuratorStore((s) => s.density)
  const setDensity = useCuratorStore((s) => s.setDensity)
  const notifications = useCuratorStore((s) => s.notifications)
  const setNotification = useCuratorStore((s) => s.setNotification)

  return (
    <div className="max-w-[640px] space-y-4">
      <header>
        <h1 className="text-[18px] font-semibold">Settings</h1>
        <p className="mt-1 text-[12px] text-[var(--c-text-soft)]">Workspace preferences</p>
      </header>

      <section className={CARD_CLS}>
        <p className={SECTION_LABEL_CLS}>Profile</p>
        <div className="mt-4 space-y-4">
          {PROFILE_FIELDS.map((field) => (
            <div key={field.id}>
              <label htmlFor={field.id} className={FIELD_LABEL_CLS}>{field.label}</label>
              <input id={field.id} type="text" defaultValue={field.value} disabled className={FIELD_CLS} />
            </div>
          ))}
        </div>
        <p className={CAPTION_CLS}>Profile fields are managed by your identity provider.</p>
      </section>

      <section className={CARD_CLS}>
        <p className={SECTION_LABEL_CLS}>Appearance</p>
        <div className="mt-4">
          <span className={FIELD_LABEL_CLS}>Density</span>
          <div role="radiogroup" aria-label="Density" className="flex gap-2">
            {DENSITIES.map((d) => {
              const checked = density === d.id
              return (
                <button
                  key={d.id}
                  type="button"
                  role="radio"
                  aria-checked={checked}
                  onClick={() => setDensity(d.id)}
                  className={`rounded-full border px-3 py-1.5 text-[12px] font-medium transition-colors duration-150 ${
                    checked
                      ? 'border-[var(--c-navy)] bg-[var(--c-navy)] text-white'
                      : 'border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-text)] hover:bg-[var(--c-hover)]'
                  }`}
                >
                  {d.label}
                </button>
              )
            })}
          </div>
        </div>
        <p className={CAPTION_CLS}>Density applies to all data tables.</p>
      </section>

      <section className={CARD_CLS}>
        <p className={SECTION_LABEL_CLS}>Notifications</p>
        <div className="mt-4 divide-y divide-[var(--c-border)]">
          {NOTIFICATIONS.map((n) => (
            <div key={n.key} className="py-3 first:pt-0 last:pb-0">
              <Toggle
                checked={notifications[n.key]}
                onChange={(value) => setNotification(n.key, value)}
                label={n.label}
                description={n.description}
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
