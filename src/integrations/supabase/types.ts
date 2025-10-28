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
    PostgrestVersion: "13.0.4"
  }
  public: {
    Tables: {
      assessment_batches: {
        Row: {
          batch_index: number
          batch_results: Json | null
          completed_at: string | null
          created_at: string
          document_id: string
          error_message: string | null
          id: string
          questions_processed: number
          status: string
          total_batches: number
          updated_at: string
          user_id: string
        }
        Insert: {
          batch_index: number
          batch_results?: Json | null
          completed_at?: string | null
          created_at?: string
          document_id: string
          error_message?: string | null
          id?: string
          questions_processed?: number
          status?: string
          total_batches: number
          updated_at?: string
          user_id: string
        }
        Update: {
          batch_index?: number
          batch_results?: Json | null
          completed_at?: string | null
          created_at?: string
          document_id?: string
          error_message?: string | null
          id?: string
          questions_processed?: number
          status?: string
          total_batches?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_batches_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "uploaded_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_progress: {
        Row: {
          batch_results: Json | null
          completed_at: string | null
          created_at: string
          current_batch: number
          document_id: string
          error_message: string | null
          final_score: number | null
          id: string
          processed_questions: number
          progress_percentage: number
          report_id: string | null
          sections_data: Json | null
          status: string
          total_batches: number
          total_questions: number
          updated_at: string
          user_id: string
        }
        Insert: {
          batch_results?: Json | null
          completed_at?: string | null
          created_at?: string
          current_batch?: number
          document_id: string
          error_message?: string | null
          final_score?: number | null
          id?: string
          processed_questions?: number
          progress_percentage?: number
          report_id?: string | null
          sections_data?: Json | null
          status?: string
          total_batches?: number
          total_questions?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          batch_results?: Json | null
          completed_at?: string | null
          created_at?: string
          current_batch?: number
          document_id?: string
          error_message?: string | null
          final_score?: number | null
          id?: string
          processed_questions?: number
          progress_percentage?: number
          report_id?: string | null
          sections_data?: Json | null
          status?: string
          total_batches?: number
          total_questions?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "assessment_progress_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "uploaded_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "assessment_progress_report_id_fkey"
            columns: ["report_id"]
            isOneToOne: false
            referencedRelation: "assessment_reports"
            referencedColumns: ["id"]
          },
        ]
      }
      assessment_reports: {
        Row: {
          assessment_data: Json
          company_name: string
          created_at: string
          credibility_score: number
          generated_at: string
          id: string
          report_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          assessment_data: Json
          company_name: string
          created_at?: string
          credibility_score: number
          generated_at?: string
          id?: string
          report_type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          assessment_data?: Json
          company_name?: string
          created_at?: string
          credibility_score?: number
          generated_at?: string
          id?: string
          report_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string
          full_name: string | null
          id: string
          organization: string | null
          role: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          organization?: string | null
          role?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          organization?: string | null
          role?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      questionnaire_metadata: {
        Row: {
          description: string | null
          file_name: string
          file_path: string
          id: string
          is_active: boolean
          questionnaire_data: Json | null
          uploaded_at: string
          version: string
        }
        Insert: {
          description?: string | null
          file_name: string
          file_path: string
          id?: string
          is_active?: boolean
          questionnaire_data?: Json | null
          uploaded_at?: string
          version?: string
        }
        Update: {
          description?: string | null
          file_name?: string
          file_path?: string
          id?: string
          is_active?: boolean
          questionnaire_data?: Json | null
          uploaded_at?: string
          version?: string
        }
        Relationships: []
      }
      uploaded_documents: {
        Row: {
          assessment_status: string
          created_at: string
          document_text: string | null
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id: string
          is_temporary: boolean
          processed_at: string | null
          updated_at: string
          uploaded_at: string
          user_id: string
        }
        Insert: {
          assessment_status?: string
          created_at?: string
          document_text?: string | null
          file_name: string
          file_path: string
          file_size: number
          file_type: string
          id?: string
          is_temporary?: boolean
          processed_at?: string | null
          updated_at?: string
          uploaded_at?: string
          user_id: string
        }
        Update: {
          assessment_status?: string
          created_at?: string
          document_text?: string | null
          file_name?: string
          file_path?: string
          file_size?: number
          file_type?: string
          id?: string
          is_temporary?: boolean
          processed_at?: string | null
          updated_at?: string
          uploaded_at?: string
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
