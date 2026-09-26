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
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      audit_events: {
        Row: {
          action: string
          actor: string | null
          created_at: string
          family_id: string
          id: string
          payload: Json | null
          target_id: string | null
        }
        Insert: {
          action: string
          actor?: string | null
          created_at?: string
          family_id: string
          id?: string
          payload?: Json | null
          target_id?: string | null
        }
        Update: {
          action?: string
          actor?: string | null
          created_at?: string
          family_id?: string
          id?: string
          payload?: Json | null
          target_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_events_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      change_requests: {
        Row: {
          base_version: number | null
          created_at: string
          family_id: string
          id: string
          operation: Json
          requested_by: string
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["request_status"]
          target_person_id: string | null
        }
        Insert: {
          base_version?: number | null
          created_at?: string
          family_id: string
          id?: string
          operation: Json
          requested_by: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          target_person_id?: string | null
        }
        Update: {
          base_version?: number | null
          created_at?: string
          family_id?: string
          id?: string
          operation?: Json
          requested_by?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          target_person_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "change_requests_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "change_requests_target_person_id_fkey"
            columns: ["target_person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_requests: {
        Row: {
          created_at: string
          family_id: string
          id: string
          note: string | null
          person_id: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["request_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          family_id: string
          id?: string
          note?: string | null
          person_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          family_id?: string
          id?: string
          note?: string | null
          person_id?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["request_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "claim_requests_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_requests_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
        ]
      }
      families: {
        Row: {
          created_at: string
          created_by: string
          id: string
          is_demo: boolean
          name: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          is_demo?: boolean
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          is_demo?: boolean
          name?: string
        }
        Relationships: []
      }
      invitations: {
        Row: {
          created_at: string
          created_by: string | null
          expires_at: string
          family_id: string
          id: string
          max_uses: number
          revoked_at: string | null
          role: Database["public"]["Enums"]["family_role"]
          token_hash: string
          uses: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          expires_at?: string
          family_id: string
          id?: string
          max_uses?: number
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["family_role"]
          token_hash: string
          uses?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          expires_at?: string
          family_id?: string
          id?: string
          max_uses?: number
          revoked_at?: string | null
          role?: Database["public"]["Enums"]["family_role"]
          token_hash?: string
          uses?: number
        }
        Relationships: [
          {
            foreignKeyName: "invitations_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
      memberships: {
        Row: {
          created_at: string
          family_id: string
          id: string
          person_id: string | null
          role: Database["public"]["Enums"]["family_role"]
          status: Database["public"]["Enums"]["membership_status"]
          user_id: string
        }
        Insert: {
          created_at?: string
          family_id: string
          id?: string
          person_id?: string | null
          role?: Database["public"]["Enums"]["family_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          user_id: string
        }
        Update: {
          created_at?: string
          family_id?: string
          id?: string
          person_id?: string | null
          role?: Database["public"]["Enums"]["family_role"]
          status?: Database["public"]["Enums"]["membership_status"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "memberships_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "memberships_person_fk"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
        ]
      }
      parent_child_relations: {
        Row: {
          child_id: string
          created_at: string
          created_by: string | null
          family_id: string
          id: string
          kind: Database["public"]["Enums"]["filiation_kind"]
          parent_id: string
          parent_role: string | null
        }
        Insert: {
          child_id: string
          created_at?: string
          created_by?: string | null
          family_id: string
          id?: string
          kind?: Database["public"]["Enums"]["filiation_kind"]
          parent_id: string
          parent_role?: string | null
        }
        Update: {
          child_id?: string
          created_at?: string
          created_by?: string | null
          family_id?: string
          id?: string
          kind?: Database["public"]["Enums"]["filiation_kind"]
          parent_id?: string
          parent_role?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "parent_child_relations_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_child_relations_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "parent_child_relations_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
        ]
      }
      partnerships: {
        Row: {
          created_at: string
          created_by: string | null
          ended_on: string | null
          family_id: string
          id: string
          person_a_id: string
          person_b_id: string
          started_on: string | null
          status: Database["public"]["Enums"]["union_status"]
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          ended_on?: string | null
          family_id: string
          id?: string
          person_a_id: string
          person_b_id: string
          started_on?: string | null
          status?: Database["public"]["Enums"]["union_status"]
        }
        Update: {
          created_at?: string
          created_by?: string | null
          ended_on?: string | null
          family_id?: string
          id?: string
          person_a_id?: string
          person_b_id?: string
          started_on?: string | null
          status?: Database["public"]["Enums"]["union_status"]
        }
        Relationships: [
          {
            foreignKeyName: "partnerships_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partnerships_person_a_id_fkey"
            columns: ["person_a_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partnerships_person_b_id_fkey"
            columns: ["person_b_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
        ]
      }
      person_contacts: {
        Row: {
          consent_at: string | null
          family_id: string
          person_id: string
          phone_e164: string | null
          share_with_family: boolean
          updated_at: string
          whatsapp_declared: boolean
        }
        Insert: {
          consent_at?: string | null
          family_id: string
          person_id: string
          phone_e164?: string | null
          share_with_family?: boolean
          updated_at?: string
          whatsapp_declared?: boolean
        }
        Update: {
          consent_at?: string | null
          family_id?: string
          person_id?: string
          phone_e164?: string | null
          share_with_family?: boolean
          updated_at?: string
          whatsapp_declared?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "person_contacts_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_contacts_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: true
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
        ]
      }
      person_managers: {
        Row: {
          created_at: string
          family_id: string
          granted_by: string | null
          id: string
          person_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          family_id: string
          granted_by?: string | null
          id?: string
          person_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          family_id?: string
          granted_by?: string | null
          id?: string
          person_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "person_managers_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_managers_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "persons"
            referencedColumns: ["id"]
          },
        ]
      }
      persons: {
        Row: {
          bio: string | null
          birth_date: string | null
          birth_precision: Database["public"]["Enums"]["date_precision"]
          birth_year: number | null
          claimed_by: string | null
          created_at: string
          created_by: string | null
          death_date: string | null
          death_year: number | null
          deleted_at: string | null
          display_name: string
          family_id: string
          id: string
          is_child_record: boolean
          nickname: string | null
          origin_place: string | null
          photo_path: string | null
          version: number
          vital: Database["public"]["Enums"]["vital_status"]
        }
        Insert: {
          bio?: string | null
          birth_date?: string | null
          birth_precision?: Database["public"]["Enums"]["date_precision"]
          birth_year?: number | null
          claimed_by?: string | null
          created_at?: string
          created_by?: string | null
          death_date?: string | null
          death_year?: number | null
          deleted_at?: string | null
          display_name: string
          family_id: string
          id?: string
          is_child_record?: boolean
          nickname?: string | null
          origin_place?: string | null
          photo_path?: string | null
          version?: number
          vital?: Database["public"]["Enums"]["vital_status"]
        }
        Update: {
          bio?: string | null
          birth_date?: string | null
          birth_precision?: Database["public"]["Enums"]["date_precision"]
          birth_year?: number | null
          claimed_by?: string | null
          created_at?: string
          created_by?: string | null
          death_date?: string | null
          death_year?: number | null
          deleted_at?: string | null
          display_name?: string
          family_id?: string
          id?: string
          is_child_record?: boolean
          nickname?: string | null
          origin_place?: string | null
          photo_path?: string | null
          version?: number
          vital?: Database["public"]["Enums"]["vital_status"]
        }
        Relationships: [
          {
            foreignKeyName: "persons_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invitation: { Args: { _token: string }; Returns: string }
      add_relative: {
        Args: {
          _anchor_id: string
          _birth_year?: number
          _family_id: string
          _is_child_record?: boolean
          _kind?: Database["public"]["Enums"]["filiation_kind"]
          _name: string
          _other_parent_id?: string
          _relation: string
          _sibling_parent_ids?: string[]
          _vital?: Database["public"]["Enums"]["vital_status"]
        }
        Returns: string
      }
      can_write_family: { Args: { _family_id: string }; Returns: boolean }
      create_family: {
        Args: { _name: string; _person_name: string }
        Returns: string
      }
      create_invitation: {
        Args: {
          _days?: number
          _family_id: string
          _max_uses?: number
          _token: string
        }
        Returns: string
      }
      create_self_person: {
        Args: {
          _anchor_id?: string
          _family_id: string
          _name: string
          _relation?: string
        }
        Returns: string
      }
      export_family: { Args: { _family_id: string }; Returns: Json }
      family_role_of: {
        Args: { _family_id: string }
        Returns: Database["public"]["Enums"]["family_role"]
      }
      invitation_preview: {
        Args: { _token: string }
        Returns: {
          family_id: string
          family_name: string
          reason: string
          valid: boolean
        }[]
      }
      is_family_admin: { Args: { _family_id: string }; Returns: boolean }
      is_family_member: { Args: { _family_id: string }; Returns: boolean }
      link_persons: {
        Args: {
          _a: string
          _b: string
          _family_id: string
          _kind?: Database["public"]["Enums"]["filiation_kind"]
          _relation: string
        }
        Returns: undefined
      }
      manages_person: { Args: { _person_id: string }; Returns: boolean }
      request_claim: {
        Args: { _family_id: string; _note?: string; _person_id: string }
        Returns: string
      }
      review_claim: {
        Args: { _approve: boolean; _claim_id: string }
        Returns: undefined
      }
    }
    Enums: {
      date_precision: "exact" | "year" | "approx" | "unknown"
      family_role: "admin" | "member" | "reader"
      filiation_kind: "biological" | "adoptive" | "step" | "unknown"
      membership_status: "active" | "pending" | "removed"
      request_status: "pending" | "approved" | "rejected"
      union_status: "current" | "past" | "unknown"
      vital_status: "alive" | "deceased" | "unknown"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      date_precision: ["exact", "year", "approx", "unknown"],
      family_role: ["admin", "member", "reader"],
      filiation_kind: ["biological", "adoptive", "step", "unknown"],
      membership_status: ["active", "pending", "removed"],
      request_status: ["pending", "approved", "rejected"],
      union_status: ["current", "past", "unknown"],
      vital_status: ["alive", "deceased", "unknown"],
    },
  },
} as const
