export type StudentStatus = 'active' | 'withdrawn'
export type PaymentMethod = 'cash' | 'transfer' | 'pos'

export interface Database {
  public: {
    Tables: {
      students: {
        Row: {
          id: string
          name: string
          class: string
          guardian_name: string
          guardian_phone: string
          admission_date: string
          status: StudentStatus
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['students']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['students']['Insert']>
      }
      fee_structures: {
        Row: {
          id: string
          class: string
          term: string
          session: string
          fee_type: string
          amount: number // kobo
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['fee_structures']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['fee_structures']['Insert']>
      }
      fee_payments: {
        Row: {
          id: string
          student_id: string
          fee_structure_id: string
          amount_paid: number // kobo
          method: PaymentMethod
          date: string
          recorded_by: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['fee_payments']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['fee_payments']['Insert']>
      }
      inventory_items: {
        Row: {
          id: string
          name: string
          cost_price: number // kobo
          selling_price: number // kobo
          quantity_in_stock: number
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['inventory_items']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['inventory_items']['Insert']>
      }
      sales: {
        Row: {
          id: string
          item_id: string
          quantity: number
          buyer_name: string
          student_id: string | null
          amount: number // kobo
          date: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['sales']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['sales']['Insert']>
      }
      expense_categories: {
        Row: {
          id: string
          name: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['expense_categories']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['expense_categories']['Insert']>
      }
      expenses: {
        Row: {
          id: string
          category_id: string
          description: string
          amount: number // kobo
          date: string
          recurring: boolean
          recorded_by: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['expenses']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['expenses']['Insert']>
      }
      terms: {
        Row: {
          id: string
          name: string
          session: string
          start_date: string
          end_date: string
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['terms']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['terms']['Insert']>
      }
      user_roles: {
        Row: {
          id: string
          user_id: string
          role: 'admin' | 'bursar'
          created_at: string
        }
        Insert: Omit<Database['public']['Tables']['user_roles']['Row'], 'id' | 'created_at'>
        Update: Partial<Database['public']['Tables']['user_roles']['Insert']>
      }
    }
  }
}
