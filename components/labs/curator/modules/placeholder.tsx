export function makePlaceholder(title: string) {
  return function PlaceholderModule() {
    return (
      <div>
        <h1 className="text-[18px] font-semibold">{title}</h1>
        <p className="mt-1 text-[12px] text-[var(--c-text-soft)]">Module under construction.</p>
      </div>
    )
  }
}
