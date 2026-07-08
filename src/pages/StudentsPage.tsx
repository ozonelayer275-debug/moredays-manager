import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import AppShell from '../components/layout/AppShell'
import AddStudentModal from '../components/students/AddStudentModal'
import FeeStructureModal from '../components/students/FeeStructureModal'
import { Sheet } from '../components/students/AddStudentModal'
import { formatNaira } from '../lib/currency'
import {
  fetchStudents, addStudent, updateStudent, deleteStudent,
  fetchOutstandingBalances, type StudentBalance,
  fetchFeeStructures, addFeeStructure, updateFeeStructure, deleteFeeStructure,
} from '../lib/studentsApi'
import { supabase } from '../lib/supabase'
import type { Database } from '../types/database'

type Student = Database['public']['Tables']['students']['Row']
type FeeStructure = Database['public']['Tables']['fee_structures']['Row']
type Tab = 'students' | 'outstanding' | 'fees'

const TABS: { key: Tab; label: string }[] = [
  { key: 'students',    label: 'Students'  },
  { key: 'outstanding', label: 'Owed'      },
  { key: 'fees',        label: 'Fee Setup' },
]

const CLASSES = [
  'Creche', 'Nursery 1', 'Nursery 2',
  'Primary 1', 'Primary 2', 'Primary 3',
  'Primary 4', 'Primary 5', 'Primary 6',
  'JSS 1', 'JSS 2', 'JSS 3',
  'SS 1', 'SS 2', 'SS 3',
]

export default function StudentsPage() {
  const navigate = useNavigate()
  const [tab, setTab] = useState<Tab>('students')
  const [students, setStudents] = useState<Student[]>([])
  const [balances, setBalances] = useState<StudentBalance[]>([])
  const [feeStructures, setFeeStructures] = useState<FeeStructure[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [classFilter, setClassFilter] = useState('all')
  const [feeSearch, setFeeSearch] = useState('')
  const [showAddStudent, setShowAddStudent] = useState(false)
  const [editingStudent, setEditingStudent] = useState<Student | null>(null)
  const [showFeeModal, setShowFeeModal] = useState(false)
  const [editingFee, setEditingFee] = useState<FeeStructure | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Bulk selection
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [showBulkModal, setShowBulkModal] = useState(false)
  const [bulkClass, setBulkClass] = useState(CLASSES[0])
  const [bulkSaving, setBulkSaving] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [s, b, f] = await Promise.all([fetchStudents(), fetchOutstandingBalances(), fetchFeeStructures()])
      setStudents(s); setBalances(b); setFeeStructures(f)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const allClasses = [...new Set(students.map(s => s.class))].sort()

  const filteredStudents = students.filter(s => {
    const matchesClass = classFilter === 'all' || s.class === classFilter
    const q = search.toLowerCase()
    const matchesSearch = !q ||
      s.name.toLowerCase().includes(q) ||
      s.class.toLowerCase().includes(q) ||
      (s.guardian_name ?? '').toLowerCase().includes(q)
    return matchesClass && matchesSearch
  })

  const groupedStudents = filteredStudents.reduce<Record<string, Student[]>>((acc, s) => {
    if (!acc[s.class]) acc[s.class] = []
    acc[s.class].push(s)
    return acc
  }, {})

  const sortedBalances = [...balances].filter(b => b.balance > 0).sort((a, b) => b.balance - a.balance)

  const filteredFees = feeStructures.filter(f =>
    f.class.toLowerCase().includes(feeSearch.toLowerCase()) ||
    f.fee_type.toLowerCase().includes(feeSearch.toLowerCase()) ||
    f.term.toLowerCase().includes(feeSearch.toLowerCase()) ||
    f.session.toLowerCase().includes(feeSearch.toLowerCase())
  )

  const feesByClass = filteredFees.reduce<Record<string, FeeStructure[]>>((acc, f) => {
    if (!acc[f.class]) acc[f.class] = []
    acc[f.class].push(f)
    return acc
  }, {})

  async function handleSaveStudent(data: Database['public']['Tables']['students']['Insert']) {
    if (editingStudent) { await updateStudent(editingStudent.id, data); setEditingStudent(null) }
    else await addStudent(data)
    await load()
  }

  async function handleDeleteStudent(id: string) {
    if (!confirm('Delete this student? All their payment records will also be deleted.')) return
    setDeletingId(id)
    try { await deleteStudent(id); await load() }
    catch (e: unknown) { alert(e instanceof Error ? e.message : 'Failed to delete') }
    finally { setDeletingId(null) }
  }

  async function handleSaveFee(data: Database['public']['Tables']['fee_structures']['Insert']) {
    if (editingFee) { await updateFeeStructure(editingFee.id, data); setEditingFee(null) }
    else await addFeeStructure(data)
    await load()
  }

  async function handleDeleteFee(id: string) {
    if (!confirm('Delete this fee structure?')) return
    setDeletingId(id)
    try { await deleteFeeStructure(id); await load() }
    catch (e: unknown) { alert(e instanceof Error ? e.message : 'Failed to delete') }
    finally { setDeletingId(null) }
  }

  async function handleBulkChangeClass() {
    setBulkSaving(true)
    try {
      const ids = [...selected]
      const { error } = await supabase
        .from('students')
        .update({ class: bulkClass })
        .in('id', ids)
      if (error) throw error
      setSelected(new Set())
      setShowBulkModal(false)
      await load()
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to update')
    } finally {
      setBulkSaving(false)
    }
  }

  function toggleSelect(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function toggleSelectClass(cls: string) {
    const classIds = (groupedStudents[cls] ?? []).map(s => s.id)
    const allSelected = classIds.every(id => selected.has(id))
    setSelected(prev => {
      const next = new Set(prev)
      if (allSelected) classIds.forEach(id => next.delete(id))
      else classIds.forEach(id => next.add(id))
      return next
    })
  }

  const actionButton = tab === 'fees' ? (
    <button onClick={() => setShowFeeModal(true)} className="bg-gray-900 text-white text-sm font-semibold px-4 py-2 rounded-xl">
      + Add Fee
    </button>
  ) : tab === 'students' ? (
    <button onClick={() => setShowAddStudent(true)} className="bg-gray-900 text-white text-sm font-semibold px-4 py-2 rounded-xl">
      + Add Student
    </button>
  ) : null

  return (
    <AppShell title="Students & Fees" action={actionButton}>
      <div className="flex gap-1 bg-gray-100 rounded-lg p-0.5 mb-5">
        {TABS.map(t => (
          <button key={t.key} onClick={() => { setTab(t.key); setSelected(new Set()) }}
            className={`flex-1 py-1.5 rounded-md text-xs font-medium transition-all ${
              tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600 mb-5">
          {error} — <button onClick={load} className="underline font-medium">Retry</button>
        </div>
      )}

      {loading ? (
        <LoadingSkeleton />
      ) : tab === 'students' ? (
        <StudentsTab
          students={filteredStudents} groupedStudents={groupedStudents}
          search={search} onSearch={setSearch}
          classFilter={classFilter} onClassFilter={setClassFilter}
          allClasses={allClasses}
          selected={selected}
          onToggleSelect={toggleSelect}
          onToggleSelectClass={toggleSelectClass}
          onClearSelect={() => setSelected(new Set())}
          onBulkChangeClass={() => { setBulkClass(CLASSES[0]); setShowBulkModal(true) }}
          deletingId={deletingId} onNavigate={id => navigate(`/students/${id}`)}
          onEdit={s => { setEditingStudent(s); setShowAddStudent(true) }}
          onDelete={handleDeleteStudent}
        />
      ) : tab === 'outstanding' ? (
        <OutstandingTab balances={sortedBalances} onNavigate={id => navigate(`/students/${id}`)} />
      ) : (
        <FeeStructuresTab
          feesByClass={feesByClass} search={feeSearch} onSearch={setFeeSearch}
          deletingId={deletingId}
          onEdit={f => { setEditingFee(f); setShowFeeModal(true) }}
          onDelete={handleDeleteFee} onAdd={() => setShowFeeModal(true)}
        />
      )}

      {showAddStudent && (
        <AddStudentModal student={editingStudent} onSave={handleSaveStudent}
          onClose={() => { setShowAddStudent(false); setEditingStudent(null) }} />
      )}
      {showFeeModal && (
        <FeeStructureModal structure={editingFee} onSave={handleSaveFee}
          onClose={() => { setShowFeeModal(false); setEditingFee(null) }} />
      )}

      {/* Bulk change class modal */}
      {showBulkModal && (
        <Sheet title={`Move ${selected.size} student${selected.size !== 1 ? 's' : ''} to class`} onClose={() => setShowBulkModal(false)}>
          <div className="space-y-4">
            <select
              value={bulkClass}
              onChange={e => setBulkClass(e.target.value)}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-gray-900"
            >
              {CLASSES.map(c => <option key={c}>{c}</option>)}
            </select>
            <button
              onClick={handleBulkChangeClass}
              disabled={bulkSaving}
              className="w-full bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white text-sm font-medium rounded-lg py-3 transition-colors"
            >
              {bulkSaving ? 'Saving…' : `Move to ${bulkClass}`}
            </button>
          </div>
        </Sheet>
      )}
    </AppShell>
  )
}

// ── Students Tab ──────────────────────────────────────────────────────────────
function StudentsTab({ students, groupedStudents, search, onSearch, classFilter, onClassFilter, allClasses, selected, onToggleSelect, onToggleSelectClass, onClearSelect, onBulkChangeClass, deletingId, onNavigate, onEdit, onDelete }: {
  students: Student[]
  groupedStudents: Record<string, Student[]>
  search: string; onSearch: (v: string) => void
  classFilter: string; onClassFilter: (v: string) => void
  allClasses: string[]
  selected: Set<string>
  onToggleSelect: (id: string) => void
  onToggleSelectClass: (cls: string) => void
  onClearSelect: () => void
  onBulkChangeClass: () => void
  deletingId: string | null; onNavigate: (id: string) => void
  onEdit: (s: Student) => void; onDelete: (id: string) => void
}) {
  const classes = Object.keys(groupedStudents).sort()
  const isSelecting = selected.size > 0

  return (
    <div className="space-y-3">
      {/* Search + class filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
          <input value={search} onChange={e => onSearch(e.target.value)}
            placeholder="Search name or guardian…"
            className="w-full border border-gray-200 rounded-lg pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white" />
        </div>
        <select value={classFilter} onChange={e => onClassFilter(e.target.value)}
          className="border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white shrink-0">
          <option value="all">All Classes</option>
          {allClasses.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      {students.length === 0 ? (
        <EmptyState text={search || classFilter !== 'all' ? 'No students match your filter.' : 'No students yet — tap + Add Student.'} />
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">{students.length} student{students.length !== 1 ? 's' : ''}</p>
            {isSelecting ? (
              <div className="flex items-center gap-3">
                <p className="text-xs font-medium text-gray-700">{selected.size} selected</p>
                <button onClick={onBulkChangeClass}
                  className="text-xs font-medium text-white bg-gray-900 px-3 py-1.5 rounded-lg">
                  Change Class
                </button>
                <button onClick={onClearSelect} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
              </div>
            ) : (
              <p className="text-xs text-gray-400">Tap checkbox to select</p>
            )}
          </div>

          {classes.map(cls => {
            const classStudents = groupedStudents[cls]
            const allClassSelected = classStudents.every(s => selected.has(s.id))
            const someClassSelected = classStudents.some(s => selected.has(s.id))

            return (
              <div key={cls} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-2.5 bg-gray-50 border-b border-gray-100 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    {/* Select-all checkbox for this class */}
                    <button
                      onClick={() => onToggleSelectClass(cls)}
                      className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                        allClassSelected ? 'bg-gray-900 border-gray-900' :
                        someClassSelected ? 'bg-gray-400 border-gray-400' :
                        'border-gray-300 bg-white'
                      }`}
                    >
                      {(allClassSelected || someClassSelected) && (
                        <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                          {allClassSelected
                            ? <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            : <path strokeLinecap="round" strokeLinejoin="round" d="M5 12h14" />
                          }
                        </svg>
                      )}
                    </button>
                    <p className="text-[10px] uppercase tracking-wider font-medium text-gray-400">{cls}</p>
                  </div>
                  <p className="text-[10px] uppercase tracking-wider font-medium text-gray-400">
                    {classStudents.length} student{classStudents.length !== 1 ? 's' : ''}
                  </p>
                </div>

                <div className="divide-y divide-gray-100">
                  {classStudents.map(s => {
                    const isSelected = selected.has(s.id)
                    return (
                      <div key={s.id}
                        className={`px-4 py-3 flex items-center gap-3 transition-colors ${isSelected ? 'bg-gray-50' : 'active:bg-gray-50'}`}>
                        {/* Row checkbox */}
                        <button
                          onClick={() => onToggleSelect(s.id)}
                          className={`w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors ${
                            isSelected ? 'bg-gray-900 border-gray-900' : 'border-gray-300 bg-white'
                          }`}
                        >
                          {isSelected && (
                            <svg className="w-2.5 h-2.5 text-white" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                            </svg>
                          )}
                        </button>

                        {/* Name — tapping navigates unless selecting */}
                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => isSelecting ? onToggleSelect(s.id) : onNavigate(s.id)}>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-900 truncate">{s.name}</p>
                            {s.status === 'withdrawn' && (
                              <span className="text-[10px] font-medium text-gray-400 border border-gray-200 px-1.5 py-0.5 rounded shrink-0">Withdrawn</span>
                            )}
                          </div>
                          {s.guardian_name && (
                            <p className="text-xs text-gray-400 mt-0.5">{s.guardian_name}</p>
                          )}
                        </div>

                        {!isSelecting && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button onClick={e => { e.stopPropagation(); onEdit(s) }}
                              className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1 rounded hover:bg-gray-100 transition-colors">Edit</button>
                            <button onClick={e => { e.stopPropagation(); onDelete(s.id) }}
                              disabled={deletingId === s.id}
                              className="text-xs text-red-400 hover:text-red-600 px-2 py-1 rounded hover:bg-red-50 transition-colors disabled:opacity-40">
                              {deletingId === s.id ? '…' : 'Del'}
                            </button>
                            <svg className="text-gray-300 ml-1" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}

// ── Outstanding Tab ───────────────────────────────────────────────────────────
function OutstandingTab({ balances, onNavigate }: { balances: StudentBalance[]; onNavigate: (id: string) => void }) {
  if (balances.length === 0) {
    return <EmptyState text="No outstanding balances — all fees are cleared." />
  }

  const grandTotal = balances.reduce((s, b) => s + b.balance, 0)

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl border border-gray-200 px-4 py-3 flex justify-between items-center">
        <p className="text-sm text-gray-500">{balances.length} student{balances.length !== 1 ? 's' : ''} with unpaid fees</p>
        <p className="text-sm font-semibold text-gray-900 tabular-nums">{formatNaira(grandTotal)}</p>
      </div>

      {balances.map(({ student, totalExpected, totalPaid, balance }) => {
        const pct = totalExpected > 0 ? Math.min(100, (totalPaid / totalExpected) * 100) : 0
        return (
          <div key={student.id} onClick={() => onNavigate(student.id)}
            className="bg-white rounded-xl border border-gray-200 px-4 py-4 cursor-pointer active:bg-gray-50 transition-colors">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{student.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">{student.class}</p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold text-red-500 tabular-nums">{formatNaira(balance)}</p>
                <p className="text-[10px] text-gray-400 mt-0.5">outstanding</p>
              </div>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1">
              <div className="h-1 rounded-full bg-gray-900 transition-all" style={{ width: `${pct}%` }} />
            </div>
            <div className="flex justify-between mt-1.5">
              <p className="text-[10px] text-gray-400 tabular-nums">{formatNaira(totalPaid)} paid</p>
              <p className="text-[10px] text-gray-400 tabular-nums">{formatNaira(totalExpected)} total</p>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ── Fee Structures Tab ────────────────────────────────────────────────────────
function FeeStructuresTab({ feesByClass, search, onSearch, deletingId, onEdit, onDelete, onAdd }: {
  feesByClass: Record<string, FeeStructure[]>; search: string; onSearch: (v: string) => void
  deletingId: string | null; onEdit: (f: FeeStructure) => void
  onDelete: (id: string) => void; onAdd: () => void
}) {
  const classes = Object.keys(feesByClass).sort()

  return (
    <div className="space-y-3">
      <div className="relative">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
        </svg>
        <input value={search} onChange={e => onSearch(e.target.value)}
          placeholder="Filter by class, term or fee type…"
          className="w-full border border-gray-200 rounded-lg pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white" />
      </div>

      {classes.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-center">
          <p className="text-sm text-gray-400">
            {search ? `No fee structures match "${search}"` : 'No fee structures yet.'}
          </p>
          {!search && (
            <button onClick={onAdd} className="mt-3 bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg">
              + Add First Fee Structure
            </button>
          )}
        </div>
      ) : (
        classes.map(cls => {
          const fees = feesByClass[cls]
          const byTerm = fees.reduce<Record<string, FeeStructure[]>>((acc, f) => {
            const key = `${f.term} · ${f.session}`
            if (!acc[key]) acc[key] = []
            acc[key].push(f)
            return acc
          }, {})

          return (
            <div key={cls} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center">
                <p className="text-sm font-semibold text-gray-900">{cls}</p>
                <p className="text-xs text-gray-400 tabular-nums">
                  {formatNaira(fees.reduce((s, f) => s + f.amount, 0))} / term
                </p>
              </div>
              {Object.entries(byTerm).map(([termKey, termFees]) => (
                <div key={termKey}>
                  <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
                    <p className="text-[11px] font-medium text-gray-400 uppercase tracking-wider">{termKey}</p>
                  </div>
                  {termFees.map((f, i) => (
                    <div key={f.id} className={`px-4 py-3 flex items-center justify-between gap-3 ${i < termFees.length - 1 ? 'border-b border-gray-50' : ''}`}>
                      <p className="text-sm text-gray-700 flex-1">{f.fee_type}</p>
                      <div className="flex items-center gap-3 shrink-0">
                        <p className="text-sm font-semibold text-gray-900 tabular-nums">{formatNaira(f.amount)}</p>
                        <button onClick={() => onEdit(f)} className="text-xs text-gray-400 hover:text-gray-700 transition-colors">Edit</button>
                        <button onClick={() => onDelete(f.id)} disabled={deletingId === f.id}
                          className="text-xs text-red-400 hover:text-red-600 transition-colors disabled:opacity-40">
                          {deletingId === f.id ? '…' : 'Del'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )
        })
      )}
    </div>
  )
}

function EmptyState({ text }: { text: string }) {
  return (
    <div className="flex items-center justify-center h-48">
      <p className="text-sm text-gray-400 text-center">{text}</p>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3 animate-pulse">
      <div className="h-10 bg-gray-100 rounded-lg" />
      {[0,1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl" />)}
    </div>
  )
}
