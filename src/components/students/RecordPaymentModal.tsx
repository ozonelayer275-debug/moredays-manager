import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import { nairaToKobo, koboToNaira, formatNaira } from "../../lib/currency";
import { Sheet, SubmitButton } from "./AddStudentModal";
import type { Database } from "../../types/database";

type FeeStructure = Database["public"]["Tables"]["fee_structures"]["Row"];
type PaymentMethod =
  Database["public"]["Tables"]["fee_payments"]["Row"]["method"];

interface Props {
  studentName: string;
  studentClass: string;
  feeStructures: FeeStructure[];
  onSave: (
    data: Database["public"]["Tables"]["fee_payments"]["Insert"],
  ) => Promise<void>;
  onClose: () => void;
  studentId: string;
  recordedBy: string;
}

const input =
  "w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-400 transition";
const label = "block text-xs font-medium text-gray-500 mb-1";

export default function RecordPaymentModal({
  studentName,
  studentClass,
  feeStructures,
  onSave,
  onClose,
  studentId,
  recordedBy,
}: Props) {
  const [feeStructureId, setFeeStructureId] = useState("");
  const [amountPaid, setAmountPaid] = useState("");
  const [method, setMethod] = useState<PaymentMethod>("cash");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const classStructures = feeStructures.filter((f) => f.class === studentClass);
  const selected = classStructures.find((f) => f.id === feeStructureId);

  useEffect(() => {
    if (classStructures.length > 0 && !feeStructureId)
      setFeeStructureId(classStructures[0].id);
  }, [classStructures, feeStructureId]);

  useEffect(() => {
    if (selected) setAmountPaid(String(koboToNaira(selected.amount)));
  }, [feeStructureId, selected]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!feeStructureId) {
      setError("Select a fee type");
      return;
    }
    if (!amountPaid || Number(amountPaid) <= 0) {
      setError("Enter a valid amount");
      return;
    }
    setSaving(true);
    try {
      await onSave({
        student_id: studentId,
        fee_structure_id: feeStructureId,
        amount_paid: nairaToKobo(amountPaid),
        method,
        date,
        recorded_by: recordedBy,
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to record payment");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet onClose={onClose} title="Record Payment">
      <p className="text-xs text-gray-400 -mt-2 mb-4">
        {studentName} · {studentClass}
      </p>

      {classStructures.length === 0 ? (
        <div className="py-6 text-center">
          <p className="text-sm text-gray-500">
            No fee structures set up for <strong>{studentClass}</strong>.
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Add fee structures from the Fee Setup tab first.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={label}>Fee Type</label>
            <select
              value={feeStructureId}
              onChange={(e) => setFeeStructureId(e.target.value)}
              className={input}>
              {classStructures.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.fee_type} — {f.term} {f.session} ({formatNaira(f.amount)})
                </option>
              ))}
            </select>
          </div>

          {selected && (
            <div className="flex justify-between items-center bg-gray-50 rounded-lg px-3 py-2.5 text-sm">
              <span className="text-gray-500">Expected amount</span>
              <span className="font-semibold text-gray-900 tabular-nums">
                {formatNaira(selected.amount)}
              </span>
            </div>
          )}

          <div>
            <label className={label}>Amount Paid (₦)</label>
            <input
              required
              type="number"
              min="1"
              step="0.01"
              value={amountPaid}
              onChange={(e) => setAmountPaid(e.target.value)}
              className={input}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={label}>Method</label>
              <select
                value={method}
                onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                className={input}>
                <option value="cash">Cash</option>
                <option value="transfer">Transfer</option>
                <option value="pos">POS</option>
              </select>
            </div>
            <div>
              <label className={label}>Date</label>
              <input
                required
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={input}
              />
            </div>
          </div>

          {error && (
            <p className="text-xs text-red-500 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </p>
          )}
          <SubmitButton saving={saving} label="Record Payment" />
        </form>
      )}
    </Sheet>
  );
}
