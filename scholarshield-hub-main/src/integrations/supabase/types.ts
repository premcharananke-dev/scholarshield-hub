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
      application_documents: {
        Row: {
          application_id: string
          created_at: string
          document_name: string
          id: string
          provided: boolean
          verified: boolean
        }
        Insert: {
          application_id: string
          created_at?: string
          document_name: string
          id?: string
          provided?: boolean
          verified?: boolean
        }
        Update: {
          application_id?: string
          created_at?: string
          document_name?: string
          id?: string
          provided?: boolean
          verified?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "application_documents_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      application_history: {
        Row: {
          application_id: string
          created_at: string
          id: string
          note: string
          status: string
        }
        Insert: {
          application_id: string
          created_at?: string
          id?: string
          note?: string
          status: string
        }
        Update: {
          application_id?: string
          created_at?: string
          id?: string
          note?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "application_history_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: false
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      applications: {
        Row: {
          academic_percentage: number
          academic_year: string
          attendance: number
          category: string
          college: string
          course: string
          course_stream: string | null
          department: string | null
          eligible: boolean
          email: string
          family_income: number
          fingerprint: string
          full_name: string
          gender: string | null
          id: string
          is_demo: boolean
          is_duplicate: boolean
          phone: string
          rules: Json
          scholarship_id: string | null
          scholarship_name: string
          status: string
          status_note: string | null
          student_id: string
          study_level: string | null
          submitted_at: string
          updated_at: string
          user_id: string | null
          year_of_study: number | null
        }
        Insert: {
          academic_percentage: number
          academic_year: string
          attendance: number
          category: string
          college: string
          course: string
          course_stream?: string | null
          department?: string | null
          eligible?: boolean
          email: string
          family_income: number
          fingerprint: string
          full_name: string
          gender?: string | null
          id?: string
          is_demo?: boolean
          is_duplicate?: boolean
          phone: string
          rules?: Json
          scholarship_id?: string | null
          scholarship_name: string
          status?: string
          status_note?: string | null
          student_id: string
          study_level?: string | null
          submitted_at?: string
          updated_at?: string
          user_id?: string | null
          year_of_study?: number | null
        }
        Update: {
          academic_percentage?: number
          academic_year?: string
          attendance?: number
          category?: string
          college?: string
          course?: string
          course_stream?: string | null
          department?: string | null
          eligible?: boolean
          email?: string
          family_income?: number
          fingerprint?: string
          full_name?: string
          gender?: string | null
          id?: string
          is_demo?: boolean
          is_duplicate?: boolean
          phone?: string
          rules?: Json
          scholarship_id?: string | null
          scholarship_name?: string
          status?: string
          status_note?: string | null
          student_id?: string
          study_level?: string | null
          submitted_at?: string
          updated_at?: string
          user_id?: string | null
          year_of_study?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "applications_scholarship_id_fkey"
            columns: ["scholarship_id"]
            isOneToOne: false
            referencedRelation: "scholarships"
            referencedColumns: ["id"]
          },
        ]
      }
      disbursements: {
        Row: {
          amount: number
          application_id: string
          created_at: string
          id: string
          payment_date: string | null
          payment_reference: string | null
          recorded_by: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          application_id: string
          created_at?: string
          id?: string
          payment_date?: string | null
          payment_reference?: string | null
          recorded_by?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          application_id?: string
          created_at?: string
          id?: string
          payment_date?: string | null
          payment_reference?: string | null
          recorded_by?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "disbursements_application_id_fkey"
            columns: ["application_id"]
            isOneToOne: true
            referencedRelation: "applications"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          academic_percentage: number | null
          category: string | null
          college: string | null
          course: string | null
          course_stream: string | null
          created_at: string
          department: string | null
          email: string
          family_income: number | null
          full_name: string
          gender: string | null
          id: string
          phone: string | null
          student_id: string | null
          study_level: string | null
          updated_at: string
          use_gender_for_matching: boolean
          year_of_study: number | null
        }
        Insert: {
          academic_percentage?: number | null
          category?: string | null
          college?: string | null
          course?: string | null
          course_stream?: string | null
          created_at?: string
          department?: string | null
          email?: string
          family_income?: number | null
          full_name?: string
          gender?: string | null
          id: string
          phone?: string | null
          student_id?: string | null
          study_level?: string | null
          updated_at?: string
          use_gender_for_matching?: boolean
          year_of_study?: number | null
        }
        Update: {
          academic_percentage?: number | null
          category?: string | null
          college?: string | null
          course?: string | null
          course_stream?: string | null
          created_at?: string
          department?: string | null
          email?: string
          family_income?: number | null
          full_name?: string
          gender?: string | null
          id?: string
          phone?: string | null
          student_id?: string | null
          study_level?: string | null
          updated_at?: string
          use_gender_for_matching?: boolean
          year_of_study?: number | null
        }
        Relationships: []
      }
      saved_scholarships: {
        Row: {
          created_at: string
          scholarship_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          scholarship_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          scholarship_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_scholarships_scholarship_id_fkey"
            columns: ["scholarship_id"]
            isOneToOne: false
            referencedRelation: "scholarships"
            referencedColumns: ["id"]
          },
        ]
      }
      scholarships: {
        Row: {
          academic_year: string | null
          amount: string
          application_url: string | null
          benefits: string | null
          closing_date: string | null
          course_streams: string[]
          created_at: string
          description: string
          documents: string[]
          eligible_categories: string[]
          eligible_gender: string
          eligible_years: number[]
          id: string
          is_active: boolean
          max_income: number | null
          min_percentage: number | null
          name: string
          opening_date: string | null
          other_conditions: string[]
          percentage_basis: string | null
          provider: string
          provider_type: string
          source_url: string | null
          study_levels: string[]
          tags: string[]
          unverified_fields: string[]
          updated_at: string
          verification_note: string | null
        }
        Insert: {
          academic_year?: string | null
          amount?: string
          application_url?: string | null
          benefits?: string | null
          closing_date?: string | null
          course_streams?: string[]
          created_at?: string
          description?: string
          documents?: string[]
          eligible_categories?: string[]
          eligible_gender?: string
          eligible_years?: number[]
          id: string
          is_active?: boolean
          max_income?: number | null
          min_percentage?: number | null
          name: string
          opening_date?: string | null
          other_conditions?: string[]
          percentage_basis?: string | null
          provider: string
          provider_type?: string
          source_url?: string | null
          study_levels?: string[]
          tags?: string[]
          unverified_fields?: string[]
          updated_at?: string
          verification_note?: string | null
        }
        Update: {
          academic_year?: string | null
          amount?: string
          application_url?: string | null
          benefits?: string | null
          closing_date?: string | null
          course_streams?: string[]
          created_at?: string
          description?: string
          documents?: string[]
          eligible_categories?: string[]
          eligible_gender?: string
          eligible_years?: number[]
          id?: string
          is_active?: boolean
          max_income?: number | null
          min_percentage?: number | null
          name?: string
          opening_date?: string | null
          other_conditions?: string[]
          percentage_basis?: string | null
          provider?: string
          provider_type?: string
          source_url?: string | null
          study_levels?: string[]
          tags?: string[]
          unverified_fields?: string[]
          updated_at?: string
          verification_note?: string | null
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "student"
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
      app_role: ["admin", "student"],
    },
  },
} as const
