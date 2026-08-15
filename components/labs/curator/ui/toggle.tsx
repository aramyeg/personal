export function Toggle({
  checked, onChange, label, description,
}: { checked: boolean; onChange: (checked: boolean) => void; label: string; description?: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className="flex w-full items-start justify-between gap-4 text-left"
    >
      <span>
        <span className="block text-[13px] font-medium text-[var(--c-text)]">{label}</span>
        {description && (
          <span className="mt-0.5 block text-[12px] text-[var(--c-text-soft)]">{description}</span>
        )}
      </span>
      <span
        aria-hidden
        className={`relative mt-0.5 inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors duration-150 ${
          checked ? 'bg-[var(--c-blue)]' : 'bg-[var(--c-toggle-off)]'
        }`}
      >
        <span
          className={`absolute left-0.5 h-4 w-4 rounded-full bg-white transition-transform duration-150 ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </span>
    </button>
  )
}
