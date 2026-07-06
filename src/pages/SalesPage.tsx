import { useState, useEffect, useCallback } from 'react'
import AppShell from '../components/layout/AppShell'
import AddItemModal from '../components/sales/AddItemModal'
import RecordSaleModal from '../components/sales/RecordSaleModal'
import { formatNaira } from '../lib/currency'
import {
  fetchInventory,
  fetchSales,
  addInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  recordSale,
  deleteSale,
  type SaleWithItem,
} from '../lib/salesApi'
import type { Database } from '../types/database'

type InventoryItem = Database['public']['Tables']['inventory_items']['Row']
type Tab = 'sales' | 'inventory'

const LOW_STOCK_THRESHOLD = 5

export default function SalesPage() {
  const [tab, setTab] = useState<Tab>('sales')
  const [inventory, setInventory] = useState<InventoryItem[]>([])
  const [sales, setSales] = useState<SaleWithItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [showAddItem, setShowAddItem] = useState(false)
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null)
  const [showRecordSale, setShowRecordSale] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const [inv, sal] = await Promise.all([fetchInventory(), fetchSales()])
      setInventory(inv)
      setSales(sal)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load data')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  const totalRevenue = sales.reduce((s, x) => s + x.amount, 0)
  const totalProfit = sales.reduce((s, x) => {
    return s + (x.inventory_items.selling_price - x.inventory_items.cost_price) * x.quantity
  }, 0)
  const lowStockItems = inventory.filter(i => i.quantity_in_stock <= LOW_STOCK_THRESHOLD && i.quantity_in_stock > 0)
  const outOfStock = inventory.filter(i => i.quantity_in_stock === 0)

  async function handleAddItem(data: Database['public']['Tables']['inventory_items']['Insert']) {
    await addInventoryItem(data)
    await load()
  }

  async function handleEditItem(data: Database['public']['Tables']['inventory_items']['Insert']) {
    if (!editingItem) return
    await updateInventoryItem(editingItem.id, data)
    setEditingItem(null)
    await load()
  }

  async function handleDeleteItem(id: string) {
    if (!confirm('Delete this item? This cannot be undone.')) return
    setDeletingId(id)
    try {
      await deleteInventoryItem(id)
      await load()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setDeletingId(null)
    }
  }

  async function handleRecordSale(data: Database['public']['Tables']['sales']['Insert']) {
    await recordSale(data)
    await load()
  }

  async function handleDeleteSale(sale: SaleWithItem) {
    if (!confirm('Delete this sale record? Stock will be restored.')) return
    setDeletingId(sale.id)
    try {
      await deleteSale(sale.id, sale.item_id, sale.quantity)
      await load()
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setDeletingId(null)
    }
  }

  const actionButton = (
    <button
      onClick={() => tab === 'sales' ? setShowRecordSale(true) : setShowAddItem(true)}
      className="bg-gray-900 text-white text-sm font-semibold px-4 py-2 rounded-xl"
    >
      + {tab === 'sales' ? 'Record Sale' : 'Add Item'}
    </button>
  )

  return (
    <AppShell title="Sales & Inventory" action={actionButton}>
      {/* Tabs */}
      <div className="flex bg-gray-100 rounded-lg p-0.5 mb-4">
        {(['sales', 'inventory'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex-1 py-2 rounded-md text-sm font-medium transition-colors capitalize ${
              tab === t ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500'
            }`}
          >
            {t === 'sales' ? 'Sales' : 'Inventory'}
          </button>
        ))}
      </div>

      {/* Stock alerts */}
      {(outOfStock.length > 0 || lowStockItems.length > 0) && (
        <div className="mb-4 space-y-2">
          {outOfStock.length > 0 && (
            <div className="border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              <span className="font-medium">{outOfStock.length} item{outOfStock.length > 1 ? 's' : ''} out of stock:</span>{' '}
              {outOfStock.map(i => i.name).join(', ')}
            </div>
          )}
          {lowStockItems.length > 0 && (
            <div className="border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-700">
              <span className="font-medium">Low stock:</span>{' '}
              {lowStockItems.map(i => `${i.name} (${i.quantity_in_stock} left)`).join(', ')}
            </div>
          )}
        </div>
      )}

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
      ) : tab === 'sales' ? (
        <SalesTab
          sales={sales}
          totalRevenue={totalRevenue}
          totalProfit={totalProfit}
          deletingId={deletingId}
          onDelete={handleDeleteSale}
        />
      ) : (
        <InventoryTab
          inventory={inventory}
          deletingId={deletingId}
          onEdit={item => { setEditingItem(item); setShowAddItem(true) }}
          onDelete={handleDeleteItem}
        />
      )}

      {showAddItem && (
        <AddItemModal
          item={editingItem}
          onSave={editingItem ? handleEditItem : handleAddItem}
          onClose={() => { setShowAddItem(false); setEditingItem(null) }}
        />
      )}
      {showRecordSale && (
        <RecordSaleModal
          items={inventory.filter(i => i.quantity_in_stock > 0)}
          onSave={handleRecordSale}
          onClose={() => setShowRecordSale(false)}
        />
      )}
    </AppShell>
  )
}

// ── Sales Tab ─────────────────────────────────────────────────────────────────
function SalesTab({
  sales, totalRevenue, totalProfit, deletingId, onDelete,
}: {
  sales: SaleWithItem[]
  totalRevenue: number
  totalProfit: number
  deletingId: string | null
  onDelete: (s: SaleWithItem) => void
}) {
  if (sales.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-56 text-center">
        <svg className="w-10 h-10 text-gray-300 mb-3" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 3h1.386c.51 0 .955.343 1.087.835l.383 1.437M7.5 14.25a3 3 0 0 0-3 3h15.75m-12.75-3h11.218c1.121-2.3 2.1-4.684 2.924-7.138a60.114 60.114 0 0 0-16.536-1.84M7.5 14.25 5.106 5.272M6 20.25a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Zm12.75 0a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
        </svg>
        <p className="text-gray-400 text-sm">No sales yet</p>
        <p className="text-gray-400 text-xs mt-1">Tap <span className="font-medium text-gray-600">+ Record Sale</span> to add your first one</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <p className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">Revenue</p>
          <p className="text-xl font-bold text-gray-900 mt-1 tabular-nums">{formatNaira(totalRevenue)}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <p className="text-[10px] uppercase tracking-wider text-gray-400 font-medium">Profit</p>
          <p className={`text-xl font-bold mt-1 tabular-nums ${totalProfit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
            {formatNaira(totalProfit)}
          </p>
        </div>
      </div>

      {/* Sales list */}
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {sales.map(sale => {
          const profit = (sale.inventory_items.selling_price - sale.inventory_items.cost_price) * sale.quantity
          return (
            <div key={sale.id} className="flex items-start justify-between gap-3 px-4 py-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-gray-900 truncate">{sale.inventory_items.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {sale.buyer_name} · Qty {sale.quantity} · {new Date(sale.date).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
                <p className={`text-xs mt-0.5 tabular-nums ${profit >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                  Profit: {formatNaira(profit)}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="font-semibold text-gray-900 tabular-nums">{formatNaira(sale.amount)}</p>
                <button
                  onClick={() => onDelete(sale)}
                  disabled={deletingId === sale.id}
                  className="text-xs text-gray-400 hover:text-red-500 mt-1 disabled:opacity-40 transition-colors"
                >
                  {deletingId === sale.id ? '…' : 'Delete'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Inventory Tab ─────────────────────────────────────────────────────────────
function InventoryTab({
  inventory, deletingId, onEdit, onDelete,
}: {
  inventory: InventoryItem[]
  deletingId: string | null
  onEdit: (item: InventoryItem) => void
  onDelete: (id: string) => void
}) {
  if (inventory.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-56 text-center">
        <svg className="w-10 h-10 text-gray-300 mb-3" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
        </svg>
        <p className="text-gray-400 text-sm">No items yet</p>
        <p className="text-gray-400 text-xs mt-1">Tap <span className="font-medium text-gray-600">+ Add Item</span> to stock your inventory</p>
      </div>
    )
  }

  const totalStockValue = inventory.reduce((s, i) => s + i.selling_price * i.quantity_in_stock, 0)
  const totalCostValue = inventory.reduce((s, i) => s + i.cost_price * i.quantity_in_stock, 0)

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
        {inventory.map(item => {
          const margin = ((item.selling_price - item.cost_price) / item.selling_price * 100).toFixed(1)
          const stockColor =
            item.quantity_in_stock === 0 ? 'text-red-500' :
            item.quantity_in_stock <= LOW_STOCK_THRESHOLD ? 'text-amber-600' : 'text-emerald-600'

          return (
            <div key={item.id} className="px-4 py-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-gray-900 truncate">{item.name}</p>
                  <div className="flex flex-wrap gap-x-3 mt-0.5 text-xs text-gray-400">
                    <span>Cost {formatNaira(item.cost_price)}</span>
                    <span>Sell {formatNaira(item.selling_price)}</span>
                    <span className="font-medium text-gray-600">Margin {margin}%</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <p className={`text-sm font-semibold tabular-nums ${stockColor}`}>
                    {item.quantity_in_stock === 0 ? 'Out of stock' : `${item.quantity_in_stock} left`}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5 tabular-nums">
                    {formatNaira(item.selling_price * item.quantity_in_stock)}
                  </p>
                </div>
              </div>
              <div className="flex gap-4 mt-2 pt-2 border-t border-gray-100">
                <button onClick={() => onEdit(item)} className="text-xs font-medium text-gray-600 hover:text-gray-900 transition-colors">
                  Edit
                </button>
                <button
                  onClick={() => onDelete(item.id)}
                  disabled={deletingId === item.id}
                  className="text-xs text-gray-400 hover:text-red-500 disabled:opacity-40 transition-colors"
                >
                  {deletingId === item.id ? 'Deleting…' : 'Delete'}
                </button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Stock value summary */}
      <div className="bg-white rounded-xl border border-gray-200 px-4 py-3">
        <p className="text-[10px] uppercase tracking-wider text-gray-400 font-medium mb-2">Stock Value</p>
        <div className="flex justify-between text-sm mb-1">
          <span className="text-gray-500">At selling price</span>
          <span className="font-semibold text-gray-900 tabular-nums">{formatNaira(totalStockValue)}</span>
        </div>
        <div className="flex justify-between text-xs">
          <span className="text-gray-400">At cost price</span>
          <span className="text-gray-500 tabular-nums">{formatNaira(totalCostValue)}</span>
        </div>
      </div>
    </div>
  )
}
