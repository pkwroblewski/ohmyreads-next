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
      activity_feed: {
        Row: {
          book_id: string | null
          checkin_id: string | null
          created_at: string
          id: string
          place_id: string | null
          review_id: string | null
          type: string
          user_id: string
        }
        Insert: {
          book_id?: string | null
          checkin_id?: string | null
          created_at?: string
          id?: string
          place_id?: string | null
          review_id?: string | null
          type: string
          user_id: string
        }
        Update: {
          book_id?: string | null
          checkin_id?: string | null
          created_at?: string
          id?: string
          place_id?: string | null
          review_id?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_feed_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_feed_checkin_id_fkey"
            columns: ["checkin_id"]
            isOneToOne: false
            referencedRelation: "place_checkins"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_feed_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_feed_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_feed_user_id_profiles_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      admin_role_changes: {
        Row: {
          action: string
          changed_by: string | null
          created_at: string
          id: string
          reason: string | null
          source: string
          user_id: string
        }
        Insert: {
          action: string
          changed_by?: string | null
          created_at?: string
          id?: string
          reason?: string | null
          source: string
          user_id: string
        }
        Update: {
          action?: string
          changed_by?: string | null
          created_at?: string
          id?: string
          reason?: string | null
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          ip_address: string | null
          metadata: Json | null
          target_id: string | null
          target_type: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          target_id?: string | null
          target_type: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          target_id?: string | null
          target_type?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      book_club_members: {
        Row: {
          club_id: string
          joined_at: string | null
          role: string | null
          user_id: string
        }
        Insert: {
          club_id: string
          joined_at?: string | null
          role?: string | null
          user_id: string
        }
        Update: {
          club_id?: string
          joined_at?: string | null
          role?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "book_club_members_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "book_clubs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_club_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      book_club_reads: {
        Row: {
          book_id: string
          club_id: string
          completed_at: string | null
          id: string
          started_at: string | null
          status: string | null
        }
        Insert: {
          book_id: string
          club_id: string
          completed_at?: string | null
          id?: string
          started_at?: string | null
          status?: string | null
        }
        Update: {
          book_id?: string
          club_id?: string
          completed_at?: string | null
          id?: string
          started_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "book_club_reads_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_club_reads_club_id_fkey"
            columns: ["club_id"]
            isOneToOne: false
            referencedRelation: "book_clubs"
            referencedColumns: ["id"]
          },
        ]
      }
      book_clubs: {
        Row: {
          cover_image_url: string | null
          created_at: string | null
          created_by: string | null
          description: string | null
          id: string
          member_count: number | null
          name: string
          slug: string
          updated_at: string | null
          visibility: string | null
        }
        Insert: {
          cover_image_url?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          member_count?: number | null
          name: string
          slug: string
          updated_at?: string | null
          visibility?: string | null
        }
        Update: {
          cover_image_url?: string | null
          created_at?: string | null
          created_by?: string | null
          description?: string | null
          id?: string
          member_count?: number | null
          name?: string
          slug?: string
          updated_at?: string | null
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "book_clubs_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      book_events: {
        Row: {
          city: string | null
          country: string | null
          created_at: string | null
          description: string | null
          end_date: string | null
          event_type: string
          geohash: string | null
          id: string
          image_url: string | null
          is_featured: boolean | null
          lat: number | null
          lng: number | null
          source: string | null
          start_date: string
          start_time: string | null
          title: string
          updated_at: string | null
          url: string | null
          venue_address: string | null
          venue_name: string
        }
        Insert: {
          city?: string | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          event_type: string
          geohash?: string | null
          id?: string
          image_url?: string | null
          is_featured?: boolean | null
          lat?: number | null
          lng?: number | null
          source?: string | null
          start_date: string
          start_time?: string | null
          title: string
          updated_at?: string | null
          url?: string | null
          venue_address?: string | null
          venue_name: string
        }
        Update: {
          city?: string | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          end_date?: string | null
          event_type?: string
          geohash?: string | null
          id?: string
          image_url?: string | null
          is_featured?: boolean | null
          lat?: number | null
          lng?: number | null
          source?: string | null
          start_date?: string
          start_time?: string | null
          title?: string
          updated_at?: string | null
          url?: string | null
          venue_address?: string | null
          venue_name?: string
        }
        Relationships: []
      }
      book_events_summaries: {
        Row: {
          event_count: number | null
          generated_at: string | null
          geohash_prefix: string
          id: string
          summary: string
          week_start: string
        }
        Insert: {
          event_count?: number | null
          generated_at?: string | null
          geohash_prefix: string
          id?: string
          summary: string
          week_start: string
        }
        Update: {
          event_count?: number | null
          generated_at?: string | null
          geohash_prefix?: string
          id?: string
          summary?: string
          week_start?: string
        }
        Relationships: []
      }
      book_submissions: {
        Row: {
          author: string
          book_id: string | null
          cover_source: string | null
          cover_url: string | null
          created_at: string | null
          description: string | null
          genres: string[] | null
          google_books_id: string | null
          id: string
          isbn: string | null
          moderated_at: string | null
          moderated_by: string | null
          open_library_cover_id: number | null
          open_library_id: string | null
          page_count: number | null
          published_date: string | null
          rejection_reason: string | null
          slug: string
          status: string | null
          submitted_by: string
          title: string
          updated_at: string | null
        }
        Insert: {
          author: string
          book_id?: string | null
          cover_source?: string | null
          cover_url?: string | null
          created_at?: string | null
          description?: string | null
          genres?: string[] | null
          google_books_id?: string | null
          id?: string
          isbn?: string | null
          moderated_at?: string | null
          moderated_by?: string | null
          open_library_cover_id?: number | null
          open_library_id?: string | null
          page_count?: number | null
          published_date?: string | null
          rejection_reason?: string | null
          slug: string
          status?: string | null
          submitted_by: string
          title: string
          updated_at?: string | null
        }
        Update: {
          author?: string
          book_id?: string | null
          cover_source?: string | null
          cover_url?: string | null
          created_at?: string | null
          description?: string | null
          genres?: string[] | null
          google_books_id?: string | null
          id?: string
          isbn?: string | null
          moderated_at?: string | null
          moderated_by?: string | null
          open_library_cover_id?: number | null
          open_library_id?: string | null
          page_count?: number | null
          published_date?: string | null
          rejection_reason?: string | null
          slug?: string
          status?: string | null
          submitted_by?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "book_submissions_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "book_submissions_submitted_by_profiles_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      books: {
        Row: {
          author: string
          author_slug: string | null
          average_rating: number | null
          cover_source: string | null
          cover_url: string | null
          created_at: string
          description: string | null
          fts: unknown
          genres: string[] | null
          google_books_id: string | null
          id: string
          isbn: string | null
          local_average_rating: number | null
          local_ratings_count: number
          open_library_cover_id: number | null
          open_library_id: string | null
          page_count: number | null
          published_date: string | null
          ratings_count: number | null
          slug: string
          title: string
          updated_at: string | null
        }
        Insert: {
          author: string
          author_slug?: string | null
          average_rating?: number | null
          cover_source?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          fts?: unknown
          genres?: string[] | null
          google_books_id?: string | null
          id?: string
          isbn?: string | null
          local_average_rating?: number | null
          local_ratings_count?: number
          open_library_cover_id?: number | null
          open_library_id?: string | null
          page_count?: number | null
          published_date?: string | null
          ratings_count?: number | null
          slug: string
          title: string
          updated_at?: string | null
        }
        Update: {
          author?: string
          author_slug?: string | null
          average_rating?: number | null
          cover_source?: string | null
          cover_url?: string | null
          created_at?: string
          description?: string | null
          fts?: unknown
          genres?: string[] | null
          google_books_id?: string | null
          id?: string
          isbn?: string | null
          local_average_rating?: number | null
          local_ratings_count?: number
          open_library_cover_id?: number | null
          open_library_id?: string | null
          page_count?: number | null
          published_date?: string | null
          ratings_count?: number | null
          slug?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      comments: {
        Row: {
          content: string
          created_at: string
          id: string
          parent_id: string | null
          review_id: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          parent_id?: string | null
          review_id: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          parent_id?: string | null
          review_id?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      direct_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          read_at: string | null
          receiver_id: string
          sender_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          read_at?: string | null
          receiver_id: string
          sender_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          read_at?: string | null
          receiver_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
          id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
          id?: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_follower_profile_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_following_profile_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      friend_requests: {
        Row: {
          created_at: string | null
          id: string
          receiver_id: string
          responded_at: string | null
          sender_id: string
          status: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          receiver_id: string
          responded_at?: string | null
          sender_id: string
          status?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          receiver_id?: string
          responded_at?: string | null
          sender_id?: string
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "friend_requests_receiver_profile_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "friend_requests_sender_profile_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      place_checkins: {
        Row: {
          book_id: string | null
          created_at: string | null
          id: string
          note: string | null
          place_id: string
          user_id: string
        }
        Insert: {
          book_id?: string | null
          created_at?: string | null
          id?: string
          note?: string | null
          place_id: string
          user_id: string
        }
        Update: {
          book_id?: string | null
          created_at?: string | null
          id?: string
          note?: string | null
          place_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_checkins_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_checkins_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_checkins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      place_photos: {
        Row: {
          caption: string | null
          created_at: string | null
          id: string
          is_approved: boolean | null
          place_id: string
          storage_path: string
          user_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string | null
          id?: string
          is_approved?: boolean | null
          place_id: string
          storage_path: string
          user_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string | null
          id?: string
          is_approved?: boolean | null
          place_id?: string
          storage_path?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_photos_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_photos_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      place_reviews: {
        Row: {
          atmosphere_tags: string[] | null
          content: string | null
          created_at: string | null
          id: string
          place_id: string
          rating: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          atmosphere_tags?: string[] | null
          content?: string | null
          created_at?: string | null
          id?: string
          place_id: string
          rating: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          atmosphere_tags?: string[] | null
          content?: string | null
          created_at?: string | null
          id?: string
          place_id?: string
          rating?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "place_reviews_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_reviews_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      place_submissions: {
        Row: {
          address: string | null
          city: string | null
          country: string | null
          created_at: string | null
          description: string | null
          geohash: string | null
          id: string
          lat: number | null
          lng: number | null
          moderator_id: string | null
          moderator_notes: string | null
          name: string
          place_type: string
          reviewed_at: string | null
          status: string
          submitted_by: string
          website: string | null
        }
        Insert: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          geohash?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          moderator_id?: string | null
          moderator_notes?: string | null
          name: string
          place_type: string
          reviewed_at?: string | null
          status?: string
          submitted_by: string
          website?: string | null
        }
        Update: {
          address?: string | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          geohash?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          moderator_id?: string | null
          moderator_notes?: string | null
          name?: string
          place_type?: string
          reviewed_at?: string | null
          status?: string
          submitted_by?: string
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "place_submissions_moderator_id_fkey"
            columns: ["moderator_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "place_submissions_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      places: {
        Row: {
          address: string | null
          average_rating: number | null
          checkins_count: number | null
          city: string | null
          country: string | null
          created_at: string | null
          description: string | null
          geohash: string | null
          id: string
          lat: number | null
          lng: number | null
          name: string
          photos_count: number | null
          place_type: string
          reviews_count: number | null
          submitted_by: string | null
          updated_at: string | null
          website: string | null
        }
        Insert: {
          address?: string | null
          average_rating?: number | null
          checkins_count?: number | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          geohash?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          photos_count?: number | null
          place_type: string
          reviews_count?: number | null
          submitted_by?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Update: {
          address?: string | null
          average_rating?: number | null
          checkins_count?: number | null
          city?: string | null
          country?: string | null
          created_at?: string | null
          description?: string | null
          geohash?: string | null
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          photos_count?: number | null
          place_type?: string
          reviews_count?: number | null
          submitted_by?: string | null
          updated_at?: string | null
          website?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "places_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      places_cache: {
        Row: {
          data: Json
          expires_at: string
          fetched_at: string
          geohash_prefix: string
          id: string
          place_type: string
        }
        Insert: {
          data?: Json
          expires_at?: string
          fetched_at?: string
          geohash_prefix: string
          id?: string
          place_type: string
        }
        Update: {
          data?: Json
          expires_at?: string
          fetched_at?: string
          geohash_prefix?: string
          id?: string
          place_type?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          admin_granted_at: string | null
          admin_granted_by: string | null
          avatar_url: string | null
          bio: string | null
          created_at: string
          disabled_at: string | null
          discovery_visible: boolean | null
          display_name: string | null
          email_digest_enabled: boolean | null
          email_digest_frequency: string | null
          email_notifications_enabled: boolean | null
          followers_count: number | null
          following_count: number | null
          friends_count: number | null
          id: string
          is_admin: boolean | null
          is_public_activity: boolean | null
          last_digest_sent_at: string | null
          location_enabled: boolean | null
          location_geohash: string | null
          location_label: string | null
          location_precision: number | null
          location_updated_at: string | null
          presence_expires_at: string | null
          presence_note: string | null
          presence_type: string | null
          unread_messages_count: number | null
          updated_at: string
          username: string
          website: string | null
        }
        Insert: {
          admin_granted_at?: string | null
          admin_granted_by?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          disabled_at?: string | null
          discovery_visible?: boolean | null
          display_name?: string | null
          email_digest_enabled?: boolean | null
          email_digest_frequency?: string | null
          email_notifications_enabled?: boolean | null
          followers_count?: number | null
          following_count?: number | null
          friends_count?: number | null
          id: string
          is_admin?: boolean | null
          is_public_activity?: boolean | null
          last_digest_sent_at?: string | null
          location_enabled?: boolean | null
          location_geohash?: string | null
          location_label?: string | null
          location_precision?: number | null
          location_updated_at?: string | null
          presence_expires_at?: string | null
          presence_note?: string | null
          presence_type?: string | null
          unread_messages_count?: number | null
          updated_at?: string
          username: string
          website?: string | null
        }
        Update: {
          admin_granted_at?: string | null
          admin_granted_by?: string | null
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          disabled_at?: string | null
          discovery_visible?: boolean | null
          display_name?: string | null
          email_digest_enabled?: boolean | null
          email_digest_frequency?: string | null
          email_notifications_enabled?: boolean | null
          followers_count?: number | null
          following_count?: number | null
          friends_count?: number | null
          id?: string
          is_admin?: boolean | null
          is_public_activity?: boolean | null
          last_digest_sent_at?: string | null
          location_enabled?: boolean | null
          location_geohash?: string | null
          location_label?: string | null
          location_precision?: number | null
          location_updated_at?: string | null
          presence_expires_at?: string | null
          presence_note?: string | null
          presence_type?: string | null
          unread_messages_count?: number | null
          updated_at?: string
          username?: string
          website?: string | null
        }
        Relationships: []
      }
      reading_challenges: {
        Row: {
          challenge_type: Database["public"]["Enums"]["challenge_type"]
          completed_at: string | null
          created_at: string | null
          current_value: number
          description: string | null
          end_date: string
          genre: string | null
          id: string
          name: string
          start_date: string
          status: Database["public"]["Enums"]["challenge_status"]
          target_value: number
          updated_at: string | null
          user_id: string
        }
        Insert: {
          challenge_type?: Database["public"]["Enums"]["challenge_type"]
          completed_at?: string | null
          created_at?: string | null
          current_value?: number
          description?: string | null
          end_date: string
          genre?: string | null
          id?: string
          name: string
          start_date: string
          status?: Database["public"]["Enums"]["challenge_status"]
          target_value: number
          updated_at?: string | null
          user_id: string
        }
        Update: {
          challenge_type?: Database["public"]["Enums"]["challenge_type"]
          completed_at?: string | null
          created_at?: string | null
          current_value?: number
          description?: string | null
          end_date?: string
          genre?: string | null
          id?: string
          name?: string
          start_date?: string
          status?: Database["public"]["Enums"]["challenge_status"]
          target_value?: number
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      reading_goals: {
        Row: {
          created_at: string | null
          id: string
          target_books: number
          updated_at: string | null
          user_id: string
          year: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          target_books?: number
          updated_at?: string | null
          user_id: string
          year: number
        }
        Update: {
          created_at?: string | null
          id?: string
          target_books?: number
          updated_at?: string | null
          user_id?: string
          year?: number
        }
        Relationships: []
      }
      reading_list_books: {
        Row: {
          added_at: string | null
          book_id: string
          list_id: string
          note: string | null
          position: number
        }
        Insert: {
          added_at?: string | null
          book_id: string
          list_id: string
          note?: string | null
          position: number
        }
        Update: {
          added_at?: string | null
          book_id?: string
          list_id?: string
          note?: string | null
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "reading_list_books_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reading_list_books_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "reading_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      reading_list_likes: {
        Row: {
          created_at: string | null
          list_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          list_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          list_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reading_list_likes_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "reading_lists"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reading_list_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reading_lists: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          likes_count: number | null
          slug: string
          title: string
          updated_at: string | null
          user_id: string
          visibility: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          likes_count?: number | null
          slug: string
          title: string
          updated_at?: string | null
          user_id: string
          visibility?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          likes_count?: number | null
          slug?: string
          title?: string
          updated_at?: string | null
          user_id?: string
          visibility?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "reading_lists_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reading_stats: {
        Row: {
          books_read: number | null
          current_streak: number | null
          pages_read: number | null
          reviews_count: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          books_read?: number | null
          current_streak?: number | null
          pages_read?: number | null
          reviews_count?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          books_read?: number | null
          current_streak?: number | null
          pages_read?: number | null
          reviews_count?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      reports: {
        Row: {
          created_at: string
          details: string | null
          id: string
          reason: string
          reporter_id: string | null
          resolution_note: string | null
          resolved_at: string | null
          resolved_by: string | null
          status: string
          target_id: string
          target_type: string
        }
        Insert: {
          created_at?: string
          details?: string | null
          id?: string
          reason: string
          reporter_id?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          target_id: string
          target_type: string
        }
        Update: {
          created_at?: string
          details?: string | null
          id?: string
          reason?: string
          reporter_id?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
          target_id?: string
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reports_resolved_by_fkey"
            columns: ["resolved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      review_likes: {
        Row: {
          created_at: string | null
          id: string
          review_id: string
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          review_id: string
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          review_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_likes_review_id_fkey"
            columns: ["review_id"]
            isOneToOne: false
            referencedRelation: "reviews"
            referencedColumns: ["id"]
          },
        ]
      }
      reviews: {
        Row: {
          book_id: string
          content: string
          created_at: string
          disliked: string | null
          id: string
          is_spoiler: boolean | null
          liked: string | null
          likes_count: number | null
          rating: number | null
          summary: string | null
          takeaway: string | null
          updated_at: string
          user_id: string
          vibe_tags: string[] | null
        }
        Insert: {
          book_id: string
          content: string
          created_at?: string
          disliked?: string | null
          id?: string
          is_spoiler?: boolean | null
          liked?: string | null
          likes_count?: number | null
          rating?: number | null
          summary?: string | null
          takeaway?: string | null
          updated_at?: string
          user_id: string
          vibe_tags?: string[] | null
        }
        Update: {
          book_id?: string
          content?: string
          created_at?: string
          disliked?: string | null
          id?: string
          is_spoiler?: boolean | null
          liked?: string | null
          likes_count?: number | null
          rating?: number | null
          summary?: string | null
          takeaway?: string | null
          updated_at?: string
          user_id?: string
          vibe_tags?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "reviews_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reviews_user_profile_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      shelf_books: {
        Row: {
          added_at: string | null
          id: string
          notes: string | null
          shelf_id: string
          user_book_id: string
        }
        Insert: {
          added_at?: string | null
          id?: string
          notes?: string | null
          shelf_id: string
          user_book_id: string
        }
        Update: {
          added_at?: string | null
          id?: string
          notes?: string | null
          shelf_id?: string
          user_book_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shelf_books_shelf_id_fkey"
            columns: ["shelf_id"]
            isOneToOne: false
            referencedRelation: "user_shelves"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shelf_books_user_book_id_fkey"
            columns: ["user_book_id"]
            isOneToOne: false
            referencedRelation: "user_books"
            referencedColumns: ["id"]
          },
        ]
      }
      social_links: {
        Row: {
          created_at: string
          display_order: number | null
          id: string
          platform: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number | null
          id?: string
          platform: string
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_order?: number | null
          id?: string
          platform?: string
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      user_badges: {
        Row: {
          badge_id: string
          id: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          badge_id: string
          id?: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          badge_id?: string
          id?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_books: {
        Row: {
          book_id: string
          created_at: string
          current_page: number | null
          finished_at: string | null
          id: string
          progress_percentage: number | null
          rating: number | null
          started_at: string | null
          status: string
          total_pages: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          book_id: string
          created_at?: string
          current_page?: number | null
          finished_at?: string | null
          id?: string
          progress_percentage?: number | null
          rating?: number | null
          started_at?: string | null
          status: string
          total_pages?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          book_id?: string
          created_at?: string
          current_page?: number | null
          finished_at?: string | null
          id?: string
          progress_percentage?: number | null
          rating?: number | null
          started_at?: string | null
          status?: string
          total_pages?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_books_book_id_fkey"
            columns: ["book_id"]
            isOneToOne: false
            referencedRelation: "books"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_books_user_profile_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_checkin_stats: {
        Row: {
          current_streak: number | null
          last_checkin_date: string | null
          longest_streak: number | null
          total_checkins: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          current_streak?: number | null
          last_checkin_date?: string | null
          longest_streak?: number | null
          total_checkins?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          current_streak?: number | null
          last_checkin_date?: string | null
          longest_streak?: number | null
          total_checkins?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_checkin_stats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_shelves: {
        Row: {
          color: string | null
          created_at: string | null
          description: string | null
          icon: string | null
          id: string
          is_public: boolean | null
          name: string
          sort_order: number | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_public?: boolean | null
          name: string
          sort_order?: number | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string | null
          description?: string | null
          icon?: string | null
          id?: string
          is_public?: boolean | null
          name?: string
          sort_order?: number | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      user_taste_profiles: {
        Row: {
          created_at: string | null
          id: string
          onboarding_completed: boolean | null
          preferred_genres: string[] | null
          preferred_length: string | null
          preferred_pace: string | null
          preferred_vibes: string[] | null
          seed_book_ids: string[] | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          onboarding_completed?: boolean | null
          preferred_genres?: string[] | null
          preferred_length?: string | null
          preferred_pace?: string | null
          preferred_vibes?: string[] | null
          seed_book_ids?: string[] | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          onboarding_completed?: boolean | null
          preferred_genres?: string[] | null
          preferred_length?: string | null
          preferred_pace?: string | null
          preferred_vibes?: string[] | null
          seed_book_ids?: string[] | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      add_club_creator_as_admin: {
        Args: { p_club_id: string; p_user_id: string }
        Returns: undefined
      }
      admin_genre_distribution: {
        Args: { p_limit?: number }
        Returns: {
          genre: string
          genre_count: number
        }[]
      }
      admin_growth_daily: {
        Args: { p_since: string }
        Returns: {
          day: string
          review_count: number
          user_count: number
        }[]
      }
      admin_rating_distribution: {
        Args: never
        Returns: {
          rating_count: number
          rating_value: number
        }[]
      }
      approve_book_submission: {
        Args: { p_moderator_id: string; p_submission_id: string }
        Returns: string
      }
      approve_place_submission: {
        Args: { admin_notes?: string; submission_id: string }
        Returns: string
      }
      are_friends: { Args: { user1: string; user2: string }; Returns: boolean }
      cleanup_expired_presence: { Args: never; Returns: number }
      decrement_review_likes: {
        Args: { review_id: string }
        Returns: undefined
      }
      generate_club_slug: { Args: { club_name: string }; Returns: string }
      generate_list_slug: {
        Args: { list_title: string; owner_id: string }
        Returns: string
      }
      get_author_summaries: {
        Args: never
        Returns: {
          avg_rating: number
          book_count: number
          name: string
          slug: string
        }[]
      }
      get_club_visibility: { Args: { p_club_id: string }; Returns: string }
      get_conversations: {
        Args: never
        Returns: {
          friend_avatar_url: string
          friend_display_name: string
          friend_id: string
          friend_username: string
          last_message: string
          last_message_at: string
          unread_count: number
        }[]
      }
      get_distinct_genres: {
        Args: never
        Returns: {
          genre: string
        }[]
      }
      get_my_profile: {
        Args: never
        Returns: {
          admin_granted_at: string | null
          admin_granted_by: string | null
          avatar_url: string | null
          bio: string | null
          created_at: string
          disabled_at: string | null
          discovery_visible: boolean | null
          display_name: string | null
          email_digest_enabled: boolean | null
          email_digest_frequency: string | null
          email_notifications_enabled: boolean | null
          followers_count: number | null
          following_count: number | null
          friends_count: number | null
          id: string
          is_admin: boolean | null
          is_public_activity: boolean | null
          last_digest_sent_at: string | null
          location_enabled: boolean | null
          location_geohash: string | null
          location_label: string | null
          location_precision: number | null
          location_updated_at: string | null
          presence_expires_at: string | null
          presence_note: string | null
          presence_type: string | null
          unread_messages_count: number | null
          updated_at: string
          username: string
          website: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "profiles"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_nearby_readers: {
        Args: { p_limit?: number; p_prefixes: string[] }
        Returns: {
          avatar_url: string
          display_name: string
          id: string
          location_geohash: string
          location_label: string
          presence_expires_at: string
          presence_note: string
          presence_type: string
          username: string
        }[]
      }
      get_reader_taste_batch: {
        Args: { p_user_ids: string[] }
        Returns: {
          book_ids: string[]
          genres: string[]
          user_id: string
          vibes: string[]
        }[]
      }
      get_top_reviewers: {
        Args: { limit_count?: number }
        Returns: {
          avatar_url: string
          display_name: string
          id: string
          review_count: number
          username: string
        }[]
      }
      get_trending_activity: {
        Args: { p_since: string }
        Returns: {
          add_count: number
          book_id: string
          review_count: number
        }[]
      }
      get_user_shelf_count: { Args: { p_user_id: string }; Returns: number }
      increment_review_likes: {
        Args: { review_id: string }
        Returns: undefined
      }
      is_api_role: { Args: never; Returns: boolean }
      is_club_admin: { Args: { p_club_id: string }; Returns: boolean }
      is_club_member: { Args: { p_club_id: string }; Returns: boolean }
      recalculate_book_rating: {
        Args: { p_book_id: string }
        Returns: undefined
      }
      reconcile_book_local_ratings: { Args: never; Returns: number }
      reconcile_counters: {
        Args: never
        Returns: {
          counter: string
          rows_fixed: number
        }[]
      }
      reject_place_submission: {
        Args: { admin_notes?: string; submission_id: string }
        Returns: boolean
      }
      set_book_shelves: {
        Args: { p_shelf_ids: string[]; p_user_book_id: string }
        Returns: undefined
      }
      sync_book_local_ratings: {
        Args: { p_book_ids: string[] }
        Returns: undefined
      }
      sync_reading_stats: { Args: { p_user_ids: string[] }; Returns: undefined }
    }
    Enums: {
      challenge_status: "active" | "completed" | "failed" | "abandoned"
      challenge_type: "books_count" | "pages_count" | "genre_books"
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
      challenge_status: ["active", "completed", "failed", "abandoned"],
      challenge_type: ["books_count", "pages_count", "genre_books"],
    },
  },
} as const
