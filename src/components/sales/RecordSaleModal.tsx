import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import { nairaToKobo, koboToNaira, formatNaira } from "../../lib/currency";
import type { Database } from "../../types/database";

type InventoryItem = Database["public"]["Tables"]["inventory_items"]["Row"];

interface Props {
  items: InventoryItem[];
  onSave: (
    data: Database["public"]["Tables"]["sales"]["Insert"],
  ) => Promise<void>;
  onClose: () => void;
}

const inputCls =
  "w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white";
const labelCls =
  "block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider";

export default function RecordSaleModal({ items, onSave, onClose }: Props) {
  const [itemId, setItemId] = useState("");
  const [qty, setQty] = useState("1");
  const [buyerName, setBuyerName] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedItem = items.find((i) => i.id === itemId);
  const totalAmount = selectedItem
    ? nairaToKobo(koboToNaira(selectedItem.selling_price) * Number(qty))
    : 0;
  const profit = selectedItem
    ? (selectedItem.selling_price - selectedItem.cost_price) * Number(qty)
    : 0;

  useEffect(() => {
    if (items.length > 0 && !itemId) setItemId(items[0].id);
  }, [items, itemId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!selectedItem) {
      setError("Select an item");
      return;
    }
    if (Number(qty) < 1) {
      setError("Quantity must be at least 1");
      return;
    }
    if (Number(qty) > selectedItem.quantity_in_stock) {
      setError(`Only ${selectedItem.quantity_in_stock} in stock`);
      return;
    }
    setSaving(true);
    try {
      await onSave({
        item_id: itemId,
        quantity: Number(qty),
        buyer_name: buyerName || "Walk-in",
        student_id: null,
        amount: totalAmount,
        date,
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to record sale");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
      <div className="bg-white w-full max-w-lg rounded-t-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Record Sale</h2>
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

        <div className="px-5 py-4">
          {items.length === 0 ? (
            <p className="text-gray-400 text-sm py-6 text-center">
              Add inventory items first before recording a sale.
            </p>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className={labelCls}>Item</label>
                <select
                  required
                  value={itemId}
                  onChange={(e) => setItemId(e.target.value)}
                  className={inputCls}>
                  {items.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.name} — {formatNaira(i.selling_price)} (
                      {i.quantity_in_stock} left)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className={labelCls}>Quantity</label>
                  <input
                    required
                    type="number"
                    min="1"
                    max={selectedItem?.quantity_in_stock ?? 1}
                    value={qty}
                    onChange={(e) => setQty(e.target.value)}
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

              <div>
                <label className={labelCls}>
                  Buyer Name{" "}
                  <span className="normal-case text-gray-400 font-normal tracking-normal">
                    — optional
                  </span>
                </label>
                <input
                  value={buyerName}
                  onChange={(e) => setBuyerName(e.target.value)}
                  placeholder="Walk-in customer"
                  className={inputCls}
                />
              </div>

              {selectedItem && (
                <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-1.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Total</span>
                    <span className="font-semibold text-gray-900 tabular-nums">
                      {formatNaira(totalAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Profit</span>
                    <span
                      className={`font-medium tabular-nums ${profit >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                      {formatNaira(profit)}
                    </span>
                  </div>
                </div>
              )}

              {error && (
                <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}

              <button
                type="submit"
                disabled={saving}
                className="w-full bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white font-semibold rounded-xl py-3 text-base transition-colors">
                {saving ? "Recording…" : "Record Sale"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
