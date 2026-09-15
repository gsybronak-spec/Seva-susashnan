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
          check_in_method: string
          check_in_time: string
          checked_in_by: string | null
          created_at: string
          district_id: string | null
          event_id: string
          full_name: string | null
          id: string
          ip: string | null
          mobile: string | null
          registration_id: string | null
          registration_number: string
          scanner_id: string | null
          status: string
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          check_in_method?: string
          check_in_time?: string
          checked_in_by?: string | null
          created_at?: string
          district_id?: string | null
          event_id: string
          full_name?: string | null
          id?: string
          ip?: string | null
          mobile?: string | null
          registration_id?: string | null
          registration_number: string
          scanner_id?: string | null
          status?: string
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          check_in_method?: string
          check_in_time?: string
          checked_in_by?: string | null
          created_at?: string
          district_id?: string | null
          event_id?: string
          full_name?: string | null
          id?: string
          ip?: string | null
          mobile?: string | null
          registration_id?: string | null
          registration_number?: string
          scanner_id?: string | null
          status?: string
          updated_at?: string
          user_agent?: string | null
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
          {
            foreignKeyName: "attendance_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_scanner_id_fkey"
            columns: ["scanner_id"]
            isOneToOne: false
            referencedRelation: "event_scanners"
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
      certificate_downloads: {
        Row: {
          certificate_issue_id: string | null
          downloaded_at: string
          event_id: string
          id: string
          ip: string | null
          registration_id: string
          user_agent: string | null
        }
        Insert: {
          certificate_issue_id?: string | null
          downloaded_at?: string
          event_id: string
          id?: string
          ip?: string | null
          registration_id: string
          user_agent?: string | null
        }
        Update: {
          certificate_issue_id?: string | null
          downloaded_at?: string
          event_id?: string
          id?: string
          ip?: string | null
          registration_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "certificate_downloads_certificate_issue_id_fkey"
            columns: ["certificate_issue_id"]
            isOneToOne: false
            referencedRelation: "certificate_issues"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificate_downloads_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "certificate_downloads_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
        ]
      }
      certificate_issues: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          attendance_pct: number | null
          campaign_id: string | null
          certificate_number: string
          created_at: string
          district_id: string | null
          event_id: string
          full_name: string
          id: string
          issued_at: string | null
          mobile: string
          registration_number: string
          rejected_reason: string | null
          status: string
          template_id: string | null
          updated_at: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          attendance_pct?: number | null
          campaign_id?: string | null
          certificate_number: string
          created_at?: string
          district_id?: string | null
          event_id: string
          full_name: string
          id?: string
          issued_at?: string | null
          mobile: string
          registration_number: string
          rejected_reason?: string | null
          status?: string
          template_id?: string | null
          updated_at?: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          attendance_pct?: number | null
          campaign_id?: string | null
          certificate_number?: string
          created_at?: string
          district_id?: string | null
          event_id?: string
          full_name?: string
          id?: string
          issued_at?: string | null
          mobile?: string
          registration_number?: string
          rejected_reason?: string | null
          status?: string
          template_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "certificate_issues_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
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
          event_id: string
          id: string
          is_default: boolean
          name: string
          updated_at: string
        }
        Insert: {
          background_url?: string | null
          created_at?: string
          elements?: Json
          event_id: string
          id?: string
          is_default?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          background_url?: string | null
          created_at?: string
          elements?: Json
          event_id?: string
          id?: string
          is_default?: boolean
          name?: string
          updated_at?: string
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
      contact_messages: {
        Row: {
          created_at: string
          email: string | null
          id: string
          message: string | null
          name: string | null
          subject: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: string
          message?: string | null
          name?: string | null
          subject?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: string
          message?: string | null
          name?: string | null
          subject?: string | null
        }
        Relationships: []
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
      event_broadcasts: {
        Row: {
          body: string | null
          created_at: string
          enabled: boolean
          event_id: string
          id: string
          kind: string
          published_at: string
          surfaces: string[]
          title: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          enabled?: boolean
          event_id: string
          id?: string
          kind: string
          published_at?: string
          surfaces?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          created_at?: string
          enabled?: boolean
          event_id?: string
          id?: string
          kind?: string
          published_at?: string
          surfaces?: string[]
          title?: string
          updated_at?: string
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
      event_checkin_attempts: {
        Row: {
          attempted_at: string
          checked_in_by: string | null
          event_id: string
          id: string
          ip: string | null
          method: string
          payload_hash: string | null
          registration_id: string | null
          result: string
          scanner_id: string | null
          user_agent: string | null
        }
        Insert: {
          attempted_at?: string
          checked_in_by?: string | null
          event_id: string
          id?: string
          ip?: string | null
          method: string
          payload_hash?: string | null
          registration_id?: string | null
          result: string
          scanner_id?: string | null
          user_agent?: string | null
        }
        Update: {
          attempted_at?: string
          checked_in_by?: string | null
          event_id?: string
          id?: string
          ip?: string | null
          method?: string
          payload_hash?: string | null
          registration_id?: string | null
          result?: string
          scanner_id?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "event_checkin_attempts_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_checkin_attempts_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_checkin_attempts_scanner_id_fkey"
            columns: ["scanner_id"]
            isOneToOne: false
            referencedRelation: "event_scanners"
            referencedColumns: ["id"]
          },
        ]
      }
      event_id_cards: {
        Row: {
          access_hash: string | null
          created_at: string
          download_count: number
          event_id: string
          first_downloaded_at: string | null
          id: string
          issued_at: string
          last_downloaded_at: string | null
          registration_id: string
          token_id: string
          updated_at: string
        }
        Insert: {
          access_hash?: string | null
          created_at?: string
          download_count?: number
          event_id: string
          first_downloaded_at?: string | null
          id?: string
          issued_at?: string
          last_downloaded_at?: string | null
          registration_id: string
          token_id?: string
          updated_at?: string
        }
        Update: {
          access_hash?: string | null
          created_at?: string
          download_count?: number
          event_id?: string
          first_downloaded_at?: string | null
          id?: string
          issued_at?: string
          last_downloaded_at?: string | null
          registration_id?: string
          token_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_id_cards_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_id_cards_registration_id_fkey"
            columns: ["registration_id"]
            isOneToOne: false
            referencedRelation: "registrations"
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
          event_id: string
          id: string
          kind: string
          starts_at: string | null
          title: string | null
          updated_at: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          enabled?: boolean
          ends_at?: string | null
          event_id: string
          id?: string
          kind: string
          starts_at?: string | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          body?: string | null
          created_at?: string
          enabled?: boolean
          ends_at?: string | null
          event_id?: string
          id?: string
          kind?: string
          starts_at?: string | null
          title?: string | null
          updated_at?: string
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
          event_id: string
          id: string
          name: string
          notes: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_id: string
          id?: string
          name: string
          notes?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_id?: string
          id?: string
          name?: string
          notes?: string | null
          status?: string
          updated_at?: string
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
          event_id: string
          next_val: number
          updated_at: string
        }
        Insert: {
          event_id: string
          next_val?: number
          updated_at?: string
        }
        Update: {
          event_id?: string
          next_val?: number
          updated_at?: string
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
      event_scanners: {
        Row: {
          created_at: string
          created_by: string | null
          duplicate_attempts: number
          event_id: string
          id: string
          is_active: boolean
          last_activity_at: string | null
          operator_name: string
          revoked_at: string | null
          scanner_code: string
          scanner_name: string
          secret_hash: string
          total_scans: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          duplicate_attempts?: number
          event_id: string
          id?: string
          is_active?: boolean
          last_activity_at?: string | null
          operator_name: string
          revoked_at?: string | null
          scanner_code: string
          scanner_name: string
          secret_hash: string
          total_scans?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          duplicate_attempts?: number
          event_id?: string
          id?: string
          is_active?: boolean
          last_activity_at?: string | null
          operator_name?: string
          revoked_at?: string | null
          scanner_code?: string
          scanner_name?: string
          secret_hash?: string
          total_scans?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "event_scanners_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "admin_users"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "event_scanners_event_id_fkey"
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
          campaign_id: string | null
          certificate: Json
          created_at: string
          demo_mode: Json
          description: string | null
          district: string | null
          district_id: string | null
          district_name: string | null
          event_date: string | null
          event_time: string | null
          features: Json
          form: Json
          general: Json
          id: string
          is_active: boolean
          is_template: boolean
          lifecycle_status: string
          live: Json
          max_registrations: number | null
          partner_form: Json
          publish_status: string
          qr_token: string | null
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
          venue: string | null
          whatsapp: Json
          youtube_live_url: string | null
        }
        Insert: {
          archived_at?: string | null
          attendance?: Json
          campaign_id?: string | null
          certificate?: Json
          created_at?: string
          demo_mode?: Json
          description?: string | null
          district?: string | null
          district_id?: string | null
          district_name?: string | null
          event_date?: string | null
          event_time?: string | null
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
          qr_token?: string | null
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
          venue?: string | null
          whatsapp?: Json
          youtube_live_url?: string | null
        }
        Update: {
          archived_at?: string | null
          attendance?: Json
          campaign_id?: string | null
          certificate?: Json
          created_at?: string
          demo_mode?: Json
          description?: string | null
          district?: string | null
          district_id?: string | null
          district_name?: string | null
          event_date?: string | null
          event_time?: string | null
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
          qr_token?: string | null
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
          venue?: string | null
          whatsapp?: Json
          youtube_live_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "events_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
        ]
      }
      organisations: {
        Row: {
          contact_info: string | null
          created_at: string
          description: string | null
          event_id: string | null
          id: string
          is_active: boolean
          logo_url: string | null
          name: string
          slug: string | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          contact_info?: string | null
          created_at?: string
          description?: string | null
          event_id?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name: string
          slug?: string | null
          sort_order?: number
          updated_at?: string
        }
        Update: {
          contact_info?: string | null
          created_at?: string
          description?: string | null
          event_id?: string | null
          id?: string
          is_active?: boolean
          logo_url?: string | null
          name?: string
          slug?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organisations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      partners: {
        Row: {
          contact_person: string | null
          created_at: string
          custom_fields: Json
          district: string | null
          district_id: string | null
          email: string | null
          event_id: string
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
        }
        Insert: {
          contact_person?: string | null
          created_at?: string
          custom_fields?: Json
          district?: string | null
          district_id?: string | null
          email?: string | null
          event_id: string
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
        }
        Update: {
          contact_person?: string | null
          created_at?: string
          custom_fields?: Json
          district?: string | null
          district_id?: string | null
          email?: string | null
          event_id?: string
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
      partners_forms: {
        Row: {
          created_at: string
          event_id: string | null
          fields: Json
          id: string
          is_active: boolean
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          event_id?: string | null
          fields?: Json
          id?: string
          is_active?: boolean
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          event_id?: string | null
          fields?: Json
          id?: string
          is_active?: boolean
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partners_forms_event_id_fkey"
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
          campaign_id: string | null
          certificate_available: boolean
          certificate_url: string | null
          created_at: string
          custom_fields: Json
          date_of_birth: string | null
          designation: string | null
          district: string | null
          district_id: string | null
          email: string | null
          event_id: string
          full_name: string
          gender: string | null
          id: string
          mobile: string
          organization: string | null
          partner_id: string | null
          partner_name: string | null
          qr_token: string | null
          referral_code: string
          referred_by: string | null
          registration_number: string
          taluka: string | null
          village: string | null
        }
        Insert: {
          age?: number | null
          age_group?: string | null
          campaign_id?: string | null
          certificate_available?: boolean
          certificate_url?: string | null
          created_at?: string
          custom_fields?: Json
          date_of_birth?: string | null
          designation?: string | null
          district?: string | null
          district_id?: string | null
          email?: string | null
          event_id: string
          full_name: string
          gender?: string | null
          id?: string
          mobile: string
          organization?: string | null
          partner_id?: string | null
          partner_name?: string | null
          qr_token?: string | null
          referral_code: string
          referred_by?: string | null
          registration_number: string
          taluka?: string | null
          village?: string | null
        }
        Update: {
          age?: number | null
          age_group?: string | null
          campaign_id?: string | null
          certificate_available?: boolean
          certificate_url?: string | null
          created_at?: string
          custom_fields?: Json
          date_of_birth?: string | null
          designation?: string | null
          district?: string | null
          district_id?: string | null
          email?: string | null
          event_id?: string
          full_name?: string
          gender?: string | null
          id?: string
          mobile?: string
          organization?: string | null
          partner_id?: string | null
          partner_name?: string | null
          qr_token?: string | null
          referral_code?: string
          referred_by?: string | null
          registration_number?: string
          taluka?: string | null
          village?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "registrations_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_allowed_event_ids: {
        Args: { _admin_user_id: string }
        Returns: string[]
      }
      event_overview: { Args: never; Returns: Json }
      event_overview_stats: { Args: { _event_id: string }; Returns: Json }
      generate_registration_number:
        | { Args: never; Returns: string }
        | { Args: { _event_id: string }; Returns: string }
      partner_stats: { Args: { _partner_id: string }; Returns: Json }
      record_event_checkin: {
        Args: {
          _checked_in_by?: string
          _event_id: string
          _ip?: string
          _method: string
          _payload_hash?: string
          _registration_id: string
          _scanner_id?: string
          _user_agent?: string
        }
        Returns: {
          attendance_id: string
          original_check_in: string
          result: string
        }[]
      }
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
