import { useState, useEffect, FormEvent } from 'react'
import { nairaToKobo, koboToNaira } from '../../lib/currency'
import { Sheet, SubmitButton } from './AddStudentModal'
import type { Database } from '../../types/database'

type FeeStructure = Database['public']['Tables']['fee_structures']['Row']

interface Props {
  structure?: FeeStructure | null
  onSave: (data: Database['public']['Tables']['fee_structures']['Insert']) => Promise<void>
  onClose: () => void
}

const CLASSES = [
  'Creche', 'Nursery 1', 'Nursery 2',
  'Primary 1', 'Primary 2', 'Primary 3',
  'Primary 4', 'Primary 5', 'Primary 6',
  'JSS 1', 'JSS 2', 'JSS 3',
  'SS 1', 'SS 2', 'SS 3',
]
const TERMS = ['First Term', 'Second Term', 'Third Term']
const FEE_TYPES = ['Tuition', 'PTA Levy', 'Exam Fee', 'Uniform', 'Feeding', 'Development Levy', 'Books', 'Excursion', 'Miscellaneous']

const input = 'w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-400 transition'
const label = 'block text-xs font-medium text-gray-500 mb-1'

export default function FeeStructureModal({ structure, onSave, onClose }: Props) {
  const [cls, setCls] = useState(CLASSES[3])
  const [term, setTerm] = useState(TERMS[0])
  const [session, setSession] = useState(() => { const y = new Date().getFullYear(); return `${y}/${y + 1}` })
  const [feeType, setFeeType] = useState(FEE_TYPES[0])
  const [customFeeType, setCustomFeeType] = useState('')
  const [amount, setAmount] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isCustom = feeType === '__custom__'
  const resolvedFeeType = isCustom ? customFeeType : feeType

  useEffect(() => {
    if (structure) {
      setCls(structure.class); setTerm(structure.term); setSession(structure.session)
      setAmount(String(koboToNaira(structure.amount)))
      if (FEE_TYPES.includes(structure.fee_type)) { setFeeType(structure.fee_type) }
      else { setFeeType('__custom__'); setCustomFeeType(structure.fee_type) }
    }
  }, [structure])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault(); setError(null)
    if (isCustom && !customFeeType.trim()) { setError('Enter a fee type name'); return }
    if (!amount || Number(amount) <= 0) { setError('Enter a valid amount'); return }
    setSaving(true)
    try {
      await onSave({ class: cls, term, session, fee_type: resolvedFeeType, amount: nairaToKobo(amount) })
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally { setSaving(false) }
  }

  return (
    <Sheet onClose={onClose} title={structure ? 'Edit Fee Structure' : 'Add Fee Structure'}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Class</label>
            <select value={cls} onChange={e => setCls(e.target.value)} className={input}>
              {CLASSES.map(c => <option key={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className={label}>Term</label>
            <select value={term} onChange={e => setTerm(e.target.value)} className={input}>
              {TERMS.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>

        <div>
          <label className={label}>Session</label>
          <input value={session} onChange={e => setSession(e.target.value)}
            placeholder="e.g. 2024/2025" className={input} />
        </div>

        <div>
          <label className={label}>Fee Type</label>
          <select value={feeType} onChange={e => setFeeType(e.target.value)} className={input}>
            {FEE_TYPES.map(f => <option key={f}>{f}</option>)}
            <option value="__custom__">Other (custom)…</option>
          </select>
        </div>

        {isCustom && (
          <div>
            <label className={label}>Custom Fee Name</label>
            <input value={customFeeType} onChange={e => setCustomFeeType(e.target.value)}
              placeholder="e.g. Computer Levy" className={input} />
          </div>
        )}

        <div>
          <label className={label}>Amount (₦)</label>
          <input required type="number" min="1" step="0.01" value={amount}
            onChange={e => setAmount(e.target.value)} placeholder="0.00" className={input} />
        </div>

        {error && <p className="text-xs text-red-500 border border-red-200 rounded-lg px-3 py-2">{error}</p>}
        <SubmitButton saving={saving} label={structure ? 'Save Changes' : 'Add Fee Structure'} />
      </form>
    </Sheet>
  )
}
