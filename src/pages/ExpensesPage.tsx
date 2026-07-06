import { useState, useEffect, useCallback } from 'react'
import AppShell from '../components/layout/AppShell'
import ExpenseModal from '../components/expenses/ExpenseModal'
import { formatNaira } from '../lib/currency'
import { useAuth } from '../context/AuthContext'
import {
  fetchExpenses, fetchCategories, addExpense, updateExpense, deleteExpense,
  addCategory, updateCategory, deleteCategory, duplicateRecurringExpense,
  type ExpenseWithCategory,
} from '../lib/expensesApi'
import type { Database } from '../types/database'

type Category = Database['public']['Tables']['expense_categories']['Row']
type Tab = 'expenses' | 'categories'

export default function ExpensesPage() {
  const { user } = useAuth()
  const [tab, setTab] = useState<Tab>('expenses')
  const [expenses, setExpenses] = useState<ExpenseWithCategory[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [search, setSearch] = useState('')
  const [filterCat, setFilterCat] = useState('all')

  const [showModal, setShowModal] = useState(false)
  const [editing, setEditing] = useState<ExpenseWithCategory | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const [editingCat, setEditingCat] = useState<Category | null>(null)
  const [editCatName, setEditCatName] = useState('')
  const [savingCat, setSavingCat] = useState(false)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const [e, c] = await Promise.all([fetchExpenses(), fetchCategories()])
      setExpenses(e); setCategories(c)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load')
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])

  const filtered = expenses.filter(e => {
    const matchesCat = filterCat === 'all' || e.category_id === filterCat
    const matchesSearch =
      e.description.toLowerCase().includes(search.toLowerCase()) ||
      e.expense_categories.name.toLowerCase().includes(search.toLowerCase())
    return matchesCat && matchesSearch
  })

  const grouped = filtered.reduce<Record<string, ExpenseWithCategory[]>>((acc, e) => {
    const key = e.date.slice(0, 7)
    if (!acc[key]) acc[key] = []
    acc[key].push(e)
    return acc
  }, {})
  const sortedMonths = Object.keys(grouped).sort((a, b) => b.localeCompare(a))

  const totalFiltered = filtered.reduce((s, e) => s + e.amount, 0)
  const thisMonth = new Date().toISOString().slice(0, 7)
  const thisMonthTotal = expenses
    .filter(e => e.date.startsWith(thisMonth))
    .reduce((s, e) => s + e.amount, 0)

  const byCat = categories.map(c => ({
    ...c,
    total: expenses.filter(e => e.category_id === c.id).reduce((s, e) => s + e.amount, 0),
    count: expenses.filter(e => e.category_id === c.id).length,
  })).filter(c => c.total > 0).sort((a, b) => b.total - a.total)

  const recurringExpenses = expenses.filter(e => e.recurring)

  async function handleSave(data: Database['public']['Tables']['expenses']['Insert']) {
    if (editing) { await updateExpense(editing.id, data); setEditing(null) }
    else await addExpense(data)
    await load()
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this expense?')) return
    setDeletingId(id)
    try { await deleteExpense(id); await load() }
    catch (e: unknown) { alert(e instanceof Error ? e.message : 'Failed to delete') }
    finally { setDeletingId(null) }
  }

  async function handleDuplicate(expense: ExpenseWithCategory) {
    try {
      await duplicateRecurringExpense(expense, user?.email ?? 'admin')
      await load()
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Failed to duplicate')
    }
  }

  async function handleAddCategory(name: string) {
    const cat = await addCategory(name)
    await load()
    return cat
  }

  async function handleSaveCat() {
    if (!editingCat || !editCatName.trim()) return
    setSavingCat(true)
    try { await updateCategory(editingCat.id, editCatName.trim()); setEditingCat(null); await load() }
    catch (e: unknown) { alert(e instanceof Error ? e.message : 'Failed to update') }
    finally { setSavingCat(false) }
  }

  async function handleDeleteCat(id: string) {
    if (!confirm('Delete this category? Expenses in it will become uncategorised.')) return
    setDeletingId(id)
    try { await deleteCategory(id); await load() }
    catch (e: unknown) { alert(e instanceof Error ? e.message : 'Failed to delete') }
    finally { setDeletingId(null) }
  }

  const actionButton = (
    <button
      onClick={() => setShowModal(true)}
      className="bg-gray-900 text-white text-sm font-semibold px-4 py-2 rounded-xl"
    >
      + Add Expense
    </button>
  )

  return (
    <AppShell title="Expenses" action={actionButton}>
      {/* Tabs */}
      <div className="flex bg-gray-100 rounded-lg p-0.5 mb-4">
        {([
          { key: 'expenses', label: 'Expenses' },
          { key: 'categories', label: 'Categories' },
        ] as { key: Tab; label: string }[]).map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors ${
              tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}>
            {t.label}
          </button>
        ))}
      </div>

      {error && (
        <div className="border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 mb-4">
          {error} — <button onClick={load} className="underline">Retry</button>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
              <div className="h-4 bg-gray-100 rounded w-1/2 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : tab === 'expenses' ? (
        <ExpensesTab
          expenses={filtered}
          grouped={grouped}
          sortedMonths={sortedMonths}
          categories={categories}
          recurringExpenses={recurringExpenses}
          search={search}
          filterCat={filterCat}
          totalFiltered={totalFiltered}
          thisMonthTotal={thisMonthTotal}
          byCat={byCat}
          deletingId={deletingId}
          onSearch={setSearch}
          onFilterCat={setFilterCat}
          onEdit={e => { setEditing(e); setShowModal(true) }}
          onDelete={handleDelete}
          onDuplicate={handleDuplicate}
          onAdd={() => setShowModal(true)}
        />
      ) : (
        <CategoriesTab
          categories={categories}
          byCat={byCat}
          editingCat={editingCat}
          editCatName={editCatName}
          savingCat={savingCat}
          deletingId={deletingId}
          onStartEdit={c => { setEditingCat(c); setEditCatName(c.name) }}
          onCancelEdit={() => setEditingCat(null)}
          onEditNameChange={setEditCatName}
          onSaveCat={handleSaveCat}
          onDeleteCat={handleDeleteCat}
        />
      )}

      {showModal && (
        <ExpenseModal
          expense={editing}
          categories={categories}
          recordedBy={user?.email ?? 'admin'}
          onSave={handleSave}
          onAddCategory={handleAddCategory}
          onClose={() => { setShowModal(false); setEditing(null) }}
        />
      )}
    </AppShell>
  )
}

// ── Expenses Tab ──────────────────────────────────────────────────────────────
function ExpensesTab({
  expenses, grouped, sortedMonths, categories, recurringExpenses,
  search, filterCat, totalFiltered, thisMonthTotal, byCat,
  deletingId, onSearch, onFilterCat, onEdit, onDelete, onDuplicate, onAdd,
}: {
  expenses: ExpenseWithCategory[]
  grouped: Record<string, ExpenseWithCategory[]>
  sortedMonths: string[]
  categories: { id: string; name: string }[]
  recurringExpenses: ExpenseWithCategory[]
  search: string
  filterCat: string
  totalFiltered: number
  thisMonthTotal: number
  byCat: { id: string; name: string; total: number; count: number }[]
  deletingId: string | null
  onSearch: (v: string) => void
  onFilterCat: (v: string) => void
  onEdit: (e: ExpenseWithCategory) => void
  onDelete: (id: string) => void
  onDuplicate: (e: ExpenseWithCategory) => void
  onAdd: () => void
}) {
  const grandTotal = byCat.reduce((s, c) => s + c.total, 0)

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <p className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">This Month</p>
          <p className="text-xl font-bold text-red-500 mt-1 tabular-nums">{formatNaira(thisMonthTotal)}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <p className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">Showing</p>
          <p className="text-xl font-bold text-gray-900 mt-1 tabular-nums">{formatNaira(totalFiltered)}</p>
        </div>
      </div>

      {/* Spending by category */}
      {byCat.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <p className="text-[10px] uppercase tracking-wider text-gray-400 font-medium mb-3">By Category</p>
          <div className="space-y-2.5">
            {byCat.slice(0, 4).map(c => {
              const pct = grandTotal > 0 ? (c.total / grandTotal) * 100 : 0
              return (
                <div key={c.id}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-gray-600 font-medium">{c.name}</span>
                    <span className="text-gray-400 tabular-nums">{formatNaira(c.total)}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-1.5">
                    <div className="h-1.5 rounded-full bg-gray-900" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Recurring quick-log */}
      {recurringExpenses.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
          <p className="text-[10px] uppercase tracking-wider text-gray-400 font-medium mb-2">Recurring — tap to re-log today</p>
          <div className="flex flex-wrap gap-2">
            {recurringExpenses.map(e => (
              <button key={e.id} onClick={() => onDuplicate(e)}
                className="border border-gray-200 text-gray-700 text-xs font-medium px-3 py-1.5 rounded-lg bg-gray-50 active:bg-gray-100 transition-colors">
                {e.expense_categories.name} · {formatNaira(e.amount)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Search + filter */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
          </svg>
          <input
            value={search}
            onChange={e => onSearch(e.target.value)}
            placeholder="Search expenses…"
            className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
          />
        </div>
        <select
          value={filterCat}
          onChange={e => onFilterCat(e.target.value)}
          className="border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white"
        >
          <option value="all">All</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Expense list */}
      {expenses.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-center">
          <svg className="w-10 h-10 text-gray-300 mb-3" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75" />
          </svg>
          <p className="text-gray-400 text-sm">
            {search || filterCat !== 'all' ? 'No expenses match your filter' : 'No expenses yet'}
          </p>
          {!search && filterCat === 'all' && (
            <button onClick={onAdd} className="mt-3 bg-gray-900 text-white text-sm font-semibold px-5 py-2 rounded-xl">
              + Add First Expense
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {sortedMonths.map(month => {
            const monthExpenses = grouped[month]
            const monthTotal = monthExpenses.reduce((s, e) => s + e.amount, 0)
            const label = new Date(month + '-01').toLocaleDateString('en-NG', { month: 'long', year: 'numeric' })
            return (
              <div key={month} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="bg-gray-50 px-4 py-2.5 flex justify-between items-center border-b border-gray-100">
                  <p className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">{label}</p>
                  <p className="text-sm font-semibold text-red-500 tabular-nums">{formatNaira(monthTotal)}</p>
                </div>
                <div className="divide-y divide-gray-100">
                  {monthExpenses.map(e => (
                    <div key={e.id} className="px-4 py-3 flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] uppercase tracking-wider font-medium text-gray-500 shrink-0">
                            {e.expense_categories.name}
                          </span>
                          {e.recurring && (
                            <span className="text-[10px] uppercase tracking-wider font-medium text-gray-400 shrink-0">Recurring</span>
                          )}
                        </div>
                        {e.description && (
                          <p className="text-sm text-gray-700 mt-0.5 truncate">{e.description}</p>
                        )}
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(e.date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                          {e.recorded_by ? ` · ${e.recorded_by}` : ''}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-semibold text-gray-900 tabular-nums">{formatNaira(e.amount)}</p>
                        <div className="flex gap-3 justify-end mt-1">
                          <button onClick={() => onEdit(e)} className="text-xs text-gray-600 hover:text-gray-900 font-medium transition-colors">Edit</button>
                          <button onClick={() => onDelete(e.id)} disabled={deletingId === e.id}
                            className="text-xs text-gray-400 hover:text-red-500 disabled:opacity-40 transition-colors">
                            {deletingId === e.id ? '…' : 'Delete'}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// ── Categories Tab ────────────────────────────────────────────────────────────
function CategoriesTab({
  categories, byCat, editingCat, editCatName, savingCat, deletingId,
  onStartEdit, onCancelEdit, onEditNameChange, onSaveCat, onDeleteCat,
}: {
  categories: Category[]
  byCat: { id: string; name: string; total: number; count: number }[]
  editingCat: Category | null
  editCatName: string
  savingCat: boolean
  deletingId: string | null
  onStartEdit: (c: Category) => void
  onCancelEdit: () => void
  onEditNameChange: (v: string) => void
  onSaveCat: () => void
  onDeleteCat: (id: string) => void
}) {
  return (
    <div className="space-y-3">
      <p className="text-xs text-gray-400 px-1">
        Categories help you track where money is going. Add new ones directly when recording an expense.
      </p>

      {categories.length === 0 ? (
        <div className="flex flex-col items-center justify-center h-48 text-center">
          <svg className="w-10 h-10 text-gray-300 mb-3" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 0 0 3 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 0 0 5.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 0 0 9.568 3Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6Z" />
          </svg>
          <p className="text-gray-400 text-sm">No categories yet</p>
          <p className="text-gray-400 text-xs mt-1">Add one when recording an expense</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
          {categories.map(c => {
            const stats = byCat.find(b => b.id === c.id)
            const isEditing = editingCat?.id === c.id
            return (
              <div key={c.id} className="px-4 py-3 flex items-center gap-3">
                {isEditing ? (
                  <>
                    <input
                      value={editCatName}
                      onChange={e => onEditNameChange(e.target.value)}
                      className="flex-1 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                      autoFocus
                    />
                    <button onClick={onSaveCat} disabled={savingCat}
                      className="text-xs text-white bg-gray-900 px-3 py-1.5 rounded-lg font-medium disabled:opacity-50">
                      {savingCat ? '…' : 'Save'}
                    </button>
                    <button onClick={onCancelEdit} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
                  </>
                ) : (
                  <>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800">{c.name}</p>
                      <p className="text-xs text-gray-400">
                        {stats
                          ? `${stats.count} expense${stats.count !== 1 ? 's' : ''} · ${formatNaira(stats.total)}`
                          : 'No expenses yet'}
                      </p>
                    </div>
                    <button onClick={() => onStartEdit(c)} className="text-xs text-gray-600 hover:text-gray-900 font-medium transition-colors px-2">Edit</button>
                    <button onClick={() => onDeleteCat(c.id)} disabled={deletingId === c.id}
                      className="text-xs text-gray-400 hover:text-red-500 disabled:opacity-40 transition-colors px-2">
                      {deletingId === c.id ? '…' : 'Delete'}
                    </button>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
