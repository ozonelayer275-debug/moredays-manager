import { supabase } from './supabase'
import type { Database } from '../types/database'

type Expense = Database['public']['Tables']['expenses']['Row']
type Category = Database['public']['Tables']['expense_categories']['Row']

export type ExpenseWithCategory = Expense & {
  expense_categories: Pick<Category, 'name'>
}

// ── Categories ────────────────────────────────────────────────────────────────

export async function fetchCategories(): Promise<Category[]> {
  const { data, error } = await supabase
    .from('expense_categories')
    .select('*')
    .order('name')
  if (error) throw error
  return data
}

export async function addCategory(name: string): Promise<Category> {
  const { data, error } = await supabase
    .from('expense_categories')
    .insert({ name })
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateCategory(id: string, name: string): Promise<Category> {
  const { data, error } = await supabase
    .from('expense_categories')
    .update({ name })
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteCategory(id: string) {
  const { error } = await supabase.from('expense_categories').delete().eq('id', id)
  if (error) throw error
}

// ── Expenses ──────────────────────────────────────────────────────────────────

export async function fetchExpenses(): Promise<ExpenseWithCategory[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select('*, expense_categories(name)')
    .order('date', { ascending: false })
  if (error) throw error
  return data as ExpenseWithCategory[]
}

export async function addExpense(
  e: Database['public']['Tables']['expenses']['Insert']
): Promise<Expense> {
  const { data, error } = await supabase.from('expenses').insert(e).select().single()
  if (error) throw error
  return data
}

export async function updateExpense(
  id: string,
  e: Database['public']['Tables']['expenses']['Update']
): Promise<Expense> {
  const { data, error } = await supabase
    .from('expenses')
    .update(e)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteExpense(id: string) {
  const { error } = await supabase.from('expenses').delete().eq('id', id)
  if (error) throw error
}

// ── Duplicate a recurring expense into the current month ──────────────────────
export async function duplicateRecurringExpense(
  expense: ExpenseWithCategory,
  recordedBy: string
): Promise<Expense> {
  const today = new Date().toISOString().split('T')[0]
  return addExpense({
    category_id: expense.category_id,
    description: expense.description,
    amount: expense.amount,
    date: today,
    recurring: true,
    recorded_by: recordedBy,
  })
}
