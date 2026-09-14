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
      admin_district_access: {
        Row: {
          admin_user_id: string
          created_at: string
          district_id: string
        }
        Insert: {
          admin_user_id: string
          created_at?: string
          district_id: string
        }
        Update: {
          admin_user_id?: string
          created_at?: string
          district_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_district_access_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_district_access_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_users: {
        Row: {
          can_view_partners: boolean
          created_at: string
          disabled: boolean
          id: string
          last_login_at: string | null
          must_change_password: boolean
          password_hash: string | null
          role: Database["public"]["Enums"]["admin_role"]
          updated_at: string
          username: string
        }
        Insert: {
          can_view_partners?: boolean
          created_at?: string
          disabled?: boolean
          id?: string
          last_login_at?: string | null
          must_change_password?: boolean
          password_hash?: string | null
          role?: Database["public"]["Enums"]["admin_role"]
          updated_at?: string
          username: string
        }
        Update: {
          can_view_partners?: boolean
          created_at?: string
          disabled?: boolean
          id?: string
          last_login_at?: string | null
          must_change_password?: boolean
          password_hash?: string | null
          role?: Database["public"]["Enums"]["admin_role"]
          updated_at?: string
          username?: string
        }
        Relationships: []
      }
      admin_event_access: {
        Row: {
          admin_user_id: string
          created_at: string
          event_id: string
        }
        Insert: {
          admin_user_id: string
          created_at?: string
          event_id: string
        }
        Update: {
          admin_user_id?: string
          created_at?: string
          event_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_event_access_admin_user_id_fkey"
            columns: ["admin_user_id"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "admin_event_access_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      attendance: {
        Row: {
          id: string
          event_id: string
          registration_number: string
          full_name: string | null
          mobile: string | null
          status: string
          check_in_time: string
          check_in_method: string
          checked_in_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          event_id: string
          registration_number: string
          full_name?: string | null
          mobile?: string | null
          status?: string
          check_in_time?: string
          check_in_method?: string
          checked_in_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          event_id?: string
          registration_number?: string
          full_name?: string | null
          mobile?: string | null
          status?: string
          check_in_time?: string
          check_in_method?: string
          checked_in_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "attendance_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          banner_url: string | null
          contact_info: string | null
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          logo_url: string | null
          name: string
          organizer: string | null
          publish_status: string
          registration_status: string
          seo_title: string | null
          slogan: string | null
          slug: string
          start_date: string | null
          theme: Json
          updated_at: string
          venue: string | null
        }
        Insert: {
          banner_url?: string | null
          contact_info?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          logo_url?: string | null
          name: string
          organizer?: string | null
          publish_status?: string
          registration_status?: string
          seo_title?: string | null
          slogan?: string | null
          slug: string
          start_date?: string | null
          theme?: Json
          updated_at?: string
          venue?: string | null
        }
        Update: {
          banner_url?: string | null
          contact_info?: string | null
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          organizer?: string | null
          publish_status?: string
          registration_status?: string
          seo_title?: string | null
          slogan?: string | null
          slug?: string
          start_date?: string | null
          theme?: Json
          updated_at?: string
          venue?: string | null
        }
        Relationships: []
      }
      certificate_issues: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          attendance_pct: number | null
          certificate_number: string
          created_at: string
          district_id: string | null
          campaign_id: string | null
          full_name: string
          id: string
          issued_at: string | null
          mobile: string
          registration_number: string
          rejected_reason: string | null
          status: string
          template_id: string | null
          updated_at: string
          event_id: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          attendance_pct?: number | null
          certificate_number: string
          created_at?: string
          campaign_id?: string | null
          district_id?: string | null
          full_name: string
          id?: string
          issued_at?: string | null
          mobile: string
          registration_number: string
          rejected_reason?: string | null
          status?: string
          template_id?: string | null
          updated_at?: string
          event_id: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          attendance_pct?: number | null
          certificate_number?: string
          campaign_id?: string | null
          created_at?: string
          district_id?: string | null
          full_name?: string
          id?: string
          issued_at?: string | null
          mobile?: string
          registration_number?: string
          rejected_reason?: string | null
          status?: string
          template_id?: string | null
          updated_at?: string
          event_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificate_issues_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificate_issues_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      certificate_templates: {
        Row: {
          background_url: string | null
          created_at: string
          elements: Json
          id: string
          is_default: boolean
          name: string
          updated_at: string
          event_id: string
        }
        Insert: {
          background_url?: string | null
          created_at?: string
          elements?: Json
          id?: string
          is_default?: boolean
          name: string
          updated_at?: string
          event_id: string
        }
        Update: {
          background_url?: string | null
          created_at?: string
          elements?: Json
          id?: string
          is_default?: boolean
          name?: string
          updated_at?: string
          event_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificate_templates_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      districts: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          metadata: Json
          name: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          metadata?: Json
          name: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          metadata?: Json
          name?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      partners: {
        Row: {
          contact_person: string | null
          created_at: string
          custom_fields: Json
          district: string | null
          campaign_id: string | null
          district_id: string | null
          email: string | null
          id: string
          link_disabled: boolean
          mobile: string | null
          organization: string | null
          organizations: string[]
          partner_name: string
          slug: string
          status: string
          taluka: string | null
          updated_at: string
          event_id: string
        }
        Insert: {
          contact_person?: string | null
          created_at?: string
          campaign_id?: string | null
          custom_fields?: Json
          district?: string | null
          district_id?: string | null
          email?: string | null
          id?: string
          link_disabled?: boolean
          mobile?: string | null
          organization?: string | null
          organizations?: string[]
          partner_name: string
          slug: string
          status?: string
          taluka?: string | null
          updated_at?: string
          event_id: string
        }
        Update: {
          contact_person?: string | null
          campaign_id?: string | null
          created_at?: string
          custom_fields?: Json
          district?: string | null
          district_id?: string | null
          email?: string | null
          id?: string
          link_disabled?: boolean
          mobile?: string | null
          organization?: string | null
          organizations?: string[]
          partner_name?: string
          slug?: string
          status?: string
          taluka?: string | null
          updated_at?: string
          event_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "partners_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "partners_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      registrations: {
        Row: {
          age: number | null
          age_group: string | null
          certificate_available: boolean
          certificate_url: string | null
          created_at: string
          custom_fields: Json
          date_of_birth: string | null
          designation: string | null
          campaign_id: string | null
          district: string | null
          district_id: string | null
          full_name: string
          gender: string | null
          id: string
          mobile: string
          partner_id: string | null
          partner_name: string | null
          referral_code: string
          referred_by: string | null
          registration_number: string
          taluka: string | null
          village: string | null
          email: string | null
          organization: string | null
          qr_token: string | null
          event_id: string
        }
        Insert: {
          age?: number | null
          age_group?: string | null
          certificate_available?: boolean
          certificate_url?: string | null
          created_at?: string
          campaign_id?: string | null
          custom_fields?: Json
          date_of_birth?: string | null
          designation?: string | null
          district?: string | null
          district_id?: string | null
          full_name: string
          gender?: string | null
          id?: string
          mobile: string
          partner_id?: string | null
          partner_name?: string | null
          referral_code: string
          referred_by?: string | null
          registration_number: string
          taluka?: string | null
          village?: string | null
          email?: string | null
          organization?: string | null
          qr_token?: string | null
          event_id: string
        }
        Update: {
          age?: number | null
          age_group?: string | null
          certificate_available?: boolean
          certificate_url?: string | null
          campaign_id?: string | null
          created_at?: string
          custom_fields?: Json
          date_of_birth?: string | null
          designation?: string | null
          district?: string | null
          district_id?: string | null
          full_name?: string
          gender?: string | null
          id?: string
          mobile?: string
          partner_id?: string | null
          partner_name?: string | null
          referral_code?: string
          referred_by?: string | null
          registration_number?: string
          taluka?: string | null
          village?: string | null
          event_id?: string
          email?: string | null
          organization?: string | null
          qr_token?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "registrations_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings: {
        Row: {
          contact: Json
          created_at: string
          favicon_url: string | null
          footer: Json
          id: string
          logo_url: string | null
          name: string | null
          singleton: boolean
          theme: Json
          updated_at: string
        }
        Insert: {
          contact?: Json
          created_at?: string
          favicon_url?: string | null
          footer?: Json
          id?: string
          logo_url?: string | null
          name?: string | null
          singleton?: boolean
          theme?: Json
          updated_at?: string
        }
        Update: {
          contact?: Json
          created_at?: string
          favicon_url?: string | null
          footer?: Json
          id?: string
          logo_url?: string | null
          name?: string | null
          singleton?: boolean
          theme?: Json
          updated_at?: string
        }
        Relationships: []
      }
      event_broadcasts: {
        Row: {
          body: string | null
          created_at: string
          enabled: boolean
          id: string
          kind: string
          published_at: string
          surfaces: string[]
          title: string
          updated_at: string
          event_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          kind: string
          published_at?: string
          surfaces?: string[]
          title: string
          updated_at?: string
          event_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          enabled?: boolean
          id?: string
          kind?: string
          published_at?: string
          surfaces?: string[]
          title?: string
          updated_at?: string
          event_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_broadcasts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      events: {
        Row: {
          archived_at: string | null
          attendance: Json
          certificate: Json
          created_at: string
          demo_mode: Json
          campaign_id: string | null
          description: string | null
          district: string | null
          district_id: string | null
          district_name: string | null
          features: Json
          form: Json
          general: Json
          id: string
          is_active: boolean
          is_template: boolean
          lifecycle_status: string
          live: Json
          venue: string | null
          max_registrations: number | null
          partner_form: Json
          publish_status: string
          referral: Json
          reg_prefix: string | null
          registration_close_at: string | null
          registration_open_at: string | null
          slug: string | null
          social: Json
          status: Json
          template_category: string | null
          type: string
          updated_at: string
          event_date: string | null
          event_time: string | null
          whatsapp: Json
        }
        Insert: {
          archived_at?: string | null
          campaign_id?: string | null
          attendance?: Json
          certificate?: Json
          created_at?: string
          demo_mode?: Json
          description?: string | null
          district?: string | null
          district_id?: string | null
          district_name?: string | null
          features?: Json
          form?: Json
          general?: Json
          id?: string
          is_active?: boolean
          is_template?: boolean
          lifecycle_status?: string
          live?: Json
          max_registrations?: number | null
          partner_form?: Json
          publish_status?: string
          referral?: Json
          reg_prefix?: string | null
          registration_close_at?: string | null
          registration_open_at?: string | null
          slug?: string | null
          social?: Json
          status?: Json
          template_category?: string | null
          type?: string
          updated_at?: string
          event_date?: string | null
          event_time?: string | null
          whatsapp?: Json
        }
        Update: {
          campaign_id?: string | null
          archived_at?: string | null
          attendance?: Json
          certificate?: Json
          created_at?: string
          demo_mode?: Json
          description?: string | null
          district?: string | null
          district_id?: string | null
          district_name?: string | null
          features?: Json
          form?: Json
          general?: Json
          id?: string
          is_active?: boolean
          is_template?: boolean
          lifecycle_status?: string
          live?: Json
          max_registrations?: number | null
          partner_form?: Json
          publish_status?: string
          referral?: Json
          reg_prefix?: string | null
          registration_close_at?: string | null
          registration_open_at?: string | null
          slug?: string | null
          social?: Json
          status?: Json
          template_category?: string | null
          type?: string
          updated_at?: string
          event_date?: string | null
          event_time?: string | null
          whatsapp?: Json
        }
        Relationships: [
          {
            foreignKeyName: "events_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
        ]
      }
      event_notices: {
        Row: {
          body: string | null
          created_at: string
          enabled: boolean
          ends_at: string | null
          id: string
          kind: string
          starts_at: string | null
          title: string | null
          updated_at: string
          event_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          enabled?: boolean
          ends_at?: string | null
          id?: string
          kind: string
          starts_at?: string | null
          title?: string | null
          updated_at?: string
          event_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          enabled?: boolean
          ends_at?: string | null
          id?: string
          kind?: string
          starts_at?: string | null
          title?: string | null
          updated_at?: string
          event_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_notices_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_organisations: {
        Row: {
          created_at: string
          id: string
          name: string
          notes: string | null
          status: string
          updated_at: string
          event_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          notes?: string | null
          status?: string
          updated_at?: string
          event_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          notes?: string | null
          status?: string
          updated_at?: string
          event_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_organisations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      event_reg_seq: {
        Row: {
          next_val: number
          updated_at: string
          event_id: string
        }
        Insert: {
          next_val?: number
          updated_at?: string
          event_id: string
        }
        Update: {
          next_val?: number
          updated_at?: string
          event_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_reg_seq_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: true
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_allowed_event_ids: {
        Args: { _admin_user_id: string }
        Returns: string[]
      }
      generate_registration_number:
        | { Args: never; Returns: string }
        | { Args: { _event_id: string }; Returns: string }
      partner_stats: { Args: { _partner_id: string }; Returns: Json }
      registration_geo_counts: {
        Args: { _event_id: string }
        Returns: {
          cnt: number
          field: string
          value: string
        }[]
      }
      registration_stats:
        | { Args: never; Returns: Json }
        | { Args: { _event_id?: string }; Returns: Json }
      event_overview: { Args: never; Returns: Json }
    }
    Enums: {
      admin_role: "super_admin" | "view_admin"
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
      admin_role: ["super_admin", "view_admin"],
    },
  },
} as const
