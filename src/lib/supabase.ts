import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const isSupabaseConfigured = url?.startsWith("http") && key?.length > 20;

export const supabase = (
  isSupabaseConfigured ? createClient(url, key) : null!
) as any;
