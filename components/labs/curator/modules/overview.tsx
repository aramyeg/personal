'use client'

import { labs } from '@/lib/labs-manifest'
import { skills } from '@/data/skills'
import { analytics } from '../analytics-source'
import { getActivity, getRealKpis } from '../adapters'
import { useCuratorStore } from '../store'
import { KpiCard } from '../ui/kpi-card'
import { Badge } from '../ui/badge'
import { LineChart } from '../ui/charts/line-chart'
import { BarChart } from '../ui/charts/bar-chart'
import { SpecChip } from '../ui/spec-chip'

const nf = new Intl.NumberFormat('en-US')

function TrafficPending() {
  return (
    <div className="flex h-full flex-col rounded-[6px] border border-[var(--c-border)] bg-[var(--c-surface)] p-4">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--c-text-soft)]">
          Visitor Traffic — 90 days
        </span>
        <SpecChip briefId="EB-004" />
      </div>
      <div className="flex flex-1 items-center justify-center">
        <p className="max-w-[280px] text-center text-[12px] text-[var(--c-text-soft)]">
          Analytics integration pending. Sample data is hidden in Settings.
        </p>
      </div>
    </div>
  )
}

export default function OverviewModule() {
  const showSampleData = useCuratorStore((s) => s.preferences.showSampleData)
  const kpis = getRealKpis()
  const visitors = analytics.getVisitorKpi()
  const traffic = analytics.getTraffic(90)
  const topSkills = [...skills].sort((a, b) => b.years - a.years).slice(0, 8)
  const activity = getActivity()

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-2">
        <div>
          <h1 className="text-[18px] font-semibold">Overview</h1>
          <p className="text-[12px] text-[var(--c-text-soft)]">Portfolio performance and asset status</p>
        </div>
        <div className="ml-auto"><SpecChip briefId="EB-008" /></div>
      </header>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Museum Rooms" value={nf.format(kpis.rooms)} />
        <KpiCard label="Attic Exhibits" value={nf.format(kpis.attic)} />
        <KpiCard label="Years in Production" value={nf.format(kpis.yearsInProduction)} />
        {showSampleData ? (
          <KpiCard
            label="Weekly Visitors"
            value={nf.format(visitors.weekly)}
            delta={visitors.deltaPct}
            caption="Sample data"
          />
        ) : (
          <KpiCard label="Weekly Visitors" value="—" caption="No data source connected" />
        )}
      </div>
      <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
        {showSampleData ? (
          <LineChart
            data={traffic}
            annotations={labs.map((l) => ({ date: l.date, label: l.title }))}
            title="Visitor Traffic — 90 days"
            caption="Sample data"
            action={<SpecChip briefId="EB-004" />}
          />
        ) : (
          <TrafficPending />
        )}
        <div className="space-y-4">
          <BarChart title="Capability Utilization" unit=" yr" data={topSkills.map((s) => ({ label: s.name, value: s.years }))} />
          <div className="rounded-[6px] border border-[var(--c-border)] bg-[var(--c-surface)] p-4">
            <p className="text-[11px] font-medium uppercase tracking-[0.06em] text-[var(--c-text-soft)]">Recent Activity</p>
            <ul className="mt-3 space-y-2">
              {activity.map((e) => (
                <li key={e.id} className="flex items-center gap-2">
                  <span className="font-[family-name:var(--font-data)] text-[11px] text-[var(--c-text-soft)]">{e.date}</span>
                  <span className="min-w-0 truncate text-[12px]">{e.label}</span>
                  <span className="ml-auto"><Badge tone={e.kind === 'shipped' ? 'ok' : 'neutral'}>{e.kind}</Badge></span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  )
}
