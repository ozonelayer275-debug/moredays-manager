import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'

const url = import.meta.env.VITE_SUPABASE_URL as string
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const isSupabaseConfigured =
  url?.startsWith('http') && key?.length > 20

export const supabase = isSupabaseConfigured
  ? createClient<Database>(url, key)
  : null!
