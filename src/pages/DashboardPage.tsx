import { useState, useEffect, useCallback } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts'
import AppShell from '../components/layout/AppShell'
import { formatNaira } from '../lib/currency'
import { fetchDashboardData, type Period, type DashboardData } from '../lib/dashboardApi'

const PERIODS: { key: Period; label: string }[] = [
  { key: 'month', label: 'This Month' },
  { key: 'term',  label: 'This Term'  },
  { key: 'year',  label: 'This Year'  },
]

export default function DashboardPage() {
  const [period, setPeriod] = useState<Period>('month')
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try { setData(await fetchDashboardData(period)) }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed to load') }
    finally { setLoading(false) }
  }, [period])

  useEffect(() => { load() }, [load])

  const periodLabel = PERIODS.find(p => p.key === period)!.label

  return (
    <AppShell title="Overview">
      {/* Period toggle */}
      <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5 mb-6">
        {PERIODS.map(p => (
          <button
            key={p.key}
            onClick={() => setPeriod(p.key)}
            className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all ${
              period === p.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600 mb-5">
          {error} — <button onClick={load} className="underline font-medium">Retry</button>
        </div>
      )}

      {loading ? <LoadingSkeleton /> : data ? (
        <div className="space-y-5">
          <HeroCard data={data} periodLabel={periodLabel} />
          <SummaryRow data={data} />
          <CollectionRate data={data} />
          <TrendChart data={data} />
          <ExpenseBreakdown data={data} />
          <Insights data={data} periodLabel={periodLabel} />
        </div>
      ) : null}
    </AppShell>
  )
}

// ── Hero ──────────────────────────────────────────────────────────────────────
function HeroCard({ data, periodLabel }: { data: DashboardData; periodLabel: string }) {
  const isProfit = data.netProfit >= 0
  const isZero = data.netProfit === 0

  return (
    <div className="bg-white rounded-2xl border border-gray-200 p-6">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-3">
        {periodLabel} · Net {isProfit ? 'Profit' : 'Loss'}
      </p>
      <p className={`text-5xl font-bold tracking-tight leading-none ${
        isZero ? 'text-gray-900' : isProfit ? 'text-emerald-600' : 'text-red-500'
      }`}>
        {isProfit ? '' : '−'}{formatNaira(Math.abs(data.netProfit))}
      </p>
      <p className="text-sm text-gray-400 mt-3">
        {isZero
          ? 'Revenue and expenses are equal.'
          : isProfit
          ? `${formatNaira(data.totalRevenue)} earned · ${formatNaira(data.totalExpenses)} spent`
          : `Expenses exceeded revenue by ${formatNaira(Math.abs(data.netProfit))}`}
      </p>
    </div>
  )
}

// ── Summary row ───────────────────────────────────────────────────────────────
function SummaryRow({ data }: { data: DashboardData }) {
  const items = [
    { label: 'Revenue',     value: data.totalRevenue    },
    { label: 'Expenses',    value: data.totalExpenses   },
    { label: 'Fees In',     value: data.feesCollected   },
    { label: 'Outstanding', value: data.outstandingFees },
  ]
  return (
    <div className="grid grid-cols-2 gap-3">
      {items.map(({ label, value }) => (
        <div key={label} className="bg-white rounded-xl border border-gray-200 px-4 py-4">
          <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">{label}</p>
          <p className="text-lg font-semibold text-gray-900 mt-1 tabular-nums">{formatNaira(value)}</p>
        </div>
      ))}
    </div>
  )
}

// ── Collection rate ───────────────────────────────────────────────────────────
function CollectionRate({ data }: { data: DashboardData }) {
  if (data.feesExpected === 0) return null
  const rate = data.collectionRate

  return (
    <div className="bg-white rounded-xl border border-gray-200 px-4 py-4">
      <div className="flex justify-between items-baseline mb-3">
        <p className="text-sm font-medium text-gray-700">Fee Collection</p>
        <p className="text-sm font-semibold text-gray-900 tabular-nums">{rate.toFixed(0)}%</p>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-1.5">
        <div
          className="h-1.5 rounded-full bg-gray-900 transition-all duration-700"
          style={{ width: `${Math.min(100, rate)}%` }}
        />
      </div>
      <div className="flex justify-between mt-2">
        <p className="text-xs text-gray-400">{formatNaira(data.feesCollected)} collected</p>
        <p className="text-xs text-gray-400">{formatNaira(data.feesExpected)} expected</p>
      </div>
    </div>
  )
}

// ── Trend chart ───────────────────────────────────────────────────────────────
function TrendChart({ data }: { data: DashboardData }) {
  const hasData = data.trend.some(t => t.revenue > 0 || t.expenses > 0)

  const chartData = data.trend.map(t => ({
    month: t.month,
    Revenue: t.revenue,
    Expenses: t.expenses,
  }))

  return (
    <div className="bg-white rounded-xl border border-gray-200 px-4 pt-4 pb-3">
      <p className="text-sm font-medium text-gray-700 mb-4">6-Month Trend</p>
      {!hasData ? (
        <p className="text-xs text-gray-400 text-center py-10">No data yet</p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={chartData} barGap={2} margin={{ top: 0, right: 0, left: -24, bottom: 0 }}>
              <XAxis
                dataKey="month"
                tick={{ fontSize: 11, fill: '#9ca3af' }}
                axisLine={false} tickLine={false}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#9ca3af' }}
                axisLine={false} tickLine={false}
                tickFormatter={v => `${(v / 1000).toFixed(0)}k`}
              />
              <Tooltip
                cursor={{ fill: '#f9fafb' }}
                contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12, boxShadow: 'none' }}
                formatter={(v: number) => [`₦${v.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`, '']}
              />
              <Bar dataKey="Revenue"  fill="#111827" radius={[3, 3, 0, 0]} maxBarSize={18} />
              <Bar dataKey="Expenses" fill="#d1d5db" radius={[3, 3, 0, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-1">
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="w-2.5 h-2.5 rounded-sm bg-gray-900 inline-block" /> Revenue
            </span>
            <span className="flex items-center gap-1.5 text-xs text-gray-500">
              <span className="w-2.5 h-2.5 rounded-sm bg-gray-300 inline-block" /> Expenses
            </span>
          </div>
        </>
      )}
    </div>
  )
}

// ── Expense breakdown ─────────────────────────────────────────────────────────
function ExpenseBreakdown({ data }: { data: DashboardData }) {
  if (data.expenseByCategory.length === 0) return null

  const total = data.totalExpenses

  return (
    <div className="bg-white rounded-xl border border-gray-200 px-4 pt-4 pb-2">
      <p className="text-sm font-medium text-gray-700 mb-4">Expenses by Category</p>
      <div className="space-y-3">
        {data.expenseByCategory.map(({ name, amount }) => {
          const pct = total > 0 ? (amount / total) * 100 : 0
          return (
            <div key={name}>
              <div className="flex justify-between items-baseline mb-1">
                <p className="text-xs text-gray-600 truncate pr-2">{name}</p>
                <p className="text-xs font-medium text-gray-900 tabular-nums shrink-0">{formatNaira(amount)}</p>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-1">
                <div
                  className="h-1 rounded-full bg-gray-400"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          )
        })}
      </div>
      <div className="border-t border-gray-100 mt-4 pt-3 flex justify-between">
        <p className="text-xs text-gray-400">Total</p>
        <p className="text-xs font-semibold text-gray-900 tabular-nums">{formatNaira(total)}</p>
      </div>
    </div>
  )
}

// ── Insights ──────────────────────────────────────────────────────────────────
function Insights({ data, periodLabel }: { data: DashboardData; periodLabel: string }) {
  const insights: { text: string; type: 'warn' | 'info' | 'good' }[] = []

  if (data.feesExpected > 0) {
    if (data.collectionRate < 50) {
      insights.push({ type: 'warn', text: `Fee collection is only ${data.collectionRate.toFixed(0)}% — ${formatNaira(data.outstandingFees)} is still outstanding.` })
    } else if (data.collectionRate < 80) {
      insights.push({ type: 'warn', text: `${formatNaira(data.outstandingFees)} in fees remains unpaid. Follow up with parents to close the gap.` })
    } else {
      insights.push({ type: 'good', text: `${data.collectionRate.toFixed(0)}% of fees collected ${periodLabel.toLowerCase()}. Strong collection rate.` })
    }
  }

  if (data.topExpenseCategory) {
    const pct = data.totalExpenses > 0
      ? ((data.topExpenseCategory.amount / data.totalExpenses) * 100).toFixed(0) : '0'
    insights.push({ type: 'info', text: `${data.topExpenseCategory.name} is your largest expense at ${formatNaira(data.topExpenseCategory.amount)} — ${pct}% of total spending.` })
  }

  if (data.classWithHighestDebt) {
    insights.push({ type: 'warn', text: `${data.classWithHighestDebt.class} has the highest unpaid balance: ${formatNaira(data.classWithHighestDebt.amount)}.` })
  }

  if (data.netProfit < 0) {
    insights.push({ type: 'warn', text: `Expenses exceeded revenue by ${formatNaira(Math.abs(data.netProfit))}. Review spending and chase outstanding fees.` })
  }

  if (insights.length === 0) return (
    <div className="bg-white rounded-xl border border-gray-200 px-4 py-4">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-1">Insights</p>
      <p className="text-sm text-gray-400">Add data to see insights here.</p>
    </div>
  )

  const dot: Record<string, string> = {
    warn: 'bg-amber-400',
    info: 'bg-gray-400',
    good: 'bg-emerald-500',
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 px-4 pt-4 pb-2">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-widest mb-3">Insights</p>
      <div className="space-y-3">
        {insights.map((ins, i) => (
          <div key={i} className="flex gap-3 pb-3 border-b border-gray-50 last:border-0 last:pb-0">
            <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${dot[ins.type]}`} />
            <p className="text-sm text-gray-600 leading-relaxed">{ins.text}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function LoadingSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="h-32 bg-gray-100 rounded-2xl" />
      <div className="grid grid-cols-2 gap-3">
        {[0,1,2,3].map(i => <div key={i} className="h-20 bg-gray-100 rounded-xl" />)}
      </div>
      <div className="h-10 bg-gray-100 rounded-xl" />
      <div className="h-48 bg-gray-100 rounded-xl" />
      <div className="h-36 bg-gray-100 rounded-xl" />
    </div>
  )
}
