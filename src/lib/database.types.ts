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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      achievements: {
        Row: {
          code: string
          description: string
          icon: string
          name: string
          sort: number
          xp_reward: number
        }
        Insert: {
          code: string
          description: string
          icon: string
          name: string
          sort?: number
          xp_reward?: number
        }
        Update: {
          code?: string
          description?: string
          icon?: string
          name?: string
          sort?: number
          xp_reward?: number
        }
        Relationships: []
      }
      ai_conversations: {
        Row: {
          context_id: string | null
          context_title: string | null
          context_type: string | null
          created_at: string
          difficulty: string
          id: string
          mode: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          context_id?: string | null
          context_title?: string | null
          context_type?: string | null
          created_at?: string
          difficulty?: string
          id?: string
          mode?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          context_id?: string | null
          context_title?: string | null
          context_type?: string | null
          created_at?: string
          difficulty?: string
          id?: string
          mode?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_conversations_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          fell_back: boolean
          id: string
          model: string | null
          provider: string | null
          role: string
          user_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          fell_back?: boolean
          id?: string
          model?: string | null
          provider?: string | null
          role: string
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          fell_back?: boolean
          id?: string
          model?: string | null
          provider?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "ai_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_requests: {
        Row: {
          created_at: string
          error_code: string | null
          id: string
          provider: string | null
          status: string
          task: string
          user_id: string
        }
        Insert: {
          created_at?: string
          error_code?: string | null
          id?: string
          provider?: string | null
          status: string
          task: string
          user_id: string
        }
        Update: {
          created_at?: string
          error_code?: string | null
          id?: string
          provider?: string | null
          status?: string
          task?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      allowed_emails: {
        Row: {
          email: string
        }
        Insert: {
          email: string
        }
        Update: {
          email?: string
        }
        Relationships: []
      }
      decks: {
        Row: {
          created_at: string
          description: string
          id: string
          is_shared: boolean
          owner_id: string
          source_note_id: string | null
          subject_id: string | null
          tags: string[]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          is_shared?: boolean
          owner_id: string
          source_note_id?: string | null
          subject_id?: string | null
          tags?: string[]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          is_shared?: boolean
          owner_id?: string
          source_note_id?: string | null
          subject_id?: string | null
          tags?: string[]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "decks_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decks_source_note_id_fkey"
            columns: ["source_note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "decks_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      flashcard_progress: {
        Row: {
          card_id: string
          correct_count: number
          due_at: string | null
          ease: number
          incorrect_count: number
          interval_minutes: number
          last_reviewed_at: string | null
          repetitions: number
          review_count: number
          state: string
          user_id: string
        }
        Insert: {
          card_id: string
          correct_count?: number
          due_at?: string | null
          ease?: number
          incorrect_count?: number
          interval_minutes?: number
          last_reviewed_at?: string | null
          repetitions?: number
          review_count?: number
          state?: string
          user_id: string
        }
        Update: {
          card_id?: string
          correct_count?: number
          due_at?: string | null
          ease?: number
          incorrect_count?: number
          interval_minutes?: number
          last_reviewed_at?: string | null
          repetitions?: number
          review_count?: number
          state?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flashcard_progress_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "flashcards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flashcard_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      flashcards: {
        Row: {
          back: string
          back_image_path: string | null
          correct_answer: string | null
          created_at: string
          deck_id: string
          difficulty: string | null
          front: string
          front_image_path: string | null
          id: string
          options: Json | null
          owner_id: string
          position: number
          topic: string | null
          type: string
          updated_at: string
        }
        Insert: {
          back?: string
          back_image_path?: string | null
          correct_answer?: string | null
          created_at?: string
          deck_id: string
          difficulty?: string | null
          front: string
          front_image_path?: string | null
          id?: string
          options?: Json | null
          owner_id: string
          position?: number
          topic?: string | null
          type?: string
          updated_at?: string
        }
        Update: {
          back?: string
          back_image_path?: string | null
          correct_answer?: string | null
          created_at?: string
          deck_id?: string
          difficulty?: string | null
          front?: string
          front_image_path?: string | null
          id?: string
          options?: Json | null
          owner_id?: string
          position?: number
          topic?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flashcards_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "decks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "flashcards_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      folders: {
        Row: {
          created_at: string
          id: string
          name: string
          owner_id: string
          subject_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          owner_id: string
          subject_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          owner_id?: string
          subject_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "folders_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "folders_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      marketplace_items: {
        Row: {
          category: string
          condition: string
          created_at: string
          description: string
          id: string
          image_path: string | null
          price: number
          seller_id: string
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          category: string
          condition: string
          created_at?: string
          description?: string
          id?: string
          image_path?: string | null
          price: number
          seller_id: string
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          category?: string
          condition?: string
          created_at?: string
          description?: string
          id?: string
          image_path?: string | null
          price?: number
          seller_id?: string
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "marketplace_items_seller_id_fkey"
            columns: ["seller_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          created_at: string
          emoji: string
          message_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          emoji: string
          message_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          emoji?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "message_reactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachment_mime: string | null
          attachment_name: string | null
          attachment_path: string | null
          body: string
          created_at: string
          deleted_at: string | null
          id: string
          kind: string
          listing_id: string | null
          room_id: string
          sender_id: string
        }
        Insert: {
          attachment_mime?: string | null
          attachment_name?: string | null
          attachment_path?: string | null
          body?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          kind?: string
          listing_id?: string | null
          room_id: string
          sender_id: string
        }
        Update: {
          attachment_mime?: string | null
          attachment_name?: string | null
          attachment_path?: string | null
          body?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          kind?: string
          listing_id?: string | null
          room_id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_listing_id_fkey"
            columns: ["listing_id"]
            isOneToOne: false
            referencedRelation: "marketplace_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "study_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      note_attachments: {
        Row: {
          created_at: string
          file_name: string
          id: string
          kind: string
          mime_type: string
          note_id: string
          owner_id: string
          size_bytes: number
          storage_path: string
        }
        Insert: {
          created_at?: string
          file_name: string
          id?: string
          kind?: string
          mime_type: string
          note_id: string
          owner_id: string
          size_bytes: number
          storage_path: string
        }
        Update: {
          created_at?: string
          file_name?: string
          id?: string
          kind?: string
          mime_type?: string
          note_id?: string
          owner_id?: string
          size_bytes?: number
          storage_path?: string
        }
        Relationships: [
          {
            foreignKeyName: "note_attachments_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "note_attachments_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          content: Json
          content_text: string
          created_at: string
          folder_id: string | null
          id: string
          is_favorite: boolean
          is_pinned: boolean
          is_shared: boolean
          owner_id: string
          search: unknown
          subject_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          content?: Json
          content_text?: string
          created_at?: string
          folder_id?: string | null
          id?: string
          is_favorite?: boolean
          is_pinned?: boolean
          is_shared?: boolean
          owner_id: string
          search?: unknown
          subject_id?: string | null
          title?: string
          updated_at?: string
        }
        Update: {
          content?: Json
          content_text?: string
          created_at?: string
          folder_id?: string | null
          id?: string
          is_favorite?: boolean
          is_pinned?: boolean
          is_shared?: boolean
          owner_id?: string
          search?: unknown
          subject_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notes_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "folders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notes_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          dedupe_key: string | null
          id: string
          kind: string
          link: string | null
          read_at: string | null
          title: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          dedupe_key?: string | null
          id?: string
          kind: string
          link?: string | null
          read_at?: string | null
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          dedupe_key?: string | null
          id?: string
          kind?: string
          link?: string | null
          read_at?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_path: string | null
          bio: string
          created_at: string
          current_streak: number
          display_name: string
          id: string
          last_active_date: string | null
          longest_streak: number
          onboarded_at: string | null
          preferences: Json
          star_color: string
          timezone: string
          updated_at: string
          xp: number
        }
        Insert: {
          avatar_path?: string | null
          bio?: string
          created_at?: string
          current_streak?: number
          display_name?: string
          id: string
          last_active_date?: string | null
          longest_streak?: number
          onboarded_at?: string | null
          preferences?: Json
          star_color?: string
          timezone?: string
          updated_at?: string
          xp?: number
        }
        Update: {
          avatar_path?: string | null
          bio?: string
          created_at?: string
          current_streak?: number
          display_name?: string
          id?: string
          last_active_date?: string | null
          longest_streak?: number
          onboarded_at?: string | null
          preferences?: Json
          star_color?: string
          timezone?: string
          updated_at?: string
          xp?: number
        }
        Relationships: []
      }
      quiz_attempts: {
        Row: {
          accuracy: number
          ai_analysis: Json | null
          answers: Json
          created_at: string
          duration_seconds: number
          finished_at: string | null
          id: string
          mode: string
          quiz_id: string | null
          score: number
          session_id: string | null
          started_at: string
          subject_id: string | null
          title: string
          topic_breakdown: Json
          total: number
          user_id: string
        }
        Insert: {
          accuracy?: number
          ai_analysis?: Json | null
          answers?: Json
          created_at?: string
          duration_seconds?: number
          finished_at?: string | null
          id?: string
          mode: string
          quiz_id?: string | null
          score?: number
          session_id?: string | null
          started_at: string
          subject_id?: string | null
          title?: string
          topic_breakdown?: Json
          total?: number
          user_id: string
        }
        Update: {
          accuracy?: number
          ai_analysis?: Json | null
          answers?: Json
          created_at?: string
          duration_seconds?: number
          finished_at?: string | null
          id?: string
          mode?: string
          quiz_id?: string | null
          score?: number
          session_id?: string | null
          started_at?: string
          subject_id?: string | null
          title?: string
          topic_breakdown?: Json
          total?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_attempts_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "study_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quiz_attempts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_questions: {
        Row: {
          correct_answer: string
          created_at: string
          difficulty: string | null
          explanation: string
          id: string
          options: Json
          position: number
          question: string
          quiz_id: string
          topic: string | null
          type: string
          updated_at: string
        }
        Insert: {
          correct_answer: string
          created_at?: string
          difficulty?: string | null
          explanation?: string
          id?: string
          options: Json
          position?: number
          question: string
          quiz_id: string
          topic?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          correct_answer?: string
          created_at?: string
          difficulty?: string | null
          explanation?: string
          id?: string
          options?: Json
          position?: number
          question?: string
          quiz_id?: string
          topic?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quizzes"
            referencedColumns: ["id"]
          },
        ]
      }
      quizzes: {
        Row: {
          created_at: string
          description: string
          id: string
          is_shared: boolean
          owner_id: string
          source: string
          source_deck_id: string | null
          source_note_ids: string[]
          subject_id: string | null
          time_limit_seconds: number | null
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string
          id?: string
          is_shared?: boolean
          owner_id: string
          source?: string
          source_deck_id?: string | null
          source_note_ids?: string[]
          subject_id?: string | null
          time_limit_seconds?: number | null
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          id?: string
          is_shared?: boolean
          owner_id?: string
          source?: string
          source_deck_id?: string | null
          source_note_ids?: string[]
          subject_id?: string | null
          time_limit_seconds?: number | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quizzes_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quizzes_source_deck_id_fkey"
            columns: ["source_deck_id"]
            isOneToOne: false
            referencedRelation: "decks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "quizzes_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      review_events: {
        Row: {
          card_id: string
          deck_id: string
          grade: number
          id: string
          reviewed_at: string
          session_key: string | null
          user_id: string
          was_correct: boolean | null
        }
        Insert: {
          card_id: string
          deck_id: string
          grade: number
          id?: string
          reviewed_at?: string
          session_key?: string | null
          user_id: string
          was_correct?: boolean | null
        }
        Update: {
          card_id?: string
          deck_id?: string
          grade?: number
          id?: string
          reviewed_at?: string
          session_key?: string | null
          user_id?: string
          was_correct?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "review_events_card_id_fkey"
            columns: ["card_id"]
            isOneToOne: false
            referencedRelation: "flashcards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_events_deck_id_fkey"
            columns: ["deck_id"]
            isOneToOne: false
            referencedRelation: "decks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "review_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      study_goals: {
        Row: {
          completed_at: string | null
          created_at: string
          due_date: string | null
          id: string
          is_shared: boolean
          kind: string
          owner_id: string
          progress: number
          target: number
          title: string
          updated_at: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          is_shared?: boolean
          kind: string
          owner_id: string
          progress?: number
          target: number
          title: string
          updated_at?: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          is_shared?: boolean
          kind?: string
          owner_id?: string
          progress?: number
          target?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_goals_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      study_plans: {
        Row: {
          added_to_calendar_at: string | null
          created_at: string
          exam_date: string
          id: string
          inputs: Json
          owner_id: string
          plan: Json
          subject_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          added_to_calendar_at?: string | null
          created_at?: string
          exam_date: string
          id?: string
          inputs: Json
          owner_id: string
          plan: Json
          subject_id?: string | null
          title?: string
          updated_at?: string
        }
        Update: {
          added_to_calendar_at?: string | null
          created_at?: string
          exam_date?: string
          id?: string
          inputs?: Json
          owner_id?: string
          plan?: Json
          subject_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_plans_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_plans_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      study_rooms: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_rooms_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      study_sessions: {
        Row: {
          cards_studied: number
          correct_answers: number
          created_at: string
          ended_at: string
          focus_seconds: number
          id: string
          mode: string
          questions_answered: number
          room_id: string | null
          started_at: string
          subject_id: string | null
          task_id: string | null
          together: boolean
          user_id: string
          xp_earned: number
        }
        Insert: {
          cards_studied?: number
          correct_answers?: number
          created_at?: string
          ended_at: string
          focus_seconds: number
          id?: string
          mode: string
          questions_answered?: number
          room_id?: string | null
          started_at: string
          subject_id?: string | null
          task_id?: string | null
          together?: boolean
          user_id: string
          xp_earned?: number
        }
        Update: {
          cards_studied?: number
          correct_answers?: number
          created_at?: string
          ended_at?: string
          focus_seconds?: number
          id?: string
          mode?: string
          questions_answered?: number
          room_id?: string | null
          started_at?: string
          subject_id?: string | null
          task_id?: string | null
          together?: boolean
          user_id?: string
          xp_earned?: number
        }
        Relationships: [
          {
            foreignKeyName: "study_sessions_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_sessions_task_fk"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subjects: {
        Row: {
          color: string
          created_at: string
          icon: string
          id: string
          name: string
          owner_id: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          icon?: string
          id?: string
          name: string
          owner_id: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          icon?: string
          id?: string
          name?: string
          owner_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subjects_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_completions: {
        Row: {
          completed_at: string
          id: string
          occurrence_date: string
          task_id: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          id?: string
          occurrence_date: string
          task_id: string
          user_id: string
        }
        Update: {
          completed_at?: string
          id?: string
          occurrence_date?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_completions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_completions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          all_day: boolean
          created_at: string
          description: string
          due_at: string | null
          duration_minutes: number | null
          id: string
          is_shared: boolean
          kind: string
          owner_id: string
          plan_id: string | null
          priority: string
          recurrence: string
          recurrence_until: string | null
          source: string
          start_at: string | null
          subject_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          all_day?: boolean
          created_at?: string
          description?: string
          due_at?: string | null
          duration_minutes?: number | null
          id?: string
          is_shared?: boolean
          kind?: string
          owner_id: string
          plan_id?: string | null
          priority?: string
          recurrence?: string
          recurrence_until?: string | null
          source?: string
          start_at?: string | null
          subject_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          all_day?: boolean
          created_at?: string
          description?: string
          due_at?: string | null
          duration_minutes?: number | null
          id?: string
          is_shared?: boolean
          kind?: string
          owner_id?: string
          plan_id?: string | null
          priority?: string
          recurrence?: string
          recurrence_until?: string | null
          source?: string
          start_at?: string | null
          subject_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "study_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_subject_id_fkey"
            columns: ["subject_id"]
            isOneToOne: false
            referencedRelation: "subjects"
            referencedColumns: ["id"]
          },
        ]
      }
      user_achievements: {
        Row: {
          achievement_code: string
          unlocked_at: string
          user_id: string
        }
        Insert: {
          achievement_code: string
          unlocked_at?: string
          user_id: string
        }
        Update: {
          achievement_code?: string
          unlocked_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_achievements_achievement_code_fkey"
            columns: ["achievement_code"]
            isOneToOne: false
            referencedRelation: "achievements"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "user_achievements_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      xp_events: {
        Row: {
          amount: number
          created_at: string
          id: string
          reason: string
          ref: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          reason: string
          ref?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          reason?: string
          ref?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "xp_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      complete_flashcard_session: {
        Args: { p_session_key: string }
        Returns: number
      }
      get_space_stats: {
        Args: { p_week_start: string }
        Returns: {
          achievements: number
          cards_total: number
          cards_week: number
          current_streak: number
          focus_seconds_total: number
          focus_seconds_week: number
          last_active_date: string
          longest_streak: number
          quizzes_total: number
          quizzes_week: number
          together_seconds_total: number
          user_id: string
        }[]
      }
      invite_partner: { Args: { p_email: string }; Returns: undefined }
      pending_invite: { Args: never; Returns: string }
      refresh_reminders: { Args: never; Returns: undefined }
      reserve_ai_request: {
        Args: {
          p_per_day: number
          p_per_minute: number
          p_task: string
          p_user: string
        }
        Returns: {
          allowed: boolean
          code: string
          request_id: string
          used_today: number
        }[]
      }
      search_notes: {
        Args: { q: string }
        Returns: {
          content: Json
          content_text: string
          created_at: string
          folder_id: string | null
          id: string
          is_favorite: boolean
          is_pinned: boolean
          is_shared: boolean
          owner_id: string
          search: unknown
          subject_id: string | null
          title: string
          updated_at: string
        }[]
        SetofOptions: {
          from: "*"
          to: "notes"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      space_feed: {
        Args: { p_limit?: number }
        Returns: {
          at: string
          detail: Json
          kind: string
          ref_id: string
          title: string
          user_id: string
        }[]
      }
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
    Enums: {},
  },
} as const
