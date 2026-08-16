export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      deposits: {
        Row: {
          account_type: string
          amount: number
          created_at: string
          date: string
          deposit_fee: number
          deposit_method: string
          description: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_type: string
          amount: number
          created_at?: string
          date?: string
          deposit_fee?: number
          deposit_method?: string
          description?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_type?: string
          amount?: number
          created_at?: string
          date?: string
          deposit_fee?: number
          deposit_method?: string
          description?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      targets: {
        Row: {
          account_type: string | null
          created_at: string
          id: string
          target_weight_pct: number
          ticker: string
          user_id: string
        }
        Insert: {
          account_type?: string | null
          created_at?: string
          id?: string
          target_weight_pct: number
          ticker: string
          user_id: string
        }
        Update: {
          account_type?: string | null
          created_at?: string
          id?: string
          target_weight_pct?: number
          ticker?: string
          user_id?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          account_type: string | null
          commission_fee: number | null
          created_at: string
          date: string
          deposit_fee: number | null
          deposit_method: string | null
          fx_fee: number | null
          id: string
          ipl_admin_fee: number | null
          notes: string | null
          other_fees: number | null
          price_at_transaction: number
          securities_transfer_tax_fee: number | null
          settlement_admin_fee: number | null
          shares: number
          tags: string[] | null
          ticker: string
          total_fees: number
          user_id: string
          vat_fee: number | null
        }
        Insert: {
          account_type?: string | null
          commission_fee?: number | null
          created_at?: string
          date: string
          deposit_fee?: number | null
          deposit_method?: string | null
          fx_fee?: number | null
          id?: string
          ipl_admin_fee?: number | null
          notes?: string | null
          other_fees?: number | null
          price_at_transaction: number
          securities_transfer_tax_fee?: number | null
          settlement_admin_fee?: number | null
          shares: number
          tags?: string[] | null
          ticker: string
          total_fees?: number
          user_id: string
          vat_fee?: number | null
        }
        Update: {
          account_type?: string | null
          commission_fee?: number | null
          created_at?: string
          date?: string
          deposit_fee?: number | null
          deposit_method?: string | null
          fx_fee?: number | null
          id?: string
          ipl_admin_fee?: number | null
          notes?: string | null
          other_fees?: number | null
          price_at_transaction?: number
          securities_transfer_tax_fee?: number | null
          settlement_admin_fee?: number | null
          shares?: number
          tags?: string[] | null
          ticker?: string
          total_fees?: number
          user_id?: string
          vat_fee?: number | null
        }
        Relationships: []
      }
      user_settings: {
        Row: {
          created_at: string
          default_card_deposit_pct: number
          default_commission_pct: number
          default_eft_deposit_pct: number
          default_fx_pct: number
          theme: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          default_card_deposit_pct?: number
          default_commission_pct?: number
          default_eft_deposit_pct?: number
          default_fx_pct?: number
          theme?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          default_card_deposit_pct?: number
          default_commission_pct?: number
          default_eft_deposit_pct?: number
          default_fx_pct?: number
          theme?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
