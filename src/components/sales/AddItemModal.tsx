import { useState, useEffect } from "react";
import type { FormEvent } from "react";
import { nairaToKobo, koboToNaira } from "../../lib/currency";
import type { Database } from "../../types/database";

type InventoryItem = Database["public"]["Tables"]["inventory_items"]["Row"];

interface Props {
  item?: InventoryItem | null;
  onSave: (
    data: Database["public"]["Tables"]["inventory_items"]["Insert"],
  ) => Promise<void>;
  onClose: () => void;
}

const inputCls =
  "w-full border border-gray-200 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-gray-900 bg-white";
const labelCls =
  "block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wider";

export default function AddItemModal({ item, onSave, onClose }: Props) {
  const [name, setName] = useState("");
  const [costPrice, setCostPrice] = useState("");
  const [sellingPrice, setSellingPrice] = useState("");
  const [qty, setQty] = useState("0");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (item) {
      setName(item.name);
      setCostPrice(String(koboToNaira(item.cost_price)));
      setSellingPrice(String(koboToNaira(item.selling_price)));
      setQty(String(item.quantity_in_stock));
    }
  }, [item]);

  const margin =
    sellingPrice && costPrice && Number(sellingPrice) > 0
      ? (
          ((Number(sellingPrice) - Number(costPrice)) / Number(sellingPrice)) *
          100
        ).toFixed(1)
      : null;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (Number(sellingPrice) < Number(costPrice)) {
      setError("Selling price cannot be less than cost price.");
      return;
    }
    setSaving(true);
    try {
      await onSave({
        name,
        cost_price: nairaToKobo(costPrice),
        selling_price: nairaToKobo(sellingPrice),
        quantity_in_stock: Number(qty),
      });
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save item");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40">
      <div className="bg-white w-full max-w-lg rounded-t-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">
            {item ? "Edit Item" : "Add Inventory Item"}
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
          <div>
            <label className={labelCls}>Item Name</label>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Primary 3 Maths Textbook"
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Cost Price (₦)</label>
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={costPrice}
                onChange={(e) => setCostPrice(e.target.value)}
                placeholder="0.00"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Selling Price (₦)</label>
              <input
                required
                type="number"
                min="0"
                step="0.01"
                value={sellingPrice}
                onChange={(e) => setSellingPrice(e.target.value)}
                placeholder="0.00"
                className={inputCls}
              />
            </div>
          </div>

          {margin !== null && (
            <p
              className={`text-sm font-medium tabular-nums ${Number(margin) >= 0 ? "text-emerald-600" : "text-red-500"}`}>
              Margin: {margin}%
            </p>
          )}

          <div>
            <label className={labelCls}>Quantity in Stock</label>
            <input
              required
              type="number"
              min="0"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              className={inputCls}
            />
          </div>

          {error && (
            <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full bg-gray-900 hover:bg-gray-800 disabled:opacity-50 text-white font-semibold rounded-xl py-3 text-base transition-colors">
            {saving ? "Saving…" : item ? "Save Changes" : "Add Item"}
          </button>
        </form>
      </div>
    </div>
  );
}
