import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import AppShell from '../components/layout/AppShell'
import RecordPaymentModal from '../components/students/RecordPaymentModal'
import { formatNaira } from '../lib/currency'
import { useAuth } from '../context/AuthContext'
import {
  fetchStudentById, fetchPaymentsForStudent, fetchFeeStructuresForClass,
  recordFeePayment, deleteFeePayment, type PaymentWithStructure,
} from '../lib/studentsApi'
import type { Database } from '../types/database'

type Student = Database['public']['Tables']['students']['Row']
type FeeStructure = Database['public']['Tables']['fee_structures']['Row']

const METHOD_LABEL: Record<string, string> = { cash: 'Cash', transfer: 'Transfer', pos: 'POS' }

export default function StudentDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()

  const [student, setStudent] = useState<Student | null>(null)
  const [payments, setPayments] = useState<PaymentWithStructure[]>([])
  const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showPayment, setShowPayment] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    if (!id) return
    setLoading(true); setError(null)
    try {
      const s = await fetchStudentById(id)
      const [p, f] = await Promise.all([fetchPaymentsForStudent(id), fetchFeeStructuresForClass(s.class)])
      setStudent(s); setPayments(p); setFeeStructures(f)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally { setLoading(false) }
  }, [id])

  useEffect(() => { load() }, [load])

  const feeBreakdown = feeStructures.map(fs => {
    const paid = payments.filter(p => p.fee_structure_id === fs.id).reduce((s, p) => s + p.amount_paid, 0)
    return { fs, paid, balance: fs.amount - paid }
  })

  const totalExpected = feeStructures.reduce((s, f) => s + f.amount, 0)
  const totalPaid = payments.reduce((s, p) => s + p.amount_paid, 0)
  const totalBalance = totalExpected - totalPaid
  const pct = totalExpected > 0 ? Math.min(100, (totalPaid / totalExpected) * 100) : 0

  const grouped = payments.reduce<Record<string, PaymentWithStructure[]>>((acc, p) => {
    const key = `${p.fee_structures.term} ${p.fee_structures.session}`
    if (!acc[key]) acc[key] = []
    acc[key].push(p)
    return acc
  }, {})

  async function handleRecordPayment(data: Database['public']['Tables']['fee_payments']['Insert']) {
    await recordFeePayment(data); await load()
  }

  async function handleDeletePayment(paymentId: string) {
    if (!confirm('Delete this payment record?')) return
    setDeletingId(paymentId)
    try { await deleteFeePayment(paymentId); await load() }
    catch (e: unknown) { alert(e instanceof Error ? e.message : 'Failed to delete') }
    finally { setDeletingId(null) }
  }

  if (loading) {
    return (
      <AppShell title="Student">
        <div className="space-y-3 animate-pulse">
          <div className="h-8 w-24 bg-gray-100 rounded" />
          <div className="h-32 bg-gray-100 rounded-xl" />
          <div className="h-24 bg-gray-100 rounded-xl" />
          <div className="h-48 bg-gray-100 rounded-xl" />
        </div>
      </AppShell>
    )
  }

  if (error || !student) {
    return (
      <AppShell title="Student">
        <button onClick={() => navigate('/students')} className="flex items-center gap-1.5 text-sm text-gray-500 mb-5">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
          Back
        </button>
        <p className="text-sm text-red-500">{error ?? 'Student not found'}</p>
        <button onClick={load} className="text-sm text-brand-600 underline mt-2">Retry</button>
      </AppShell>
    )
  }

  const recordBtn = (
    <button onClick={() => setShowPayment(true)}
      className="text-sm font-medium text-brand-600 px-3 py-1.5 rounded-lg border border-brand-200 hover:bg-brand-50 transition-colors">
      + Payment
    </button>
  )

  return (
    <AppShell title={student.name} action={recordBtn}>
      {/* Back */}
      <button onClick={() => navigate('/students')} className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-600 mb-5 transition-colors">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
        All Students
      </button>

      {/* Student info */}
      <div className="bg-white rounded-xl border border-gray-200 px-4 py-4 mb-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-base font-semibold text-gray-900">{student.name}</p>
            <p className="text-sm text-gray-400 mt-0.5">{student.class}</p>
          </div>
          <span className={`text-[10px] font-medium px-2 py-1 rounded border ${
            student.status === 'active'
              ? 'text-gray-600 border-gray-200'
              : 'text-gray-400 border-gray-100'
          }`}>
            {student.status === 'active' ? 'Active' : 'Withdrawn'}
          </span>
        </div>
        <div className="border-t border-gray-100 pt-3 grid grid-cols-2 gap-3">
          <div>
            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-0.5">Guardian</p>
            <p className="text-sm text-gray-700">{student.guardian_name}</p>
          </div>
          <div>
            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-0.5">Phone</p>
            <a href={`tel:${student.guardian_phone}`} className="text-sm text-brand-600 font-medium">
              {student.guardian_phone}
            </a>
          </div>
          <div>
            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-0.5">Admitted</p>
            <p className="text-sm text-gray-700">
              {new Date(student.admission_date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
            </p>
          </div>
        </div>
      </div>

      {/* Balance summary */}
      <div className="bg-white rounded-xl border border-gray-200 px-4 py-4 mb-4">
        <div className="flex justify-between items-start mb-3">
          <div>
            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">Total Paid</p>
            <p className="text-2xl font-bold text-gray-900 tabular-nums">{formatNaira(totalPaid)}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">Balance</p>
            <p className={`text-2xl font-bold tabular-nums ${totalBalance <= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
              {totalBalance <= 0 ? 'Cleared' : formatNaira(totalBalance)}
            </p>
          </div>
        </div>
        {totalExpected > 0 && (
          <>
            <div className="w-full bg-gray-100 rounded-full h-1.5">
              <div className="h-1.5 rounded-full bg-gray-900 transition-all duration-700" style={{ width: `${pct}%` }} />
            </div>
            <div className="flex justify-between mt-1.5">
              <p className="text-[10px] text-gray-400">{pct.toFixed(0)}% paid</p>
              <p className="text-[10px] text-gray-400 tabular-nums">{formatNaira(totalExpected)} expected</p>
            </div>
          </>
        )}
      </div>

      {/* Fee breakdown */}
      {feeBreakdown.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
          <div className="px-4 py-3 border-b border-gray-100">
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Fee Breakdown</p>
          </div>
          {feeBreakdown.map(({ fs, paid, balance }, i) => (
            <div key={fs.id} className={`px-4 py-3 flex justify-between items-center ${i < feeBreakdown.length - 1 ? 'border-b border-gray-50' : ''}`}>
              <div>
                <p className="text-sm text-gray-700">{fs.fee_type}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{fs.term} · {fs.session}</p>
              </div>
              <div className="text-right">
                <p className="text-sm font-medium text-gray-900 tabular-nums">
                  {formatNaira(paid)}<span className="text-gray-400 font-normal"> / {formatNaira(fs.amount)}</span>
                </p>
                <p className={`text-[11px] mt-0.5 ${balance > 0 ? 'text-red-400' : 'text-emerald-600'}`}>
                  {balance > 0 ? `${formatNaira(balance)} owed` : 'Paid ✓'}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Payment history */}
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-3">Payment History</p>

      {payments.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 flex flex-col items-center justify-center h-32">
          <p className="text-sm text-gray-400">No payments recorded yet.</p>
          <button onClick={() => setShowPayment(true)} className="text-sm text-brand-600 font-medium mt-1">
            Record first payment
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {Object.entries(grouped).map(([termKey, termPayments]) => (
            <div key={termKey} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">{termKey}</p>
                <p className="text-xs font-semibold text-gray-700 tabular-nums">
                  {formatNaira(termPayments.reduce((s, p) => s + p.amount_paid, 0))}
                </p>
              </div>
              {termPayments.map((p, i) => (
                <div key={p.id} className={`px-4 py-3 flex items-center justify-between gap-3 ${i < termPayments.length - 1 ? 'border-b border-gray-50' : ''}`}>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-gray-800">{p.fee_structures.fee_type}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {new Date(p.date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {' · '}{METHOD_LABEL[p.method] ?? p.method}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-semibold text-gray-900 tabular-nums">{formatNaira(p.amount_paid)}</p>
                    <button onClick={() => handleDeletePayment(p.id)} disabled={deletingId === p.id}
                      className="text-xs text-red-400 hover:text-red-600 disabled:opacity-40 mt-0.5">
                      {deletingId === p.id ? '…' : 'Delete'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {showPayment && (
        <RecordPaymentModal
          studentId={student.id} studentName={student.name} studentClass={student.class}
          feeStructures={feeStructures} recordedBy={user?.email ?? 'admin'}
          onSave={handleRecordPayment} onClose={() => setShowPayment(false)}
        />
      )}
    </AppShell>
  )
}
