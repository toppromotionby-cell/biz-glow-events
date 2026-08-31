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
      assistant_actions: {
        Row: {
          action: string
          after_state: Json | null
          before_state: Json | null
          chat_key: string | null
          created_at: string
          id: string
          item_id: string | null
          undone_at: string | null
        }
        Insert: {
          action: string
          after_state?: Json | null
          before_state?: Json | null
          chat_key?: string | null
          created_at?: string
          id?: string
          item_id?: string | null
          undone_at?: string | null
        }
        Update: {
          action?: string
          after_state?: Json | null
          before_state?: Json | null
          chat_key?: string | null
          created_at?: string
          id?: string
          item_id?: string | null
          undone_at?: string | null
        }
        Relationships: []
      }
      assistant_dialog: {
        Row: {
          channel: string
          chat_key: string
          content: string
          created_at: string
          focus_item_id: string | null
          id: string
          role: string
        }
        Insert: {
          channel?: string
          chat_key: string
          content: string
          created_at?: string
          focus_item_id?: string | null
          id?: string
          role: string
        }
        Update: {
          channel?: string
          chat_key?: string
          content?: string
          created_at?: string
          focus_item_id?: string | null
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "assistant_dialog_focus_item_id_fkey"
            columns: ["focus_item_id"]
            isOneToOne: false
            referencedRelation: "calendar_items"
            referencedColumns: ["id"]
          },
        ]
      }
      assistant_memory: {
        Row: {
          active: boolean
          created_at: string
          id: string
          key: string
          kind: string
          last_used_at: string | null
          source: string
          updated_at: string
          value: string
          weight: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          key: string
          kind?: string
          last_used_at?: string | null
          source?: string
          updated_at?: string
          value: string
          weight?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          key?: string
          kind?: string
          last_used_at?: string | null
          source?: string
          updated_at?: string
          value?: string
          weight?: number
        }
        Relationships: []
      }
      assistant_plans: {
        Row: {
          chat_key: string | null
          created_at: string
          decided_at: string | null
          expires_at: string
          id: string
          questions: Json
          reminded_at: string | null
          request: string | null
          research: Json
          result: string | null
          status: string
          steps: Json
          summary: string | null
          tg_chat_id: number | null
          tg_message_id: number | null
          title: string
          updated_at: string
        }
        Insert: {
          chat_key?: string | null
          created_at?: string
          decided_at?: string | null
          expires_at?: string
          id?: string
          questions?: Json
          reminded_at?: string | null
          request?: string | null
          research?: Json
          result?: string | null
          status?: string
          steps?: Json
          summary?: string | null
          tg_chat_id?: number | null
          tg_message_id?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          chat_key?: string | null
          created_at?: string
          decided_at?: string | null
          expires_at?: string
          id?: string
          questions?: Json
          reminded_at?: string | null
          request?: string | null
          research?: Json
          result?: string | null
          status?: string
          steps?: Json
          summary?: string | null
          tg_chat_id?: number | null
          tg_message_id?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      assistant_prefs: {
        Row: {
          alice_link_code: string | null
          alice_mirror_tg: boolean
          alice_push_enabled: boolean
          alice_skill_id: string | null
          alice_user_ids: string[]
          brain_enabled: boolean
          created_at: string
          digest_visual: boolean
          evening_time: string
          followup_minutes: number
          gtasks_enabled: boolean
          hard_reminder_minutes: number[]
          id: number
          last_device_tz: string | null
          morning_time: string
          owner_name: string | null
          quiet_end: string
          quiet_start: string
          reminder_minutes: number[]
          style_profile: string | null
          task_routing: string
          tg_allowed_chat_ids: number[]
          tg_bot_username: string | null
          tg_chat_id: number | null
          tone: string
          tz: string
          updated_at: string
          visual_mode: string
          visuals_enabled: boolean
          voice_reply: boolean
        }
        Insert: {
          alice_link_code?: string | null
          alice_mirror_tg?: boolean
          alice_push_enabled?: boolean
          alice_skill_id?: string | null
          alice_user_ids?: string[]
          brain_enabled?: boolean
          created_at?: string
          digest_visual?: boolean
          evening_time?: string
          followup_minutes?: number
          gtasks_enabled?: boolean
          hard_reminder_minutes?: number[]
          id?: number
          last_device_tz?: string | null
          morning_time?: string
          owner_name?: string | null
          quiet_end?: string
          quiet_start?: string
          reminder_minutes?: number[]
          style_profile?: string | null
          task_routing?: string
          tg_allowed_chat_ids?: number[]
          tg_bot_username?: string | null
          tg_chat_id?: number | null
          tone?: string
          tz?: string
          updated_at?: string
          visual_mode?: string
          visuals_enabled?: boolean
          voice_reply?: boolean
        }
        Update: {
          alice_link_code?: string | null
          alice_mirror_tg?: boolean
          alice_push_enabled?: boolean
          alice_skill_id?: string | null
          alice_user_ids?: string[]
          brain_enabled?: boolean
          created_at?: string
          digest_visual?: boolean
          evening_time?: string
          followup_minutes?: number
          gtasks_enabled?: boolean
          hard_reminder_minutes?: number[]
          id?: number
          last_device_tz?: string | null
          morning_time?: string
          owner_name?: string | null
          quiet_end?: string
          quiet_start?: string
          reminder_minutes?: number[]
          style_profile?: string | null
          task_routing?: string
          tg_allowed_chat_ids?: number[]
          tg_bot_username?: string | null
          tg_chat_id?: number | null
          tone?: string
          tz?: string
          updated_at?: string
          visual_mode?: string
          visuals_enabled?: boolean
          voice_reply?: boolean
        }
        Relationships: []
      }
      attractions: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          extras: Json
          faq: Json | null
          features: Json | null
          id: string
          photo_urls: string[] | null
          pricing: Json | null
          published: boolean
          requirements: string | null
          seo_description: string | null
          seo_title: string | null
          slug: string
          sort_order: number
          title: string
          updated_at: string
          video_urls: string[] | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          extras?: Json
          faq?: Json | null
          features?: Json | null
          id?: string
          photo_urls?: string[] | null
          pricing?: Json | null
          published?: boolean
          requirements?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          sort_order?: number
          title: string
          updated_at?: string
          video_urls?: string[] | null
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          extras?: Json
          faq?: Json | null
          features?: Json | null
          id?: string
          photo_urls?: string[] | null
          pricing?: Json | null
          published?: boolean
          requirements?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          sort_order?: number
          title?: string
          updated_at?: string
          video_urls?: string[] | null
        }
        Relationships: []
      }
      audit_log: {
        Row: {
          action: string
          created_at: string
          id: string
          ip_hash: string | null
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip_hash?: string | null
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip_hash?: string | null
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string
          user_id?: string | null
        }
        Relationships: []
      }
      availability: {
        Row: {
          created_at: string
          end_date: string
          entity_type: string
          id: string
          item_id: string
          order_id: string | null
          start_date: string
          status: Database["public"]["Enums"]["availability_status"]
        }
        Insert: {
          created_at?: string
          end_date: string
          entity_type: string
          id?: string
          item_id: string
          order_id?: string | null
          start_date: string
          status?: Database["public"]["Enums"]["availability_status"]
        }
        Update: {
          created_at?: string
          end_date?: string
          entity_type?: string
          id?: string
          item_id?: string
          order_id?: string | null
          start_date?: string
          status?: Database["public"]["Enums"]["availability_status"]
        }
        Relationships: [
          {
            foreignKeyName: "availability_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_posts: {
        Row: {
          author_id: string | null
          body: string | null
          cover_url: string | null
          created_at: string
          excerpt: string | null
          id: string
          published: boolean
          published_at: string | null
          seo_description: string | null
          seo_title: string | null
          slug: string
          sort_order: number
          tags: string[] | null
          title: string
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          body?: string | null
          cover_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          published?: boolean
          published_at?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          sort_order?: number
          tags?: string[] | null
          title: string
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          body?: string | null
          cover_url?: string | null
          created_at?: string
          excerpt?: string | null
          id?: string
          published?: boolean
          published_at?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          sort_order?: number
          tags?: string[] | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      calendar_directions: {
        Row: {
          active: boolean
          color: string
          created_at: string
          emoji: string | null
          google_color_id: string | null
          google_tasklist_id: string | null
          id: string
          key: string
          keywords: string[]
          sort: number
          title: string
          updated_at: string
          work_end: string
          work_start: string
        }
        Insert: {
          active?: boolean
          color?: string
          created_at?: string
          emoji?: string | null
          google_color_id?: string | null
          google_tasklist_id?: string | null
          id?: string
          key: string
          keywords?: string[]
          sort?: number
          title: string
          updated_at?: string
          work_end?: string
          work_start?: string
        }
        Update: {
          active?: boolean
          color?: string
          created_at?: string
          emoji?: string | null
          google_color_id?: string | null
          google_tasklist_id?: string | null
          id?: string
          key?: string
          keywords?: string[]
          sort?: number
          title?: string
          updated_at?: string
          work_end?: string
          work_start?: string
        }
        Relationships: []
      }
      calendar_inbox: {
        Row: {
          created_at: string
          id: string
          item_id: string | null
          parsed: Json | null
          question: string | null
          raw_text: string | null
          source: string
          status: string
          tg_chat_id: number | null
          tg_message_id: number | null
          transcript: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          item_id?: string | null
          parsed?: Json | null
          question?: string | null
          raw_text?: string | null
          source?: string
          status?: string
          tg_chat_id?: number | null
          tg_message_id?: number | null
          transcript?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          item_id?: string | null
          parsed?: Json | null
          question?: string | null
          raw_text?: string | null
          source?: string
          status?: string
          tg_chat_id?: number | null
          tg_message_id?: number | null
          transcript?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_inbox_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "calendar_items"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_items: {
        Row: {
          all_day: boolean
          completed_at: string | null
          created_at: string
          direction_id: string | null
          due_at: string | null
          ends_at: string | null
          google_etag: string | null
          google_event_id: string | null
          google_task_id: string | null
          google_tasklist_id: string | null
          google_tasks_etag: string | null
          google_tasks_updated_at: string | null
          google_updated_at: string | null
          id: string
          importance: string
          kind: string
          location: string | null
          notes: string | null
          parent_id: string | null
          participants: string[]
          priority: number
          recurrence: string | null
          reschedule_count: number
          source: string
          starts_at: string | null
          status: string
          tags: string[]
          title: string
          tz: string
          updated_at: string
        }
        Insert: {
          all_day?: boolean
          completed_at?: string | null
          created_at?: string
          direction_id?: string | null
          due_at?: string | null
          ends_at?: string | null
          google_etag?: string | null
          google_event_id?: string | null
          google_task_id?: string | null
          google_tasklist_id?: string | null
          google_tasks_etag?: string | null
          google_tasks_updated_at?: string | null
          google_updated_at?: string | null
          id?: string
          importance?: string
          kind?: string
          location?: string | null
          notes?: string | null
          parent_id?: string | null
          participants?: string[]
          priority?: number
          recurrence?: string | null
          reschedule_count?: number
          source?: string
          starts_at?: string | null
          status?: string
          tags?: string[]
          title: string
          tz?: string
          updated_at?: string
        }
        Update: {
          all_day?: boolean
          completed_at?: string | null
          created_at?: string
          direction_id?: string | null
          due_at?: string | null
          ends_at?: string | null
          google_etag?: string | null
          google_event_id?: string | null
          google_task_id?: string | null
          google_tasklist_id?: string | null
          google_tasks_etag?: string | null
          google_tasks_updated_at?: string | null
          google_updated_at?: string | null
          id?: string
          importance?: string
          kind?: string
          location?: string | null
          notes?: string | null
          parent_id?: string | null
          participants?: string[]
          priority?: number
          recurrence?: string | null
          reschedule_count?: number
          source?: string
          starts_at?: string | null
          status?: string
          tags?: string[]
          title?: string
          tz?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_items_direction_id_fkey"
            columns: ["direction_id"]
            isOneToOne: false
            referencedRelation: "calendar_directions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "calendar_items_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "calendar_items"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_outbox: {
        Row: {
          channel: string
          created_at: string
          id: string
          item_id: string | null
          kind: string
          pushed_at: string | null
          spoken_at: string | null
          text: string
        }
        Insert: {
          channel?: string
          created_at?: string
          id?: string
          item_id?: string | null
          kind?: string
          pushed_at?: string | null
          spoken_at?: string | null
          text: string
        }
        Update: {
          channel?: string
          created_at?: string
          id?: string
          item_id?: string | null
          kind?: string
          pushed_at?: string | null
          spoken_at?: string | null
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "calendar_outbox_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "calendar_items"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_reminders: {
        Row: {
          created_at: string
          fire_at: string
          id: string
          item_id: string | null
          kind: string
          payload: Json
          sent_at: string | null
        }
        Insert: {
          created_at?: string
          fire_at: string
          id?: string
          item_id?: string | null
          kind: string
          payload?: Json
          sent_at?: string | null
        }
        Update: {
          created_at?: string
          fire_at?: string
          id?: string
          item_id?: string | null
          kind?: string
          payload?: Json
          sent_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "calendar_reminders_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "calendar_items"
            referencedColumns: ["id"]
          },
        ]
      }
      calendar_sync_state: {
        Row: {
          google_calendar_id: string
          id: number
          last_evening_on: string | null
          last_morning_on: string | null
          last_pull_at: string | null
          last_weekly_on: string | null
          lease_until: string | null
          paused_at: string | null
          paused_reason: string | null
          sync_token: string | null
          updated_at: string
        }
        Insert: {
          google_calendar_id?: string
          id?: number
          last_evening_on?: string | null
          last_morning_on?: string | null
          last_pull_at?: string | null
          last_weekly_on?: string | null
          lease_until?: string | null
          paused_at?: string | null
          paused_reason?: string | null
          sync_token?: string | null
          updated_at?: string
        }
        Update: {
          google_calendar_id?: string
          id?: number
          last_evening_on?: string | null
          last_morning_on?: string | null
          last_pull_at?: string | null
          last_weekly_on?: string | null
          lease_until?: string | null
          paused_at?: string | null
          paused_reason?: string | null
          sync_token?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      campaigns: {
        Row: {
          active: boolean
          budget: number | null
          created_at: string
          end_date: string | null
          goal_conversions: number | null
          id: string
          name: string
          source: string | null
          start_date: string | null
        }
        Insert: {
          active?: boolean
          budget?: number | null
          created_at?: string
          end_date?: string | null
          goal_conversions?: number | null
          id?: string
          name: string
          source?: string | null
          start_date?: string | null
        }
        Update: {
          active?: boolean
          budget?: number | null
          created_at?: string
          end_date?: string | null
          goal_conversions?: number | null
          id?: string
          name?: string
          source?: string | null
          start_date?: string | null
        }
        Relationships: []
      }
      cart_drafts: {
        Row: {
          items: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          items?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          items?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      cases: {
        Row: {
          client: string | null
          cover_url: string | null
          created_at: string
          description: string | null
          event_date: string | null
          event_type: string | null
          featured: boolean
          guests_count: number | null
          id: string
          location: string | null
          metrics: Json | null
          photo_urls: string[] | null
          published: boolean
          seo_description: string | null
          seo_title: string | null
          services_used: string[] | null
          slug: string
          sort_order: number
          summary: string | null
          title: string
          updated_at: string
          video_urls: string[] | null
        }
        Insert: {
          client?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          event_date?: string | null
          event_type?: string | null
          featured?: boolean
          guests_count?: number | null
          id?: string
          location?: string | null
          metrics?: Json | null
          photo_urls?: string[] | null
          published?: boolean
          seo_description?: string | null
          seo_title?: string | null
          services_used?: string[] | null
          slug: string
          sort_order?: number
          summary?: string | null
          title: string
          updated_at?: string
          video_urls?: string[] | null
        }
        Update: {
          client?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          event_date?: string | null
          event_type?: string | null
          featured?: boolean
          guests_count?: number | null
          id?: string
          location?: string | null
          metrics?: Json | null
          photo_urls?: string[] | null
          published?: boolean
          seo_description?: string | null
          seo_title?: string | null
          services_used?: string[] | null
          slug?: string
          sort_order?: number
          summary?: string | null
          title?: string
          updated_at?: string
          video_urls?: string[] | null
        }
        Relationships: []
      }
      catalog_categories: {
        Row: {
          created_at: string
          description: string
          entity_type: string
          icon: string
          id: string
          name: string
          slug: string | null
          sort_order: number
          updated_at: string
          visible: boolean
        }
        Insert: {
          created_at?: string
          description?: string
          entity_type: string
          icon?: string
          id?: string
          name: string
          slug?: string | null
          sort_order?: number
          updated_at?: string
          visible?: boolean
        }
        Update: {
          created_at?: string
          description?: string
          entity_type?: string
          icon?: string
          id?: string
          name?: string
          slug?: string | null
          sort_order?: number
          updated_at?: string
          visible?: boolean
        }
        Relationships: []
      }
      catalog_sections: {
        Row: {
          auto_hidden: boolean
          category_ids: string[]
          created_at: string
          description: string
          icon: string
          key: string
          kind: string
          slug: string | null
          sort_order: number
          title: string
          updated_at: string
          visible: boolean
        }
        Insert: {
          auto_hidden?: boolean
          category_ids?: string[]
          created_at?: string
          description?: string
          icon?: string
          key: string
          kind?: string
          slug?: string | null
          sort_order?: number
          title: string
          updated_at?: string
          visible?: boolean
        }
        Update: {
          auto_hidden?: boolean
          category_ids?: string[]
          created_at?: string
          description?: string
          icon?: string
          key?: string
          kind?: string
          slug?: string | null
          sort_order?: number
          title?: string
          updated_at?: string
          visible?: boolean
        }
        Relationships: []
      }
      company_profiles: {
        Row: {
          accent_color: string
          bank_account: string
          bank_bic: string
          bank_name: string
          company_address: string
          company_brand: string
          company_email: string
          company_legal_name: string
          company_phone: string
          company_unp: string
          company_website: string
          created_at: string
          id: string
          is_default: boolean
          logo_layout: Json
          logo_url: string | null
          name: string
          participants: Json
          signature_url: string | null
          signer_basis: string
          signer_name: string
          signer_title: string
          sort_order: number
          stamp_url: string | null
          updated_at: string
          vat_as_line: boolean
          vat_mode: string
          vat_note: string
          vat_rate: number
        }
        Insert: {
          accent_color?: string
          bank_account?: string
          bank_bic?: string
          bank_name?: string
          company_address?: string
          company_brand?: string
          company_email?: string
          company_legal_name?: string
          company_phone?: string
          company_unp?: string
          company_website?: string
          created_at?: string
          id?: string
          is_default?: boolean
          logo_layout?: Json
          logo_url?: string | null
          name?: string
          participants?: Json
          signature_url?: string | null
          signer_basis?: string
          signer_name?: string
          signer_title?: string
          sort_order?: number
          stamp_url?: string | null
          updated_at?: string
          vat_as_line?: boolean
          vat_mode?: string
          vat_note?: string
          vat_rate?: number
        }
        Update: {
          accent_color?: string
          bank_account?: string
          bank_bic?: string
          bank_name?: string
          company_address?: string
          company_brand?: string
          company_email?: string
          company_legal_name?: string
          company_phone?: string
          company_unp?: string
          company_website?: string
          created_at?: string
          id?: string
          is_default?: boolean
          logo_layout?: Json
          logo_url?: string | null
          name?: string
          participants?: Json
          signature_url?: string | null
          signer_basis?: string
          signer_name?: string
          signer_title?: string
          sort_order?: number
          stamp_url?: string | null
          updated_at?: string
          vat_as_line?: boolean
          vat_mode?: string
          vat_note?: string
          vat_rate?: number
        }
        Relationships: []
      }
      demand_events: {
        Row: {
          created_at: string
          entity_id: string
          entity_type: string
          event: string
          id: string
          weight: number
        }
        Insert: {
          created_at?: string
          entity_id: string
          entity_type: string
          event: string
          id?: string
          weight?: number
        }
        Update: {
          created_at?: string
          entity_id?: string
          entity_type?: string
          event?: string
          id?: string
          weight?: number
        }
        Relationships: []
      }
      dj_categories: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          hidden: boolean
          icon: string | null
          id: string
          name: string
          section: string
          slug: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          hidden?: boolean
          icon?: string | null
          id?: string
          name: string
          section: string
          slug: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          hidden?: boolean
          icon?: string | null
          id?: string
          name?: string
          section?: string
          slug?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      dj_downloads: {
        Row: {
          created_at: string
          id: string
          target_id: string
          target_type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          target_id: string
          target_type: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          target_id?: string
          target_type?: string
          user_id?: string
        }
        Relationships: []
      }
      dj_favorites: {
        Row: {
          created_at: string
          id: string
          track_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          track_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          track_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dj_favorites_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "dj_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      dj_members: {
        Row: {
          admin_note: string | null
          approved_at: string | null
          bio: string | null
          city: string | null
          contact: string | null
          created_at: string
          id: string
          nickname: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_note?: string | null
          approved_at?: string | null
          bio?: string | null
          city?: string | null
          contact?: string | null
          created_at?: string
          id?: string
          nickname: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_note?: string | null
          approved_at?: string | null
          bio?: string | null
          city?: string | null
          contact?: string | null
          created_at?: string
          id?: string
          nickname?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      dj_playlist_items: {
        Row: {
          created_at: string
          id: string
          playlist_id: string
          position: number
          track_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          playlist_id: string
          position?: number
          track_id: string
        }
        Update: {
          created_at?: string
          id?: string
          playlist_id?: string
          position?: number
          track_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dj_playlist_items_playlist_id_fkey"
            columns: ["playlist_id"]
            isOneToOne: false
            referencedRelation: "dj_playlists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dj_playlist_items_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "dj_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      dj_playlists: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_public: boolean
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_public?: boolean
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      dj_ratings: {
        Row: {
          created_at: string
          id: string
          track_id: string
          updated_at: string
          user_id: string
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          track_id: string
          updated_at?: string
          user_id: string
          value: number
        }
        Update: {
          created_at?: string
          id?: string
          track_id?: string
          updated_at?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "dj_ratings_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "dj_tracks"
            referencedColumns: ["id"]
          },
        ]
      }
      dj_software: {
        Row: {
          category: string
          category_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          icon_path: string | null
          id: string
          instructions: string | null
          name: string
          platforms: string[]
          slug: string
          status: string
          updated_at: string
          vendor: string | null
          website: string | null
        }
        Insert: {
          category?: string
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon_path?: string | null
          id?: string
          instructions?: string | null
          name: string
          platforms?: string[]
          slug: string
          status?: string
          updated_at?: string
          vendor?: string | null
          website?: string | null
        }
        Update: {
          category?: string
          category_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          icon_path?: string | null
          id?: string
          instructions?: string | null
          name?: string
          platforms?: string[]
          slug?: string
          status?: string
          updated_at?: string
          vendor?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "dj_software_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "dj_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      dj_software_versions: {
        Row: {
          arch: string | null
          build_name: string | null
          changelog: string | null
          content_hash: string | null
          created_at: string
          created_by: string | null
          download_count: number
          external_url: string | null
          file_path: string | null
          file_size: number | null
          id: string
          platform: string
          release_date: string | null
          software_id: string
          status: string
          updated_at: string
          version: string
        }
        Insert: {
          arch?: string | null
          build_name?: string | null
          changelog?: string | null
          content_hash?: string | null
          created_at?: string
          created_by?: string | null
          download_count?: number
          external_url?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          platform?: string
          release_date?: string | null
          software_id: string
          status?: string
          updated_at?: string
          version: string
        }
        Update: {
          arch?: string | null
          build_name?: string | null
          changelog?: string | null
          content_hash?: string | null
          created_at?: string
          created_by?: string | null
          download_count?: number
          external_url?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          platform?: string
          release_date?: string | null
          software_id?: string
          status?: string
          updated_at?: string
          version?: string
        }
        Relationships: [
          {
            foreignKeyName: "dj_software_versions_software_id_fkey"
            columns: ["software_id"]
            isOneToOne: false
            referencedRelation: "dj_software"
            referencedColumns: ["id"]
          },
        ]
      }
      dj_tracks: {
        Row: {
          album: string | null
          artist: string
          artwork_path: string | null
          audio_path: string
          bitrate_kbps: number | null
          bpm: number | null
          category_id: string | null
          content_hash: string | null
          cover_palette: string | null
          cover_spec_version: number
          created_at: string
          dedupe_key: string | null
          download_count: number
          duration_sec: number | null
          energy: number | null
          file_size: number | null
          format: string | null
          genre: string | null
          id: string
          key_camelot: string | null
          language: string | null
          play_count: number
          published_at: string | null
          rating_avg: number
          rating_count: number
          reject_reason: string | null
          section: string
          source_filename: string | null
          status: string
          tags: string[]
          title: string
          updated_at: string
          uploaded_by: string | null
          version: string
          waveform: Json | null
          work_key: string | null
          year: number | null
        }
        Insert: {
          album?: string | null
          artist: string
          artwork_path?: string | null
          audio_path: string
          bitrate_kbps?: number | null
          bpm?: number | null
          category_id?: string | null
          content_hash?: string | null
          cover_palette?: string | null
          cover_spec_version?: number
          created_at?: string
          dedupe_key?: string | null
          download_count?: number
          duration_sec?: number | null
          energy?: number | null
          file_size?: number | null
          format?: string | null
          genre?: string | null
          id?: string
          key_camelot?: string | null
          language?: string | null
          play_count?: number
          published_at?: string | null
          rating_avg?: number
          rating_count?: number
          reject_reason?: string | null
          section?: string
          source_filename?: string | null
          status?: string
          tags?: string[]
          title: string
          updated_at?: string
          uploaded_by?: string | null
          version?: string
          waveform?: Json | null
          work_key?: string | null
          year?: number | null
        }
        Update: {
          album?: string | null
          artist?: string
          artwork_path?: string | null
          audio_path?: string
          bitrate_kbps?: number | null
          bpm?: number | null
          category_id?: string | null
          content_hash?: string | null
          cover_palette?: string | null
          cover_spec_version?: number
          created_at?: string
          dedupe_key?: string | null
          download_count?: number
          duration_sec?: number | null
          energy?: number | null
          file_size?: number | null
          format?: string | null
          genre?: string | null
          id?: string
          key_camelot?: string | null
          language?: string | null
          play_count?: number
          published_at?: string | null
          rating_avg?: number
          rating_count?: number
          reject_reason?: string | null
          section?: string
          source_filename?: string | null
          status?: string
          tags?: string[]
          title?: string
          updated_at?: string
          uploaded_by?: string | null
          version?: string
          waveform?: Json | null
          work_key?: string | null
          year?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "dj_tracks_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "dj_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      doc_contacts: {
        Row: {
          address: string
          company: string
          contact_role: string
          created_at: string
          email: string
          id: string
          last_used_at: string
          match_key: string
          name: string
          phone: string
          unp: string
          updated_at: string
          usage_count: number
        }
        Insert: {
          address?: string
          company?: string
          contact_role?: string
          created_at?: string
          email?: string
          id?: string
          last_used_at?: string
          match_key: string
          name?: string
          phone?: string
          unp?: string
          updated_at?: string
          usage_count?: number
        }
        Update: {
          address?: string
          company?: string
          contact_role?: string
          created_at?: string
          email?: string
          id?: string
          last_used_at?: string
          match_key?: string
          name?: string
          phone?: string
          unp?: string
          updated_at?: string
          usage_count?: number
        }
        Relationships: []
      }
      doc_item_catalog: {
        Row: {
          cost: number
          created_at: string
          description: string
          id: string
          includes: Json
          last_used_at: string
          match_key: string
          price: number
          section: string
          title: string
          unit: string
          updated_at: string
          usage_count: number
        }
        Insert: {
          cost?: number
          created_at?: string
          description?: string
          id?: string
          includes?: Json
          last_used_at?: string
          match_key: string
          price?: number
          section?: string
          title: string
          unit?: string
          updated_at?: string
          usage_count?: number
        }
        Update: {
          cost?: number
          created_at?: string
          description?: string
          id?: string
          includes?: Json
          last_used_at?: string
          match_key?: string
          price?: number
          section?: string
          title?: string
          unit?: string
          updated_at?: string
          usage_count?: number
        }
        Relationships: []
      }
      doc_snippets: {
        Row: {
          block_type: string
          condition: string
          content: string
          created_at: string
          created_by: string | null
          description: string
          doc_type: string
          id: string
          items: Json
          name: string
          section: string
          sort_order: number
          title: string
          updated_at: string
        }
        Insert: {
          block_type?: string
          condition?: string
          content?: string
          created_at?: string
          created_by?: string | null
          description?: string
          doc_type?: string
          id?: string
          items?: Json
          name: string
          section?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Update: {
          block_type?: string
          condition?: string
          content?: string
          created_at?: string
          created_by?: string | null
          description?: string
          doc_type?: string
          id?: string
          items?: Json
          name?: string
          section?: string
          sort_order?: number
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      doc_text_snippets: {
        Row: {
          created_at: string
          id: string
          kind: string
          last_used_at: string
          match_key: string
          updated_at: string
          usage_count: number
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          last_used_at?: string
          match_key: string
          updated_at?: string
          usage_count?: number
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          last_used_at?: string
          match_key?: string
          updated_at?: string
          usage_count?: number
          value?: string
        }
        Relationships: []
      }
      document_settings: {
        Row: {
          accent_color: string
          act_footer: string
          act_intro: string
          act_validity_days: number
          agency_fee_type: string
          agency_fee_value: number
          bank_account: string
          bank_bic: string
          bank_name: string
          company_address: string
          company_brand: string
          company_email: string
          company_legal_name: string
          company_phone: string
          company_unp: string
          company_website: string
          contract_cancel_days: number
          contract_jurisdiction_city: string
          contract_late_fee_pct: number
          contract_prepayment_days: number
          contract_prepayment_pct: number
          contract_sections: Json
          font_family: string
          invoice_footer: string
          invoice_validity_days: number
          logo_layout: Json
          logo_url: string | null
          management_type: string
          management_value: number
          quote_footer: string
          quote_print_presets: Json
          quote_validity_days: number
          signer_basis: string
          signer_name: string
          signer_title: string
          singleton: boolean
          updated_at: string
          updated_by: string | null
          vat_as_line: boolean
          vat_mode: string
          vat_note: string
          vat_rate: number
        }
        Insert: {
          accent_color?: string
          act_footer?: string
          act_intro?: string
          act_validity_days?: number
          agency_fee_type?: string
          agency_fee_value?: number
          bank_account?: string
          bank_bic?: string
          bank_name?: string
          company_address?: string
          company_brand?: string
          company_email?: string
          company_legal_name?: string
          company_phone?: string
          company_unp?: string
          company_website?: string
          contract_cancel_days?: number
          contract_jurisdiction_city?: string
          contract_late_fee_pct?: number
          contract_prepayment_days?: number
          contract_prepayment_pct?: number
          contract_sections?: Json
          font_family?: string
          invoice_footer?: string
          invoice_validity_days?: number
          logo_layout?: Json
          logo_url?: string | null
          management_type?: string
          management_value?: number
          quote_footer?: string
          quote_print_presets?: Json
          quote_validity_days?: number
          signer_basis?: string
          signer_name?: string
          signer_title?: string
          singleton?: boolean
          updated_at?: string
          updated_by?: string | null
          vat_as_line?: boolean
          vat_mode?: string
          vat_note?: string
          vat_rate?: number
        }
        Update: {
          accent_color?: string
          act_footer?: string
          act_intro?: string
          act_validity_days?: number
          agency_fee_type?: string
          agency_fee_value?: number
          bank_account?: string
          bank_bic?: string
          bank_name?: string
          company_address?: string
          company_brand?: string
          company_email?: string
          company_legal_name?: string
          company_phone?: string
          company_unp?: string
          company_website?: string
          contract_cancel_days?: number
          contract_jurisdiction_city?: string
          contract_late_fee_pct?: number
          contract_prepayment_days?: number
          contract_prepayment_pct?: number
          contract_sections?: Json
          font_family?: string
          invoice_footer?: string
          invoice_validity_days?: number
          logo_layout?: Json
          logo_url?: string | null
          management_type?: string
          management_value?: number
          quote_footer?: string
          quote_print_presets?: Json
          quote_validity_days?: number
          signer_basis?: string
          signer_name?: string
          signer_title?: string
          singleton?: boolean
          updated_at?: string
          updated_by?: string | null
          vat_as_line?: boolean
          vat_mode?: string
          vat_note?: string
          vat_rate?: number
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_senders: {
        Row: {
          from_email: string
          from_name: string
          inherit_default: boolean
          kind: string
          reply_to: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          from_email?: string
          from_name?: string
          inherit_default?: boolean
          kind: string
          reply_to?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          from_email?: string
          from_name?: string
          inherit_default?: boolean
          kind?: string
          reply_to?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          category: string
          created_at: string
          enabled: boolean
          html_body: string
          preheader: string
          subject: string
          template_key: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category: string
          created_at?: string
          enabled?: boolean
          html_body?: string
          preheader?: string
          subject?: string
          template_key: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          enabled?: boolean
          html_body?: string
          preheader?: string
          subject?: string
          template_key?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
      }
      estimate_template_items: {
        Row: {
          cost: number
          created_at: string
          exclude_from_commission: boolean
          group_key: string
          id: string
          included: boolean
          includes: Json
          is_info: boolean
          multiplier: number
          note: string
          price: number
          qty: number
          qty_unit: string
          rate_qty: number
          rate_unit: string
          section: string
          sort_order: number
          template_id: string
          title: string
          unit: string
        }
        Insert: {
          cost?: number
          created_at?: string
          exclude_from_commission?: boolean
          group_key?: string
          id?: string
          included?: boolean
          includes?: Json
          is_info?: boolean
          multiplier?: number
          note?: string
          price?: number
          qty?: number
          qty_unit?: string
          rate_qty?: number
          rate_unit?: string
          section?: string
          sort_order?: number
          template_id: string
          title?: string
          unit?: string
        }
        Update: {
          cost?: number
          created_at?: string
          exclude_from_commission?: boolean
          group_key?: string
          id?: string
          included?: boolean
          includes?: Json
          is_info?: boolean
          multiplier?: number
          note?: string
          price?: number
          qty?: number
          qty_unit?: string
          rate_qty?: number
          rate_unit?: string
          section?: string
          sort_order?: number
          template_id?: string
          title?: string
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "estimate_template_items_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "estimate_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      estimate_templates: {
        Row: {
          active: boolean
          created_at: string
          created_by: string | null
          description: string
          id: string
          kind: string
          name: string
          settings: Json
          strict: boolean
          updated_at: string
          version: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          kind?: string
          name: string
          settings?: Json
          strict?: boolean
          updated_at?: string
          version?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          kind?: string
          name?: string
          settings?: Json
          strict?: boolean
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      finance_documents: {
        Row: {
          client_address: string
          client_company: string
          client_email: string
          client_name: string
          client_phone: string
          client_unp: string
          company_id: string | null
          created_at: string
          created_by: string | null
          doc_date: string
          doc_number: string | null
          due_date: string | null
          event_date: string | null
          id: string
          items: Json
          kind: string
          notes: string
          order_id: string | null
          paid: number
          quote_id: string | null
          status: string
          total: number
          updated_at: string
          versions: Json
        }
        Insert: {
          client_address?: string
          client_company?: string
          client_email?: string
          client_name?: string
          client_phone?: string
          client_unp?: string
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          doc_date?: string
          doc_number?: string | null
          due_date?: string | null
          event_date?: string | null
          id?: string
          items?: Json
          kind: string
          notes?: string
          order_id?: string | null
          paid?: number
          quote_id?: string | null
          status?: string
          total?: number
          updated_at?: string
          versions?: Json
        }
        Update: {
          client_address?: string
          client_company?: string
          client_email?: string
          client_name?: string
          client_phone?: string
          client_unp?: string
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          doc_date?: string
          doc_number?: string | null
          due_date?: string | null
          event_date?: string | null
          id?: string
          items?: Json
          kind?: string
          notes?: string
          order_id?: string | null
          paid?: number
          quote_id?: string | null
          status?: string
          total?: number
          updated_at?: string
          versions?: Json
        }
        Relationships: [
          {
            foreignKeyName: "finance_documents_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_documents_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_documents_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      hr_employees: {
        Row: {
          company_profile_id: string | null
          created_at: string
          fired_on: string | null
          full_name: string
          hired_on: string | null
          id: string
          is_active: boolean
          notes: string
          position: string
          position_code: string
          raise_pct: number
          rate: number
          short_name: string
          sort_order: number
          tab_number: string
          tariff: number
          unit: string
          updated_at: string
        }
        Insert: {
          company_profile_id?: string | null
          created_at?: string
          fired_on?: string | null
          full_name: string
          hired_on?: string | null
          id?: string
          is_active?: boolean
          notes?: string
          position?: string
          position_code?: string
          raise_pct?: number
          rate?: number
          short_name?: string
          sort_order?: number
          tab_number?: string
          tariff?: number
          unit?: string
          updated_at?: string
        }
        Update: {
          company_profile_id?: string | null
          created_at?: string
          fired_on?: string | null
          full_name?: string
          hired_on?: string | null
          id?: string
          is_active?: boolean
          notes?: string
          position?: string
          position_code?: string
          raise_pct?: number
          rate?: number
          short_name?: string
          sort_order?: number
          tab_number?: string
          tariff?: number
          unit?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "hr_employees_company_profile_id_fkey"
            columns: ["company_profile_id"]
            isOneToOne: false
            referencedRelation: "company_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mail_account_checks: {
        Row: {
          account_id: string
          checked_by: string | null
          created_at: string
          details: Json | null
          duration_ms: number | null
          id: string
          message: string | null
          ok: boolean
          status_code: number | null
        }
        Insert: {
          account_id: string
          checked_by?: string | null
          created_at?: string
          details?: Json | null
          duration_ms?: number | null
          id?: string
          message?: string | null
          ok: boolean
          status_code?: number | null
        }
        Update: {
          account_id?: string
          checked_by?: string | null
          created_at?: string
          details?: Json | null
          duration_ms?: number | null
          id?: string
          message?: string | null
          ok?: boolean
          status_code?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "mail_account_checks_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "mail_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      mail_accounts: {
        Row: {
          created_at: string
          display_name: string | null
          email: string
          id: string
          imap_host: string | null
          imap_port: number
          imap_secure: boolean
          last_sync_at: string | null
          last_sync_cursor: string | null
          owner_id: string
          password_encrypted: string | null
          provider: string
          smtp_host: string | null
          smtp_port: number
          smtp_secure: boolean
          status: string
          sync_error: string | null
          updated_at: string
          username: string | null
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email: string
          id?: string
          imap_host?: string | null
          imap_port?: number
          imap_secure?: boolean
          last_sync_at?: string | null
          last_sync_cursor?: string | null
          owner_id: string
          password_encrypted?: string | null
          provider?: string
          smtp_host?: string | null
          smtp_port?: number
          smtp_secure?: boolean
          status?: string
          sync_error?: string | null
          updated_at?: string
          username?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string
          id?: string
          imap_host?: string | null
          imap_port?: number
          imap_secure?: boolean
          last_sync_at?: string | null
          last_sync_cursor?: string | null
          owner_id?: string
          password_encrypted?: string | null
          provider?: string
          smtp_host?: string | null
          smtp_port?: number
          smtp_secure?: boolean
          status?: string
          sync_error?: string | null
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      mail_attachments: {
        Row: {
          content_id: string | null
          created_at: string
          filename: string
          id: string
          is_inline: boolean
          message_id: string
          mime_type: string | null
          remote_id: string | null
          size_bytes: number | null
          storage_path: string | null
        }
        Insert: {
          content_id?: string | null
          created_at?: string
          filename: string
          id?: string
          is_inline?: boolean
          message_id: string
          mime_type?: string | null
          remote_id?: string | null
          size_bytes?: number | null
          storage_path?: string | null
        }
        Update: {
          content_id?: string | null
          created_at?: string
          filename?: string
          id?: string
          is_inline?: boolean
          message_id?: string
          mime_type?: string | null
          remote_id?: string | null
          size_bytes?: number | null
          storage_path?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mail_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "mail_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      mail_drafts: {
        Row: {
          account_id: string
          attachments: Json
          bcc_addrs: Json
          body_html: string | null
          cc_addrs: Json
          created_at: string
          id: string
          in_reply_to: string | null
          owner_id: string
          remote_id: string | null
          reply_to_message_id: string | null
          subject: string | null
          to_addrs: Json
          updated_at: string
        }
        Insert: {
          account_id: string
          attachments?: Json
          bcc_addrs?: Json
          body_html?: string | null
          cc_addrs?: Json
          created_at?: string
          id?: string
          in_reply_to?: string | null
          owner_id: string
          remote_id?: string | null
          reply_to_message_id?: string | null
          subject?: string | null
          to_addrs?: Json
          updated_at?: string
        }
        Update: {
          account_id?: string
          attachments?: Json
          bcc_addrs?: Json
          body_html?: string | null
          cc_addrs?: Json
          created_at?: string
          id?: string
          in_reply_to?: string | null
          owner_id?: string
          remote_id?: string | null
          reply_to_message_id?: string | null
          subject?: string | null
          to_addrs?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mail_drafts_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "mail_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mail_drafts_reply_to_message_id_fkey"
            columns: ["reply_to_message_id"]
            isOneToOne: false
            referencedRelation: "mail_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      mail_folders: {
        Row: {
          account_id: string
          created_at: string
          id: string
          kind: string
          name: string
          parent_id: string | null
          remote_id: string
          total_count: number
          uidnext: number | null
          uidvalidity: number | null
          unread_count: number
          updated_at: string
        }
        Insert: {
          account_id: string
          created_at?: string
          id?: string
          kind?: string
          name: string
          parent_id?: string | null
          remote_id: string
          total_count?: number
          uidnext?: number | null
          uidvalidity?: number | null
          unread_count?: number
          updated_at?: string
        }
        Update: {
          account_id?: string
          created_at?: string
          id?: string
          kind?: string
          name?: string
          parent_id?: string | null
          remote_id?: string
          total_count?: number
          uidnext?: number | null
          uidvalidity?: number | null
          unread_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mail_folders_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "mail_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mail_folders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "mail_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      mail_messages: {
        Row: {
          account_id: string
          bcc_addrs: Json
          body_html: string | null
          body_text: string | null
          cc_addrs: Json
          created_at: string
          flags: string[]
          folder_id: string | null
          from_addr: string | null
          from_name: string | null
          has_attachments: boolean
          id: string
          imap_uid: number | null
          raw_headers: Json | null
          received_at: string
          remote_id: string
          remote_thread_id: string | null
          reply_to: Json
          seen: boolean
          sent_at: string | null
          size_bytes: number | null
          snippet: string | null
          starred: boolean
          subject: string | null
          to_addrs: Json
          updated_at: string
        }
        Insert: {
          account_id: string
          bcc_addrs?: Json
          body_html?: string | null
          body_text?: string | null
          cc_addrs?: Json
          created_at?: string
          flags?: string[]
          folder_id?: string | null
          from_addr?: string | null
          from_name?: string | null
          has_attachments?: boolean
          id?: string
          imap_uid?: number | null
          raw_headers?: Json | null
          received_at?: string
          remote_id: string
          remote_thread_id?: string | null
          reply_to?: Json
          seen?: boolean
          sent_at?: string | null
          size_bytes?: number | null
          snippet?: string | null
          starred?: boolean
          subject?: string | null
          to_addrs?: Json
          updated_at?: string
        }
        Update: {
          account_id?: string
          bcc_addrs?: Json
          body_html?: string | null
          body_text?: string | null
          cc_addrs?: Json
          created_at?: string
          flags?: string[]
          folder_id?: string | null
          from_addr?: string | null
          from_name?: string | null
          has_attachments?: boolean
          id?: string
          imap_uid?: number | null
          raw_headers?: Json | null
          received_at?: string
          remote_id?: string
          remote_thread_id?: string | null
          reply_to?: Json
          seen?: boolean
          sent_at?: string | null
          size_bytes?: number | null
          snippet?: string | null
          starred?: boolean
          subject?: string | null
          to_addrs?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mail_messages_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "mail_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mail_messages_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "mail_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      mail_rules: {
        Row: {
          account_id: string
          action: Json
          conditions: Json
          created_at: string
          enabled: boolean
          id: string
          name: string
          priority: number
          updated_at: string
        }
        Insert: {
          account_id: string
          action?: Json
          conditions?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          name: string
          priority?: number
          updated_at?: string
        }
        Update: {
          account_id?: string
          action?: Json
          conditions?: Json
          created_at?: string
          enabled?: boolean
          id?: string
          name?: string
          priority?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "mail_rules_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "mail_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      marketing_logs: {
        Row: {
          campaign_id: string | null
          created_at: string
          event: string
          id: string
          payload: Json | null
        }
        Insert: {
          campaign_id?: string | null
          created_at?: string
          event: string
          id?: string
          payload?: Json | null
        }
        Update: {
          campaign_id?: string | null
          created_at?: string
          event?: string
          id?: string
          payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "marketing_logs_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      order_attachments: {
        Row: {
          created_at: string
          created_by: string | null
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          kind: string
          mime_type: string | null
          order_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          kind: string
          mime_type?: string | null
          order_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          kind?: string
          mime_type?: string | null
          order_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_attachments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_items: {
        Row: {
          created_at: string
          end_date: string | null
          entity_id: string | null
          entity_type: string
          id: string
          meta: Json | null
          order_id: string
          price: number
          qty: number
          start_date: string | null
          title: string
        }
        Insert: {
          created_at?: string
          end_date?: string | null
          entity_id?: string | null
          entity_type: string
          id?: string
          meta?: Json | null
          order_id: string
          price?: number
          qty?: number
          start_date?: string | null
          title: string
        }
        Update: {
          created_at?: string
          end_date?: string | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          meta?: Json | null
          order_id?: string
          price?: number
          qty?: number
          start_date?: string | null
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      order_timeline: {
        Row: {
          actor_id: string | null
          created_at: string
          event: string
          id: string
          order_id: string
          payload: Json | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event: string
          id?: string
          order_id: string
          payload?: Json | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event?: string
          id?: string
          order_id?: string
          payload?: Json | null
        }
        Relationships: [
          {
            foreignKeyName: "order_timeline_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          clarification_token: string | null
          client_company: string | null
          client_email: string
          client_name: string
          client_phone: string
          created_at: string
          event_date: string | null
          id: string
          internal_notes: string | null
          manager_id: string | null
          notes: string | null
          order_number: string | null
          paid: number | null
          source: string | null
          status: Database["public"]["Enums"]["order_status"]
          total: number | null
          updated_at: string
          user_id: string | null
          utm_campaign: string | null
          utm_content: string | null
          utm_medium: string | null
          utm_source: string | null
          utm_term: string | null
        }
        Insert: {
          clarification_token?: string | null
          client_company?: string | null
          client_email: string
          client_name: string
          client_phone: string
          created_at?: string
          event_date?: string | null
          id?: string
          internal_notes?: string | null
          manager_id?: string | null
          notes?: string | null
          order_number?: string | null
          paid?: number | null
          source?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          total?: number | null
          updated_at?: string
          user_id?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Update: {
          clarification_token?: string | null
          client_company?: string | null
          client_email?: string
          client_name?: string
          client_phone?: string
          created_at?: string
          event_date?: string | null
          id?: string
          internal_notes?: string | null
          manager_id?: string | null
          notes?: string | null
          order_number?: string | null
          paid?: number | null
          source?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          total?: number | null
          updated_at?: string
          user_id?: string | null
          utm_campaign?: string | null
          utm_content?: string | null
          utm_medium?: string | null
          utm_source?: string | null
          utm_term?: string | null
        }
        Relationships: []
      }
      paperwork_brand_blanks: {
        Row: {
          company_profile_id: string
          created_at: string
          id: string
          settings: Json
          updated_at: string
        }
        Insert: {
          company_profile_id: string
          created_at?: string
          id?: string
          settings?: Json
          updated_at?: string
        }
        Update: {
          company_profile_id?: string
          created_at?: string
          id?: string
          settings?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "paperwork_brand_blanks_company_profile_id_fkey"
            columns: ["company_profile_id"]
            isOneToOne: true
            referencedRelation: "company_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      paperwork_brand_kits: {
        Row: {
          company_profile_id: string
          created_at: string
          id: string
          is_default: boolean
          name: string
          settings: Json
          updated_at: string
        }
        Insert: {
          company_profile_id: string
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          settings?: Json
          updated_at?: string
        }
        Update: {
          company_profile_id?: string
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          settings?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "paperwork_brand_kits_company_profile_id_fkey"
            columns: ["company_profile_id"]
            isOneToOne: false
            referencedRelation: "company_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      paperwork_documents: {
        Row: {
          author_id: string | null
          blocks: Json
          brand_kit_id: string | null
          company_profile_id: string | null
          created_at: string
          doc_date: string
          doc_number: string
          doc_type: string
          employee_id: string | null
          id: string
          order_journal: string | null
          order_kind: string | null
          order_year: number | null
          source_file: string | null
          source_path: string | null
          status: string
          template_id: string | null
          template_revision: number | null
          title: string
          updated_at: string
          values: Json
        }
        Insert: {
          author_id?: string | null
          blocks?: Json
          brand_kit_id?: string | null
          company_profile_id?: string | null
          created_at?: string
          doc_date?: string
          doc_number?: string
          doc_type?: string
          employee_id?: string | null
          id?: string
          order_journal?: string | null
          order_kind?: string | null
          order_year?: number | null
          source_file?: string | null
          source_path?: string | null
          status?: string
          template_id?: string | null
          template_revision?: number | null
          title?: string
          updated_at?: string
          values?: Json
        }
        Update: {
          author_id?: string | null
          blocks?: Json
          brand_kit_id?: string | null
          company_profile_id?: string | null
          created_at?: string
          doc_date?: string
          doc_number?: string
          doc_type?: string
          employee_id?: string | null
          id?: string
          order_journal?: string | null
          order_kind?: string | null
          order_year?: number | null
          source_file?: string | null
          source_path?: string | null
          status?: string
          template_id?: string | null
          template_revision?: number | null
          title?: string
          updated_at?: string
          values?: Json
        }
        Relationships: [
          {
            foreignKeyName: "paperwork_documents_brand_kit_id_fkey"
            columns: ["brand_kit_id"]
            isOneToOne: false
            referencedRelation: "paperwork_brand_kits"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paperwork_documents_company_profile_id_fkey"
            columns: ["company_profile_id"]
            isOneToOne: false
            referencedRelation: "company_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paperwork_documents_employee_id_fkey"
            columns: ["employee_id"]
            isOneToOne: false
            referencedRelation: "hr_employees"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "paperwork_documents_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "paperwork_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      paperwork_templates: {
        Row: {
          background_url: string | null
          blocks: Json
          category: string
          company_profile_id: string | null
          created_at: string
          created_by: string | null
          description: string
          doc_type: string
          id: string
          is_archived: boolean
          is_favorite: boolean
          name: string
          revision: number
          updated_at: string
          variables: Json
          variables_schema: Json
        }
        Insert: {
          background_url?: string | null
          blocks?: Json
          category?: string
          company_profile_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          doc_type?: string
          id?: string
          is_archived?: boolean
          is_favorite?: boolean
          name?: string
          revision?: number
          updated_at?: string
          variables?: Json
          variables_schema?: Json
        }
        Update: {
          background_url?: string | null
          blocks?: Json
          category?: string
          company_profile_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          doc_type?: string
          id?: string
          is_archived?: boolean
          is_favorite?: boolean
          name?: string
          revision?: number
          updated_at?: string
          variables?: Json
          variables_schema?: Json
        }
        Relationships: [
          {
            foreignKeyName: "paperwork_templates_company_profile_id_fkey"
            columns: ["company_profile_id"]
            isOneToOne: false
            referencedRelation: "company_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      presentation_brand_kits: {
        Row: {
          accent: string
          angle: number
          created_at: string
          created_by: string | null
          font: string
          frame: string
          id: string
          is_default: boolean
          logo_url: string | null
          name: string
          stops: Json
          updated_at: string
        }
        Insert: {
          accent?: string
          angle?: number
          created_at?: string
          created_by?: string | null
          font?: string
          frame?: string
          id?: string
          is_default?: boolean
          logo_url?: string | null
          name: string
          stops?: Json
          updated_at?: string
        }
        Update: {
          accent?: string
          angle?: number
          created_at?: string
          created_by?: string | null
          font?: string
          frame?: string
          id?: string
          is_default?: boolean
          logo_url?: string | null
          name?: string
          stops?: Json
          updated_at?: string
        }
        Relationships: []
      }
      presentation_slides: {
        Row: {
          content_json: Json
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          image_url: string | null
          is_visible: boolean
          position: number
          presentation_id: string
          quote_item_id: string | null
          subtitle: string
          title: string
          type: string
          updated_at: string
        }
        Insert: {
          content_json?: Json
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          image_url?: string | null
          is_visible?: boolean
          position?: number
          presentation_id: string
          quote_item_id?: string | null
          subtitle?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Update: {
          content_json?: Json
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          image_url?: string | null
          is_visible?: boolean
          position?: number
          presentation_id?: string
          quote_item_id?: string | null
          subtitle?: string
          title?: string
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "presentation_slides_presentation_id_fkey"
            columns: ["presentation_id"]
            isOneToOne: false
            referencedRelation: "presentations"
            referencedColumns: ["id"]
          },
        ]
      }
      presentation_versions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          label: string
          presentation_id: string
          snapshot: Json
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string
          presentation_id: string
          snapshot?: Json
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string
          presentation_id?: string
          snapshot?: Json
        }
        Relationships: [
          {
            foreignKeyName: "presentation_versions_presentation_id_fkey"
            columns: ["presentation_id"]
            isOneToOne: false
            referencedRelation: "presentations"
            referencedColumns: ["id"]
          },
        ]
      }
      presentations: {
        Row: {
          brand_kit: Json | null
          client_logo_url: string | null
          company_id: string | null
          created_at: string
          created_by: string | null
          font_family: string
          id: string
          logo_layout: Json
          logo_url: string | null
          public_token: string
          quote_id: string | null
          share_enabled: boolean
          status: string
          template: string
          title: string
          updated_at: string
          viewed_at: string | null
        }
        Insert: {
          brand_kit?: Json | null
          client_logo_url?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          font_family?: string
          id?: string
          logo_layout?: Json
          logo_url?: string | null
          public_token?: string
          quote_id?: string | null
          share_enabled?: boolean
          status?: string
          template?: string
          title?: string
          updated_at?: string
          viewed_at?: string | null
        }
        Update: {
          brand_kit?: Json | null
          client_logo_url?: string | null
          company_id?: string | null
          created_at?: string
          created_by?: string | null
          font_family?: string
          id?: string
          logo_layout?: Json
          logo_url?: string | null
          public_token?: string
          quote_id?: string | null
          share_enabled?: boolean
          status?: string
          template?: string
          title?: string
          updated_at?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "presentations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "presentations_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      production_items: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          extras: Json
          faq: Json | null
          features: Json | null
          id: string
          photo_urls: string[] | null
          pricing: Json | null
          published: boolean
          requirements: string | null
          seo_description: string | null
          seo_title: string | null
          slug: string
          sort_order: number
          title: string
          updated_at: string
          video_urls: string[] | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          extras?: Json
          faq?: Json | null
          features?: Json | null
          id?: string
          photo_urls?: string[] | null
          pricing?: Json | null
          published?: boolean
          requirements?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          sort_order?: number
          title: string
          updated_at?: string
          video_urls?: string[] | null
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          extras?: Json
          faq?: Json | null
          features?: Json | null
          id?: string
          photo_urls?: string[] | null
          pricing?: Json | null
          published?: boolean
          requirements?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          sort_order?: number
          title?: string
          updated_at?: string
          video_urls?: string[] | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          company: string | null
          consent_pd: boolean
          created_at: string
          editor_prefs: Json
          email: string
          full_name: string
          id: string
          phone: string
          updated_at: string
        }
        Insert: {
          company?: string | null
          consent_pd?: boolean
          created_at?: string
          editor_prefs?: Json
          email: string
          full_name: string
          id: string
          phone: string
          updated_at?: string
        }
        Update: {
          company?: string | null
          consent_pd?: boolean
          created_at?: string
          editor_prefs?: Json
          email?: string
          full_name?: string
          id?: string
          phone?: string
          updated_at?: string
        }
        Relationships: []
      }
      promo_codes: {
        Row: {
          active: boolean
          code: string
          created_at: string
          description: string | null
          discount_type: string
          discount_value: number
          id: string
          max_uses: number | null
          min_order_total: number
          sort_order: number
          updated_at: string
          used_count: number
          valid_from: string | null
          valid_to: string | null
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          description?: string | null
          discount_type: string
          discount_value: number
          id?: string
          max_uses?: number | null
          min_order_total?: number
          sort_order?: number
          updated_at?: string
          used_count?: number
          valid_from?: string | null
          valid_to?: string | null
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          description?: string | null
          discount_type?: string
          discount_value?: number
          id?: string
          max_uses?: number | null
          min_order_total?: number
          sort_order?: number
          updated_at?: string
          used_count?: number
          valid_from?: string | null
          valid_to?: string | null
        }
        Relationships: []
      }
      promo_quote_items: {
        Row: {
          cost: number
          cost_input: number
          cost_mode: string
          created_at: string
          exclude_from_commission: boolean
          group_key: string
          id: string
          included: boolean
          includes: Json
          is_info: boolean
          multiplier: number
          note: string
          price: number
          qty: number
          qty_unit: string
          quote_id: string
          rate_qty: number
          rate_unit: string
          section: string
          sort_order: number
          title: string
          unit: string
        }
        Insert: {
          cost?: number
          cost_input?: number
          cost_mode?: string
          created_at?: string
          exclude_from_commission?: boolean
          group_key?: string
          id?: string
          included?: boolean
          includes?: Json
          is_info?: boolean
          multiplier?: number
          note?: string
          price?: number
          qty?: number
          qty_unit?: string
          quote_id: string
          rate_qty?: number
          rate_unit?: string
          section?: string
          sort_order?: number
          title?: string
          unit?: string
        }
        Update: {
          cost?: number
          cost_input?: number
          cost_mode?: string
          created_at?: string
          exclude_from_commission?: boolean
          group_key?: string
          id?: string
          included?: boolean
          includes?: Json
          is_info?: boolean
          multiplier?: number
          note?: string
          price?: number
          qty?: number
          qty_unit?: string
          quote_id?: string
          rate_qty?: number
          rate_unit?: string
          section?: string
          sort_order?: number
          title?: string
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "promo_quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "promo_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_quote_versions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          label: string
          quote_id: string
          snapshot: Json
          total: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string
          quote_id: string
          snapshot: Json
          total?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string
          quote_id?: string
          snapshot?: Json
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "promo_quote_versions_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "promo_quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      promo_quotes: {
        Row: {
          accent_color: string
          agency_fee_type: string
          agency_fee_value: number
          client_comment: string
          client_logo_url: string | null
          client_name: string
          client_response: string
          commission_enabled: boolean
          commission_label: string
          commission_rate: number
          company_id: string | null
          company_overrides: Json
          contact_email: string
          contact_name: string
          contact_phone: string
          contact_role: string
          created_at: string
          created_by: string | null
          currency: string
          discount_type: string
          discount_value: number
          doc_number: string | null
          font_family: string
          footer_note: string
          id: string
          is_template: boolean
          logo_layout: Json
          logo_url: string | null
          management_amount: number
          management_enabled: boolean
          management_label: string
          management_type: string
          management_value: number
          period: string
          project: string
          public_token: string
          responded_at: string | null
          sent_at: string | null
          sheet_id: string | null
          sheet_snapshot: Json | null
          sheet_synced_at: string | null
          sheet_url: string | null
          show_item_includes: boolean
          show_notes: boolean
          show_qty: boolean
          show_section_subtotals: boolean
          show_total_qty: boolean
          status: string
          template_name: string
          total: number
          updated_at: string
          valid_until: string | null
          vat_as_line: boolean
          vat_enabled: boolean
          vat_mode: string
          vat_rate: number
          venue: string
          viewed_at: string | null
        }
        Insert: {
          accent_color?: string
          agency_fee_type?: string
          agency_fee_value?: number
          client_comment?: string
          client_logo_url?: string | null
          client_name?: string
          client_response?: string
          commission_enabled?: boolean
          commission_label?: string
          commission_rate?: number
          company_id?: string | null
          company_overrides?: Json
          contact_email?: string
          contact_name?: string
          contact_phone?: string
          contact_role?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          discount_type?: string
          discount_value?: number
          doc_number?: string | null
          font_family?: string
          footer_note?: string
          id?: string
          is_template?: boolean
          logo_layout?: Json
          logo_url?: string | null
          management_amount?: number
          management_enabled?: boolean
          management_label?: string
          management_type?: string
          management_value?: number
          period?: string
          project?: string
          public_token?: string
          responded_at?: string | null
          sent_at?: string | null
          sheet_id?: string | null
          sheet_snapshot?: Json | null
          sheet_synced_at?: string | null
          sheet_url?: string | null
          show_item_includes?: boolean
          show_notes?: boolean
          show_qty?: boolean
          show_section_subtotals?: boolean
          show_total_qty?: boolean
          status?: string
          template_name?: string
          total?: number
          updated_at?: string
          valid_until?: string | null
          vat_as_line?: boolean
          vat_enabled?: boolean
          vat_mode?: string
          vat_rate?: number
          venue?: string
          viewed_at?: string | null
        }
        Update: {
          accent_color?: string
          agency_fee_type?: string
          agency_fee_value?: number
          client_comment?: string
          client_logo_url?: string | null
          client_name?: string
          client_response?: string
          commission_enabled?: boolean
          commission_label?: string
          commission_rate?: number
          company_id?: string | null
          company_overrides?: Json
          contact_email?: string
          contact_name?: string
          contact_phone?: string
          contact_role?: string
          created_at?: string
          created_by?: string | null
          currency?: string
          discount_type?: string
          discount_value?: number
          doc_number?: string | null
          font_family?: string
          footer_note?: string
          id?: string
          is_template?: boolean
          logo_layout?: Json
          logo_url?: string | null
          management_amount?: number
          management_enabled?: boolean
          management_label?: string
          management_type?: string
          management_value?: number
          period?: string
          project?: string
          public_token?: string
          responded_at?: string | null
          sent_at?: string | null
          sheet_id?: string | null
          sheet_snapshot?: Json | null
          sheet_synced_at?: string | null
          sheet_url?: string | null
          show_item_includes?: boolean
          show_notes?: boolean
          show_qty?: boolean
          show_section_subtotals?: boolean
          show_total_qty?: boolean
          status?: string
          template_name?: string
          total?: number
          updated_at?: string
          valid_until?: string | null
          vat_as_line?: boolean
          vat_enabled?: boolean
          vat_mode?: string
          vat_rate?: number
          venue?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "promo_quotes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_items: {
        Row: {
          cost: number
          cost_input: number
          cost_mode: string
          created_at: string
          description: string
          entity_id: string | null
          entity_type: string | null
          group_key: string
          id: string
          included: boolean
          includes: Json
          is_info: boolean
          multiplier: number
          price: number
          qty: number
          qty_unit: string
          quote_id: string
          rate_qty: number
          rate_unit: string
          section: string
          sort_order: number
          title: string
          unit: string
        }
        Insert: {
          cost?: number
          cost_input?: number
          cost_mode?: string
          created_at?: string
          description?: string
          entity_id?: string | null
          entity_type?: string | null
          group_key?: string
          id?: string
          included?: boolean
          includes?: Json
          is_info?: boolean
          multiplier?: number
          price?: number
          qty?: number
          qty_unit?: string
          quote_id: string
          rate_qty?: number
          rate_unit?: string
          section?: string
          sort_order?: number
          title?: string
          unit?: string
        }
        Update: {
          cost?: number
          cost_input?: number
          cost_mode?: string
          created_at?: string
          description?: string
          entity_id?: string | null
          entity_type?: string | null
          group_key?: string
          id?: string
          included?: boolean
          includes?: Json
          is_info?: boolean
          multiplier?: number
          price?: number
          qty?: number
          qty_unit?: string
          quote_id?: string
          rate_qty?: number
          rate_unit?: string
          section?: string
          sort_order?: number
          title?: string
          unit?: string
        }
        Relationships: [
          {
            foreignKeyName: "quote_items_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quote_versions: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          label: string
          quote_id: string
          snapshot: Json
          total: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string
          quote_id: string
          snapshot: Json
          total?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          label?: string
          quote_id?: string
          snapshot?: Json
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "quote_versions_quote_id_fkey"
            columns: ["quote_id"]
            isOneToOne: false
            referencedRelation: "quotes"
            referencedColumns: ["id"]
          },
        ]
      }
      quotes: {
        Row: {
          agency_fee_type: string
          agency_fee_value: number
          blocks: Json
          client_address: string
          client_comment: string
          client_company: string
          client_email: string
          client_name: string
          client_phone: string
          client_response: string
          client_unp: string
          company_id: string | null
          company_overrides: Json
          created_at: string
          created_by: string | null
          delivery_amount: number
          design: Json
          discount_type: string
          discount_value: number
          doc_date: string
          event_date: string | null
          event_format: string
          event_notes: string
          event_time_end: string
          event_time_start: string
          font_family: string
          guests_count: number | null
          id: string
          is_template: boolean
          logo_layout: Json
          logo_url: string | null
          management_type: string
          management_value: number
          order_id: string | null
          prepayment_type: string
          prepayment_value: number
          public_token: string
          quote_number: string | null
          responded_at: string | null
          sent_at: string | null
          setup_note: string
          sheet_id: string | null
          sheet_snapshot: Json | null
          sheet_synced_at: string | null
          sheet_url: string | null
          signature_url: string | null
          stamp_url: string | null
          status: string
          template: string
          template_name: string
          texts: Json
          title: string
          total: number
          updated_at: string
          valid_until_override: string | null
          validity_days: number
          vat_as_line: boolean
          vat_mode: string
          vat_note: string
          vat_rate: number
          venue: string
          viewed_at: string | null
        }
        Insert: {
          agency_fee_type?: string
          agency_fee_value?: number
          blocks?: Json
          client_address?: string
          client_comment?: string
          client_company?: string
          client_email?: string
          client_name?: string
          client_phone?: string
          client_response?: string
          client_unp?: string
          company_id?: string | null
          company_overrides?: Json
          created_at?: string
          created_by?: string | null
          delivery_amount?: number
          design?: Json
          discount_type?: string
          discount_value?: number
          doc_date?: string
          event_date?: string | null
          event_format?: string
          event_notes?: string
          event_time_end?: string
          event_time_start?: string
          font_family?: string
          guests_count?: number | null
          id?: string
          is_template?: boolean
          logo_layout?: Json
          logo_url?: string | null
          management_type?: string
          management_value?: number
          order_id?: string | null
          prepayment_type?: string
          prepayment_value?: number
          public_token?: string
          quote_number?: string | null
          responded_at?: string | null
          sent_at?: string | null
          setup_note?: string
          sheet_id?: string | null
          sheet_snapshot?: Json | null
          sheet_synced_at?: string | null
          sheet_url?: string | null
          signature_url?: string | null
          stamp_url?: string | null
          status?: string
          template?: string
          template_name?: string
          texts?: Json
          title?: string
          total?: number
          updated_at?: string
          valid_until_override?: string | null
          validity_days?: number
          vat_as_line?: boolean
          vat_mode?: string
          vat_note?: string
          vat_rate?: number
          venue?: string
          viewed_at?: string | null
        }
        Update: {
          agency_fee_type?: string
          agency_fee_value?: number
          blocks?: Json
          client_address?: string
          client_comment?: string
          client_company?: string
          client_email?: string
          client_name?: string
          client_phone?: string
          client_response?: string
          client_unp?: string
          company_id?: string | null
          company_overrides?: Json
          created_at?: string
          created_by?: string | null
          delivery_amount?: number
          design?: Json
          discount_type?: string
          discount_value?: number
          doc_date?: string
          event_date?: string | null
          event_format?: string
          event_notes?: string
          event_time_end?: string
          event_time_start?: string
          font_family?: string
          guests_count?: number | null
          id?: string
          is_template?: boolean
          logo_layout?: Json
          logo_url?: string | null
          management_type?: string
          management_value?: number
          order_id?: string | null
          prepayment_type?: string
          prepayment_value?: number
          public_token?: string
          quote_number?: string | null
          responded_at?: string | null
          sent_at?: string | null
          setup_note?: string
          sheet_id?: string | null
          sheet_snapshot?: Json | null
          sheet_synced_at?: string | null
          sheet_url?: string | null
          signature_url?: string | null
          stamp_url?: string | null
          status?: string
          template?: string
          template_name?: string
          texts?: Json
          title?: string
          total?: number
          updated_at?: string
          valid_until_override?: string | null
          validity_days?: number
          vat_as_line?: boolean
          vat_mode?: string
          vat_note?: string
          vat_rate?: number
          venue?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "quotes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "company_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quotes_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          extras: Json
          faq: Json | null
          features: Json | null
          id: string
          photo_urls: string[] | null
          pricing: Json | null
          published: boolean
          requirements: string | null
          seo_description: string | null
          seo_title: string | null
          slug: string
          sort_order: number
          title: string
          updated_at: string
          video_urls: string[] | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          extras?: Json
          faq?: Json | null
          features?: Json | null
          id?: string
          photo_urls?: string[] | null
          pricing?: Json | null
          published?: boolean
          requirements?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          sort_order?: number
          title: string
          updated_at?: string
          video_urls?: string[] | null
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          extras?: Json
          faq?: Json | null
          features?: Json | null
          id?: string
          photo_urls?: string[] | null
          pricing?: Json | null
          published?: boolean
          requirements?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          sort_order?: number
          title?: string
          updated_at?: string
          video_urls?: string[] | null
        }
        Relationships: []
      }
      site_sections: {
        Row: {
          enabled: boolean
          key: string
          label: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          enabled?: boolean
          key: string
          label: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          enabled?: boolean
          key?: string
          label?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      site_settings: {
        Row: {
          id: boolean
          instagram_url: string | null
          tiktok_url: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: boolean
          instagram_url?: string | null
          tiktok_url?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: boolean
          instagram_url?: string | null
          tiktok_url?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          sender: string
          telegram_message_id: number | null
          thread_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          sender: string
          telegram_message_id?: number | null
          thread_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          sender?: string
          telegram_message_id?: number | null
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "support_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      support_threads: {
        Row: {
          created_at: string
          id: string
          last_message_at: string
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      tech_equipment: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          extras: Json
          faq: Json | null
          features: Json | null
          id: string
          photo_urls: string[] | null
          pricing: Json | null
          published: boolean
          requirements: string | null
          seo_description: string | null
          seo_title: string | null
          slug: string
          sort_order: number
          title: string
          updated_at: string
          video_urls: string[] | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          extras?: Json
          faq?: Json | null
          features?: Json | null
          id?: string
          photo_urls?: string[] | null
          pricing?: Json | null
          published?: boolean
          requirements?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          sort_order?: number
          title: string
          updated_at?: string
          video_urls?: string[] | null
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          extras?: Json
          faq?: Json | null
          features?: Json | null
          id?: string
          photo_urls?: string[] | null
          pricing?: Json | null
          published?: boolean
          requirements?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          sort_order?: number
          title?: string
          updated_at?: string
          video_urls?: string[] | null
        }
        Relationships: []
      }
      telegram_logs: {
        Row: {
          created_at: string
          error: string | null
          http_code: number | null
          id: string
          order_id: string | null
          payload: Json | null
          retried_at: string | null
          status: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          http_code?: number | null
          id?: string
          order_id?: string | null
          payload?: Json | null
          retried_at?: string | null
          status: string
        }
        Update: {
          created_at?: string
          error?: string | null
          http_code?: number | null
          id?: string
          order_id?: string | null
          payload?: Json | null
          retried_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "telegram_logs_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      testimonials: {
        Row: {
          case_id: string | null
          client_company: string | null
          client_name: string
          client_photo_url: string | null
          client_role: string | null
          created_at: string
          event_date: string | null
          featured: boolean
          id: string
          published: boolean
          rating: number
          sort_order: number
          text: string
          updated_at: string
        }
        Insert: {
          case_id?: string | null
          client_company?: string | null
          client_name: string
          client_photo_url?: string | null
          client_role?: string | null
          created_at?: string
          event_date?: string | null
          featured?: boolean
          id?: string
          published?: boolean
          rating?: number
          sort_order?: number
          text: string
          updated_at?: string
        }
        Update: {
          case_id?: string | null
          client_company?: string | null
          client_name?: string
          client_photo_url?: string | null
          client_role?: string | null
          created_at?: string
          event_date?: string | null
          featured?: boolean
          id?: string
          published?: boolean
          rating?: number
          sort_order?: number
          text?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "testimonials_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
        ]
      }
      text_overrides: {
        Row: {
          created_at: string
          id: string
          original_text: string
          override_text: string
          path: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          original_text: string
          override_text: string
          path: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          original_text?: string
          override_text?: string
          path?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      zones: {
        Row: {
          category: string | null
          created_at: string
          description: string | null
          extras: Json
          faq: Json | null
          features: Json | null
          id: string
          photo_urls: string[] | null
          pricing: Json | null
          published: boolean
          requirements: string | null
          seo_description: string | null
          seo_title: string | null
          slug: string
          sort_order: number
          title: string
          updated_at: string
          video_urls: string[] | null
        }
        Insert: {
          category?: string | null
          created_at?: string
          description?: string | null
          extras?: Json
          faq?: Json | null
          features?: Json | null
          id?: string
          photo_urls?: string[] | null
          pricing?: Json | null
          published?: boolean
          requirements?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug: string
          sort_order?: number
          title: string
          updated_at?: string
          video_urls?: string[] | null
        }
        Update: {
          category?: string | null
          created_at?: string
          description?: string | null
          extras?: Json
          faq?: Json | null
          features?: Json | null
          id?: string
          photo_urls?: string[] | null
          pricing?: Json | null
          published?: boolean
          requirements?: string | null
          seo_description?: string | null
          seo_title?: string | null
          slug?: string
          sort_order?: number
          title?: string
          updated_at?: string
          video_urls?: string[] | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      dj_can_manage: { Args: { _uid: string }; Returns: boolean }
      dj_is_member: { Args: { _uid: string }; Returns: boolean }
      dj_is_trusted: { Args: { _uid: string }; Returns: boolean }
      dj_member_status: { Args: { _uid: string }; Returns: string }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
      generate_order_number: { Args: { p_created: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_promo_usage: {
        Args: { p_code: string }
        Returns: {
          id: string
        }[]
      }
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      app_role:
        | "admin"
        | "manager"
        | "content_editor"
        | "marketer"
        | "accountant"
        | "dj_admin"
      availability_status: "available" | "booked" | "maintenance"
      order_status:
        | "new"
        | "consultation"
        | "estimate"
        | "contract"
        | "in_progress"
        | "quoted"
        | "completed"
        | "confirmed"
        | "paid"
        | "cancelled"
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
      app_role: [
        "admin",
        "manager",
        "content_editor",
        "marketer",
        "accountant",
        "dj_admin",
      ],
      availability_status: ["available", "booked", "maintenance"],
      order_status: [
        "new",
        "consultation",
        "estimate",
        "contract",
        "in_progress",
        "quoted",
        "completed",
        "confirmed",
        "paid",
        "cancelled",
      ],
    },
  },
} as const
