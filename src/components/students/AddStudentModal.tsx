import { useState, useEffect } from "react";
import type { FormEvent, ReactNode } from "react";
import type { Database } from "../../types/database";

type Student = Database["public"]["Tables"]["students"]["Row"];

interface Props {
  student?: Student | null;
  onSave: (
    data: Database["public"]["Tables"]["students"]["Insert"],
  ) => Promise<void>;
  onClose: () => void;
}

const CLASSES = [
  "Creche",
  "Nursery 1",
  "Nursery 2",
  "Primary 1",
  "Primary 2",
  "Primary 3",
  "Primary 4",
  "Primary 5",
  "Primary 6",
  "JSS 1",
  "JSS 2",
  "JSS 3",
  "SS 1",
  "SS 2",
  "SS 3",
];

const input =
  "w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-400 transition";
const label = "block text-xs font-medium text-gray-500 mb-1";

export default function AddStudentModal({ student, onSave, onClose }: Props) {
  const [name, setName] = useState("");
  const [cls, setCls] = useState(CLASSES[3]);
  const [guardianName, setGuardianName] = useState("");
  const [guardianPhone, setGuardianPhone] = useState("");
  const [admissionDate, setAdmissionDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [status, setStatus] = useState<"active" | "withdrawn">("active");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (student) {
      setName(student.name);
      setCls(student.class);
      setGuardianName(student.guardian_name);
      setGuardianPhone(student.guardian_phone);
      setAdmissionDate(student.admission_date);
      setStatus(student.status);
    }
  }, [student]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onSave({
        name,
        class: cls,
        guardian_name: guardianName,
        guardian_phone: guardianPhone,
        admission_date: admissionDate,
        status,
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Sheet onClose={onClose} title={student ? "Edit Student" : "Add Student"}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={label}>Full Name</label>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Amara Okafor"
            className={input}
          />
        </div>
        <div>
          <label className={label}>Class</label>
          <select
            value={cls}
            onChange={(e) => setCls(e.target.value)}
            className={input}>
            {CLASSES.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={label}>Guardian Name</label>
            <input
              required
              value={guardianName}
              onChange={(e) => setGuardianName(e.target.value)}
              placeholder="Mrs. Okafor"
              className={input}
            />
          </div>
          <div>
            <label className={label}>Guardian Phone</label>
            <input
              required
              value={guardianPhone}
              onChange={(e) => setGuardianPhone(e.target.value)}
              placeholder="08012345678"
              type="tel"
              className={input}
            />
          </div>
        </div>
        <div>
          <label className={label}>Admission Date</label>
          <input
            required
            type="date"
            value={admissionDate}
            onChange={(e) => setAdmissionDate(e.target.value)}
            className={input}
          />
        </div>
        {student && (
          <div>
            <label className={label}>Status</label>
            <select
              value={status}
              onChange={(e) =>
                setStatus(e.target.value as "active" | "withdrawn")
              }
              className={input}>
              <option value="active">Active</option>
              <option value="withdrawn">Withdrawn</option>
            </select>
          </div>
        )}
        {error && (
          <p className="text-xs text-red-500 border border-red-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        <SubmitButton
          saving={saving}
          label={student ? "Save Changes" : "Add Student"}
        />
      </form>
    </Sheet>
  );
}

// ── Shared sheet + button ─────────────────────────────────────────────────────
export function Sheet({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/30 px-0 sm:px-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="px-5 py-5">{children}</div>
      </div>
    </div>
  );
}

export function SubmitButton({
  saving,
  label,
}: {
  saving: boolean;
  label: string;
}) {
  return (
    <button
      type="submit"
      disabled={saving}
      className="w-full bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white text-sm font-medium rounded-lg py-3 transition-colors">
      {saving ? "Saving…" : label}
    </button>
  );
}
