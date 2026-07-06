import { useState, useEffect, useCallback, useRef } from 'react'
import AppShell from '../components/layout/AppShell'
import { formatNaira } from '../lib/currency'
import {
  fetchReportData, exportFeesCSV, exportSalesCSV,
  exportExpensesCSV, exportSummaryCSV, type ReportData,
} from '../lib/reportsApi'

type Preset = 'this_month' | 'last_month' | 'this_term' | 'this_year' | 'custom'

function getPresetRange(preset: Preset): { from: string; to: string } {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const fmt = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

  if (preset === 'this_month') return {
    from: fmt(new Date(now.getFullYear(), now.getMonth(), 1)),
    to:   fmt(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  }
  if (preset === 'last_month') return {
    from: fmt(new Date(now.getFullYear(), now.getMonth() - 1, 1)),
    to:   fmt(new Date(now.getFullYear(), now.getMonth(), 0)),
  }
  if (preset === 'this_term') {
    const q = Math.floor(now.getMonth() / 3)
    return {
      from: fmt(new Date(now.getFullYear(), q * 3, 1)),
      to:   fmt(new Date(now.getFullYear(), q * 3 + 3, 0)),
    }
  }
  if (preset === 'this_year') return {
    from: `${now.getFullYear()}-01-01`,
    to:   `${now.getFullYear()}-12-31`,
  }
  return {
    from: fmt(new Date(now.getFullYear(), now.getMonth(), 1)),
    to:   fmt(new Date(now.getFullYear(), now.getMonth() + 1, 0)),
  }
}

const PRESETS: { key: Preset; label: string }[] = [
  { key: 'this_month', label: 'This Month' },
  { key: 'last_month', label: 'Last Month' },
  { key: 'this_term',  label: 'This Term'  },
  { key: 'this_year',  label: 'This Year'  },
  { key: 'custom',     label: 'Custom'     },
]

const inputCls = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white'

export default function ReportsPage() {
  const [preset, setPreset] = useState<Preset>('this_month')
  const [from, setFrom] = useState(() => getPresetRange('this_month').from)
  const [to, setTo]     = useState(() => getPresetRange('this_month').to)
  const [data, setData] = useState<ReportData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const printRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try { setData(await fetchReportData(from, to)) }
    catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed to load') }
    finally { setLoading(false) }
  }, [from, to])

  useEffect(() => { load() }, [load])

  function handlePreset(p: Preset) {
    setPreset(p)
    if (p !== 'custom') {
      const range = getPresetRange(p)
      setFrom(range.from); setTo(range.to)
    }
  }

  const periodLabel = preset === 'custom'
    ? `${from} to ${to}`
    : PRESETS.find(p => p.key === preset)!.label

  return (
    <AppShell title="Reports">
      {/* Period selector */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 mb-4 no-scrollbar">
        {PRESETS.map(p => (
          <button key={p.key} onClick={() => handlePreset(p.key)}
            className={`shrink-0 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              preset === p.key
                ? 'bg-gray-900 text-white'
                : 'bg-gray-100 text-gray-600'
            }`}>
            {p.label}
          </button>
        ))}
      </div>

      {/* Custom date range */}
      {preset === 'custom' && (
        <div className="flex gap-3 mb-4">
          <div className="flex-1">
            <label className="block text-[10px] uppercase tracking-wider text-gray-400 font-medium mb-1.5">From</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className={inputCls} />
          </div>
          <div className="flex-1">
            <label className="block text-[10px] uppercase tracking-wider text-gray-400 font-medium mb-1.5">To</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className={inputCls} />
          </div>
        </div>
      )}

      {error && (
        <div className="border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 mb-4">
          {error} — <button onClick={load} className="underline">Retry</button>
        </div>
      )}

      {loading ? (
        <div className="space-y-3 animate-pulse">
          <div className="h-20 bg-gray-100 rounded-xl" />
          <div className="h-32 bg-gray-100 rounded-xl" />
          <div className="h-40 bg-gray-100 rounded-xl" />
          <div className="h-40 bg-gray-100 rounded-xl" />
        </div>
      ) : data ? (
        <>
          {/* Export actions */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <button onClick={() => window.print()}
              className="flex items-center justify-center gap-2 bg-white border border-gray-200 rounded-xl py-3 text-sm font-medium text-gray-700 active:bg-gray-50 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.72 13.829c-.24.03-.48.062-.72.096m.72-.096a42.415 42.415 0 0 1 10.56 0m-10.56 0L6.34 18m10.94-4.171c.24.03.48.062.72.096m-.72-.096L17.66 18m0 0 .229 2.523a1.125 1.125 0 0 1-1.12 1.227H7.231c-.662 0-1.18-.568-1.12-1.227L6.34 18m11.318 0h1.091A2.25 2.25 0 0 0 21 15.75V9.456c0-1.081-.768-2.015-1.837-2.175a48.055 48.055 0 0 0-1.913-.247M6.34 18H5.25A2.25 2.25 0 0 1 3 15.75V9.456c0-1.081.768-2.015 1.837-2.175a48.041 48.041 0 0 1 1.913-.247m10.5 0a48.536 48.536 0 0 0-10.5 0m10.5 0V3.375c0-.621-.504-1.125-1.125-1.125h-8.25c-.621 0-1.125.504-1.125 1.125v3.659M18 10.5h.008v.008H18V10.5Zm-3 0h.008v.008H15V10.5Z" />
              </svg>
              Print
            </button>
            <button onClick={() => exportSummaryCSV(data)}
              className="flex items-center justify-center gap-2 bg-gray-900 text-white rounded-xl py-3 text-sm font-medium active:bg-gray-800 transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              Export Summary
            </button>
          </div>

          <div className="grid grid-cols-3 gap-2 mb-4">
            {[
              { label: 'Fees CSV',     action: () => exportFeesCSV(data.feePaymentRows, from, to) },
              { label: 'Sales CSV',    action: () => exportSalesCSV(data.saleRows, from, to) },
              { label: 'Expenses CSV', action: () => exportExpensesCSV(data.expenseRows, from, to) },
            ].map(({ label, action }) => (
              <button key={label} onClick={action}
                className="flex flex-col items-center bg-white border border-gray-200 rounded-xl py-3 text-xs font-medium text-gray-600 active:bg-gray-50 transition-colors gap-1">
                <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3" />
                </svg>
                {label}
              </button>
            ))}
          </div>

          {/* Printable report */}
          <div ref={printRef} className="space-y-3 print-area">

            {/* Period header */}
            <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
              <p className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">Period</p>
              <p className="text-base font-semibold text-gray-900 mt-0.5">{periodLabel}</p>
              {preset === 'custom' && (
                <p className="text-xs text-gray-400 mt-0.5">{from} → {to}</p>
              )}
            </div>

            {/* Net profit hero */}
            <div className="bg-white rounded-xl border border-gray-200 px-4 py-4 text-center">
              <p className="text-[10px] uppercase tracking-wider text-gray-400 font-medium mb-1">
                Net {data.netProfit >= 0 ? 'Profit' : 'Loss'}
              </p>
              <p className={`text-4xl font-bold tabular-nums ${data.netProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                {formatNaira(Math.abs(data.netProfit))}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                {data.netProfit >= 0
                  ? `Earned ${formatNaira(data.totalRevenue)} · Spent ${formatNaira(data.totalExpenses)}`
                  : `Spent ${formatNaira(Math.abs(data.netProfit))} more than earned`}
              </p>
            </div>

            {/* Revenue */}
            <Section title="Revenue">
              <Row label="Fees Collected" value={formatNaira(data.feesCollected)} bold />
              <Row label="Sales Revenue"  value={formatNaira(data.salesRevenue)} />
              <Row label="Sales Profit"   value={formatNaira(data.salesProfit)} sub />
              <Divider />
              <Row label="Total Revenue"  value={formatNaira(data.totalRevenue)} bold highlight="green" />
            </Section>

            {/* Expenses */}
            <Section title="Expenses">
              {data.expenseByCategory.length === 0 ? (
                <p className="text-sm text-gray-400 px-4 py-3">No expenses in this period</p>
              ) : (
                data.expenseByCategory.map(e => (
                  <Row key={e.name} label={e.name} value={formatNaira(e.amount)} />
                ))
              )}
              <Divider />
              <Row label="Total Expenses" value={formatNaira(data.totalExpenses)} bold highlight="red" />
            </Section>

            {/* Fee collection */}
            <Section title="Fee Collection">
              <Row label="Expected"         value={formatNaira(data.feesExpected)} />
              <Row label="Collected"        value={formatNaira(data.feesCollected)} bold />
              <Row label="Outstanding"      value={formatNaira(data.outstandingFees)} highlight={data.outstandingFees > 0 ? 'red' : undefined} />
              <div className="px-4 py-3 border-b border-gray-100">
                <div className="flex justify-between text-xs mb-1.5">
                  <span className="text-gray-500">Collection Rate</span>
                  <span className="font-semibold text-gray-900 tabular-nums">{data.collectionRate.toFixed(1)}%</span>
                </div>
                <div className="w-full bg-gray-100 rounded-full h-1.5">
                  <div className="h-1.5 rounded-full bg-gray-900" style={{ width: `${Math.min(100, data.collectionRate)}%` }} />
                </div>
              </div>
              <Row label="Active Students"    value={String(data.studentCount)} />
              <Row label="Students with Debt" value={String(data.studentsWithDebt)} highlight={data.studentsWithDebt > 0 ? 'red' : undefined} />
            </Section>

            {/* Activity */}
            <Section title="Activity">
              <Row label="Fee Payments" value={String(data.feePaymentRows.length)} />
              <Row label="Sales"        value={String(data.saleRows.length)} />
              <Row label="Expenses"     value={String(data.expenseRows.length)} />
            </Section>

            {/* Expense breakdown */}
            {data.expenseByCategory.length > 0 && (
              <Section title="Expense Breakdown">
                {data.expenseByCategory.map((e, i) => {
                  const pct = data.totalExpenses > 0
                    ? ((e.amount / data.totalExpenses) * 100).toFixed(0)
                    : '0'
                  return (
                    <div key={i} className="px-4 py-3 border-b border-gray-100 last:border-0">
                      <div className="flex justify-between text-sm mb-1.5">
                        <span className="text-gray-600">{e.name}</span>
                        <span className="font-medium text-gray-900 tabular-nums">{formatNaira(e.amount)}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-100 rounded-full h-1.5">
                          <div className="h-1.5 rounded-full bg-gray-900" style={{ width: `${pct}%` }} />
                        </div>
                        <span className="text-xs text-gray-400 w-8 text-right tabular-nums">{pct}%</span>
                      </div>
                    </div>
                  )
                })}
              </Section>
            )}

            <p className="text-xs text-gray-400 text-center pb-4">
              Moredays Manager · {new Date().toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })}
            </p>
          </div>
        </>
      ) : null}
    </AppShell>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-100">
        <p className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">{title}</p>
      </div>
      {children}
    </div>
  )
}

function Row({ label, value, bold, sub, highlight }: {
  label: string; value: string
  bold?: boolean; sub?: boolean
  highlight?: 'green' | 'red'
}) {
  return (
    <div className="flex justify-between items-center px-4 py-3 border-b border-gray-100 last:border-0">
      <span className={`text-sm ${sub ? 'text-gray-400 pl-3' : 'text-gray-500'}`}>{label}</span>
      <span className={`text-sm tabular-nums ${bold ? 'font-semibold' : 'font-medium'} ${
        highlight === 'green' ? 'text-emerald-600' :
        highlight === 'red'   ? 'text-red-500'     : 'text-gray-900'
      }`}>{value}</span>
    </div>
  )
}

function Divider() {
  return <div className="border-t border-gray-200 mx-4" />
}
