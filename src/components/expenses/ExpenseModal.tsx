import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import { nairaToKobo, koboToNaira } from "../../lib/currency";
import type { Database } from "../../types/database";
import type { ExpenseWithCategory } from "../../lib/expensesApi";

type Category = Database["public"]["Tables"]["expense_categories"]["Row"];

interface Props {
  expense?: ExpenseWithCategory | null;
  categories: Category[];
  recordedBy: string;
  onSave: (
    data: Database["public"]["Tables"]["expenses"]["Insert"],
  ) => Promise<void>;
  onAddCategory: (name: string) => Promise<Category>;
  onClose: () => void;
}

const inputCls =
  "w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white";
const labelCls =
  "block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider";

export default function ExpenseModal({
  expense,
  categories,
  recordedBy,
  onSave,
  onAddCategory,
  onClose,
}: Props) {
  const [categoryId, setCategoryId] = useState("");
  const [description, setDescription] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [recurring, setRecurring] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [addingCat, setAddingCat] = useState(false);
  const [newCatName, setNewCatName] = useState("");
  const [savingCat, setSavingCat] = useState(false);

  useEffect(() => {
    if (categories.length > 0 && !categoryId) setCategoryId(categories[0].id);
  }, [categories, categoryId]);

  useEffect(() => {
    if (expense) {
      setCategoryId(expense.category_id);
      setDescription(expense.description);
      setAmount(String(koboToNaira(expense.amount)));
      setDate(expense.date);
      setRecurring(expense.recurring);
    }
  }, [expense]);

  async function handleAddCategory() {
    if (!newCatName.trim()) return;
    setSavingCat(true);
    try {
      const cat = await onAddCategory(newCatName.trim());
      setCategoryId(cat.id);
      setNewCatName("");
      setAddingCat(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Failed to add category");
    } finally {
      setSavingCat(false);
    }
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!categoryId) {
      setError("Select a category");
      return;
    }
    if (!amount || Number(amount) <= 0) {
      setError("Enter a valid amount");
      return;
    }
    setSaving(true);
    try {
      await onSave({
        category_id: categoryId,
        description,
        amount: nairaToKobo(amount),
        date,
        recurring,
        recorded_by: recordedBy,
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save expense");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 px-0 sm:px-4">
      <div className="bg-white w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl max-h-[92vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">
            {expense ? "Edit Expense" : "Record Expense"}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors">
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M6 18 18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-4">
          {/* Category */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className={labelCls.replace("mb-1.5", "")}>Category</label>
              <button
                type="button"
                onClick={() => setAddingCat((v) => !v)}
                className="text-xs text-gray-500 hover:text-gray-900 font-medium transition-colors">
                {addingCat ? "Cancel" : "+ New"}
              </button>
            </div>
            {addingCat ? (
              <div className="flex gap-2">
                <input
                  value={newCatName}
                  onChange={(e) => setNewCatName(e.target.value)}
                  placeholder="e.g. Generator Fuel"
                  className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-900"
                />
                <button
                  type="button"
                  onClick={handleAddCategory}
                  disabled={savingCat}
                  className="bg-gray-900 text-white text-sm font-semibold px-4 rounded-xl disabled:opacity-50">
                  {savingCat ? "…" : "Add"}
                </button>
              </div>
            ) : (
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className={inputCls}>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Description */}
          <div>
            <label className={labelCls}>
              Description{" "}
              <span className="normal-case text-gray-400 font-normal tracking-normal">
                — optional
              </span>
            </label>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="e.g. August salaries for 6 teachers"
              className={inputCls}
            />
          </div>

          {/* Amount + Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Amount (₦)</label>
              <input
                required
                type="number"
                min="1"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Date</label>
              <input
                required
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className={inputCls}
              />
            </div>
          </div>

          {/* Recurring toggle */}
          <label className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 cursor-pointer">
            <div className="relative shrink-0">
              <input
                type="checkbox"
                className="sr-only"
                checked={recurring}
                onChange={(e) => setRecurring(e.target.checked)}
              />
              <div
                className={`w-10 h-6 rounded-full transition-colors ${recurring ? "bg-gray-900" : "bg-gray-200"}`}
              />
              <div
                className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${recurring ? "translate-x-5" : "translate-x-1"}`}
              />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-700">
                Recurring expense
              </p>
              <p className="text-xs text-gray-400">
                Re-log with one tap from the expenses list
              </p>
            </div>
          </label>

          {error && (
            <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white font-semibold rounded-xl py-3 text-base transition-colors">
            {saving ? "Saving…" : expense ? "Save Changes" : "Record Expense"}
          </button>
        </form>
      </div>
    </div>
  );
}
