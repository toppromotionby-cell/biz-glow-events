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
          entity_type: string
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          created_at?: string
          entity_type: string
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          created_at?: string
          entity_type?: string
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      document_settings: {
        Row: {
          accent_color: string
          act_footer: string
          act_intro: string
          act_validity_days: number
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
          invoice_footer: string
          invoice_validity_days: number
          logo_url: string | null
          quote_footer: string
          quote_validity_days: number
          signer_basis: string
          signer_name: string
          signer_title: string
          singleton: boolean
          updated_at: string
          updated_by: string | null
          vat_note: string
        }
        Insert: {
          accent_color?: string
          act_footer?: string
          act_intro?: string
          act_validity_days?: number
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
          invoice_footer?: string
          invoice_validity_days?: number
          logo_url?: string | null
          quote_footer?: string
          quote_validity_days?: number
          signer_basis?: string
          signer_name?: string
          signer_title?: string
          singleton?: boolean
          updated_at?: string
          updated_by?: string | null
          vat_note?: string
        }
        Update: {
          accent_color?: string
          act_footer?: string
          act_intro?: string
          act_validity_days?: number
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
          invoice_footer?: string
          invoice_validity_days?: number
          logo_url?: string | null
          quote_footer?: string
          quote_validity_days?: number
          signer_basis?: string
          signer_name?: string
          signer_title?: string
          singleton?: boolean
          updated_at?: string
          updated_by?: string | null
          vat_note?: string
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
          short_description: string | null
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
          short_description?: string | null
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
          short_description?: string | null
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
          short_description: string | null
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
          short_description?: string | null
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
          short_description?: string | null
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
          short_description: string | null
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
          short_description?: string | null
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
          short_description?: string | null
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
          short_description: string | null
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
          short_description?: string | null
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
          short_description?: string | null
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
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
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
      app_role: "admin" | "manager" | "content_editor" | "marketer"
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
      app_role: ["admin", "manager", "content_editor", "marketer"],
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
