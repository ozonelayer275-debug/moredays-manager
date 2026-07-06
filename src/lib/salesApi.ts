import { supabase } from './supabase'
import type { Database } from '../types/database'

type InventoryItem = Database['public']['Tables']['inventory_items']['Row']
type Sale = Database['public']['Tables']['sales']['Row']

// ── Inventory ────────────────────────────────────────────────────────────────

export async function fetchInventory(): Promise<InventoryItem[]> {
  const { data, error } = await supabase
    .from('inventory_items')
    .select('*')
    .order('name')
  if (error) throw error
  return data
}

export async function addInventoryItem(
  item: Database['public']['Tables']['inventory_items']['Insert']
) {
  const { data, error } = await supabase
    .from('inventory_items')
    .insert(item)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateInventoryItem(
  id: string,
  updates: Database['public']['Tables']['inventory_items']['Update']
) {
  const { data, error } = await supabase
    .from('inventory_items')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteInventoryItem(id: string) {
  const { error } = await supabase.from('inventory_items').delete().eq('id', id)
  if (error) throw error
}

// ── Sales ─────────────────────────────────────────────────────────────────────

export type SaleWithItem = Sale & { inventory_items: Pick<InventoryItem, 'name' | 'cost_price' | 'selling_price'> }

export async function fetchSales(): Promise<SaleWithItem[]> {
  const { data, error } = await supabase
    .from('sales')
    .select('*, inventory_items(name, cost_price, selling_price)')
    .order('date', { ascending: false })
  if (error) throw error
  return data as SaleWithItem[]
}

export async function recordSale(
  sale: Database['public']['Tables']['sales']['Insert']
) {
  // Decrement stock
  const { data: item, error: fetchErr } = await supabase
    .from('inventory_items')
    .select('quantity_in_stock')
    .eq('id', sale.item_id)
    .single()
  if (fetchErr) throw fetchErr

  const newQty = item.quantity_in_stock - sale.quantity
  if (newQty < 0) throw new Error('Not enough stock')

  const { data, error } = await supabase
    .from('sales')
    .insert(sale)
    .select()
    .single()
  if (error) throw error

  await supabase
    .from('inventory_items')
    .update({ quantity_in_stock: newQty })
    .eq('id', sale.item_id)

  return data
}

export async function deleteSale(id: string, itemId: string, qty: number) {
  // Restore stock
  const { data: item } = await supabase
    .from('inventory_items')
    .select('quantity_in_stock')
    .eq('id', itemId)
    .single()

  const { error } = await supabase.from('sales').delete().eq('id', id)
  if (error) throw error

  if (item) {
    await supabase
      .from('inventory_items')
      .update({ quantity_in_stock: item.quantity_in_stock + qty })
      .eq('id', itemId)
  }
}
