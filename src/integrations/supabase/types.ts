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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          created_at: string
          details: string | null
          id: string
          ip_address: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          details?: string | null
          id?: string
          ip_address?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          details?: string | null
          id?: string
          ip_address?: string | null
          user_id?: string
        }
        Relationships: []
      }
      custom_categories: {
        Row: {
          created_at: string
          id: string
          name: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          type?: string
        }
        Relationships: []
      }
      monthly_summaries: {
        Row: {
          base_fee: number
          created_at: string
          crypto_end: number
          crypto_start: number
          id: string
          month_id: string
          total_expense: number
          total_income: number
        }
        Insert: {
          base_fee?: number
          created_at?: string
          crypto_end?: number
          crypto_start?: number
          id?: string
          month_id: string
          total_expense?: number
          total_income?: number
        }
        Update: {
          base_fee?: number
          created_at?: string
          crypto_end?: number
          crypto_start?: number
          id?: string
          month_id?: string
          total_expense?: number
          total_income?: number
        }
        Relationships: [
          {
            foreignKeyName: "monthly_summaries_month_id_fkey"
            columns: ["month_id"]
            isOneToOne: true
            referencedRelation: "months"
            referencedColumns: ["id"]
          },
        ]
      }
      months: {
        Row: {
          closed_at: string | null
          created_at: string
          crypto_end: number
          crypto_start: number
          end_date: string
          id: string
          is_closed: boolean
          name: string
          start_date: string
        }
        Insert: {
          closed_at?: string | null
          created_at?: string
          crypto_end?: number
          crypto_start?: number
          end_date: string
          id?: string
          is_closed?: boolean
          name: string
          start_date: string
        }
        Update: {
          closed_at?: string | null
          created_at?: string
          crypto_end?: number
          crypto_start?: number
          end_date?: string
          id?: string
          is_closed?: boolean
          name?: string
          start_date?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          message: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          message: string
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          message?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      person_monthly_summaries: {
        Row: {
          created_at: string
          expense: number
          id: string
          income: number
          month_id: string
          person: string
          revenue: number
        }
        Insert: {
          created_at?: string
          expense?: number
          id?: string
          income?: number
          month_id: string
          person: string
          revenue?: number
        }
        Update: {
          created_at?: string
          expense?: number
          id?: string
          income?: number
          month_id?: string
          person?: string
          revenue?: number
        }
        Relationships: [
          {
            foreignKeyName: "person_monthly_summaries_month_id_fkey"
            columns: ["month_id"]
            isOneToOne: false
            referencedRelation: "months"
            referencedColumns: ["id"]
          },
        ]
      }
      person_salary_balances: {
        Row: {
          carry_forward_deficit: number
          created_at: string
          id: string
          month_id: string
          person: string
        }
        Insert: {
          carry_forward_deficit?: number
          created_at?: string
          id?: string
          month_id: string
          person: string
        }
        Update: {
          carry_forward_deficit?: number
          created_at?: string
          id?: string
          month_id?: string
          person?: string
        }
        Relationships: [
          {
            foreignKeyName: "person_salary_balances_month_id_fkey"
            columns: ["month_id"]
            isOneToOne: false
            referencedRelation: "months"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          assigned_wallet: string | null
          created_at: string
          display_name: string
          id: string
          is_active: boolean
          must_change_password: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          assigned_wallet?: string | null
          created_at?: string
          display_name: string
          id?: string
          is_active?: boolean
          must_change_password?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          assigned_wallet?: string | null
          created_at?: string
          display_name?: string
          id?: string
          is_active?: boolean
          must_change_password?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      salary_settings: {
        Row: {
          base_fee_per_person: number
          base_rate: number
          below_target_rate: number
          created_at: string
          id: string
          month_id: string
          team_target: number
          top_performer_rate: number
        }
        Insert: {
          base_fee_per_person?: number
          base_rate?: number
          below_target_rate?: number
          created_at?: string
          id?: string
          month_id: string
          team_target?: number
          top_performer_rate?: number
        }
        Update: {
          base_fee_per_person?: number
          base_rate?: number
          below_target_rate?: number
          created_at?: string
          id?: string
          month_id?: string
          team_target?: number
          top_performer_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "salary_settings_month_id_fkey"
            columns: ["month_id"]
            isOneToOne: true
            referencedRelation: "months"
            referencedColumns: ["id"]
          },
        ]
      }
      team_persons: {
        Row: {
          created_at: string
          id: string
          person_name: string
          team: string
        }
        Insert: {
          created_at?: string
          id?: string
          person_name: string
          team: string
        }
        Update: {
          created_at?: string
          id?: string
          person_name?: string
          team?: string
        }
        Relationships: []
      }
      teams: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      transactions: {
        Row: {
          amount: number
          category: string | null
          created_at: string
          created_by: string | null
          date: string
          id: string
          income_expense: string
          linked_wallet: string | null
          month_id: string | null
          note: string
          original_transaction_id: string | null
          person: string
          settled_amount: number | null
          settlement_month_id: string | null
          settlement_status: string | null
          source_type: string | null
          team: string
          transaction_id: string
          type: string
          updated_at: string
        }
        Insert: {
          amount: number
          category?: string | null
          created_at?: string
          created_by?: string | null
          date: string
          id?: string
          income_expense: string
          linked_wallet?: string | null
          month_id?: string | null
          note?: string
          original_transaction_id?: string | null
          person?: string
          settled_amount?: number | null
          settlement_month_id?: string | null
          settlement_status?: string | null
          source_type?: string | null
          team: string
          transaction_id: string
          type: string
          updated_at?: string
        }
        Update: {
          amount?: number
          category?: string | null
          created_at?: string
          created_by?: string | null
          date?: string
          id?: string
          income_expense?: string
          linked_wallet?: string | null
          month_id?: string | null
          note?: string
          original_transaction_id?: string | null
          person?: string
          settled_amount?: number | null
          settlement_month_id?: string | null
          settlement_status?: string | null
          source_type?: string | null
          team?: string
          transaction_id?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "transactions_month_id_fkey"
            columns: ["month_id"]
            isOneToOne: false
            referencedRelation: "months"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_original_transaction_id_fkey"
            columns: ["original_transaction_id"]
            isOneToOne: false
            referencedRelation: "transactions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "transactions_settlement_month_id_fkey"
            columns: ["settlement_month_id"]
            isOneToOne: false
            referencedRelation: "months"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          accent_color: string
          compact_mode: boolean
          created_at: string
          currency_format: string
          dashboard_layout: string
          default_landing_page: string
          default_month: string | null
          id: string
          table_density: string
          theme: string
          updated_at: string
          user_id: string
        }
        Insert: {
          accent_color?: string
          compact_mode?: boolean
          created_at?: string
          currency_format?: string
          dashboard_layout?: string
          default_landing_page?: string
          default_month?: string | null
          id?: string
          table_density?: string
          theme?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          accent_color?: string
          compact_mode?: boolean
          created_at?: string
          currency_format?: string
          dashboard_layout?: string
          default_landing_page?: string
          default_month?: string | null
          id?: string
          table_density?: string
          theme?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallet_starting_balances: {
        Row: {
          carry_forward_amount: number
          created_at: string
          id: string
          month_id: string
          real_balance: number | null
          real_balance_date: string | null
          starting_amount: number
          updated_at: string
          wallet: string
        }
        Insert: {
          carry_forward_amount?: number
          created_at?: string
          id?: string
          month_id: string
          real_balance?: number | null
          real_balance_date?: string | null
          starting_amount?: number
          updated_at?: string
          wallet: string
        }
        Update: {
          carry_forward_amount?: number
          created_at?: string
          id?: string
          month_id?: string
          real_balance?: number | null
          real_balance_date?: string | null
          starting_amount?: number
          updated_at?: string
          wallet?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_starting_balances_month_id_fkey"
            columns: ["month_id"]
            isOneToOne: false
            referencedRelation: "months"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      carry_forward_wallet_balances: {
        Args: { _crypto_start: number; _new_month_id: string }
        Returns: undefined
      }
      close_month: { Args: { _month_id: string }; Returns: undefined }
      get_user_wallet: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "team_user"
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
    Enums: {
      app_role: ["admin", "team_user"],
    },
  },
} as const
