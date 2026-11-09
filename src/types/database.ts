export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

type Table<Row, Insert, Update> = {
  Row: Row;
  Insert: Insert;
  Update: Update;
  Relationships: [];
};

export interface Database {
  public: {
    Tables: {
      families: Table<
        { id: string; name: string; created_at: string; created_by: string },
        { id?: string; name: string; created_at?: string; created_by: string },
        { name?: string }
      >;
      family_members: Table<
        {
          user_id: string;
          family_id: string;
          display_name: string;
          role: "admin" | "member";
          created_at: string;
        },
        {
          user_id: string;
          family_id: string;
          display_name: string;
          role?: "admin" | "member";
          created_at?: string;
        },
        { display_name?: string }
      >;
      wishes: Table<
        {
          id: string;
          family_id: string;
          owner_id: string;
          title: string;
          description: string | null;
          product_url: string | null;
          image_url: string | null;
          estimated_price_cents: number | null;
          priority: "low" | "normal" | "high";
          created_at: string;
          updated_at: string;
        },
        {
          id?: string;
          family_id?: string;
          owner_id?: string;
          title: string;
          description?: string | null;
          product_url?: string | null;
          image_url?: string | null;
          estimated_price_cents?: number | null;
          priority?: "low" | "normal" | "high";
          created_at?: string;
          updated_at?: string;
        },
        {
          title?: string;
          description?: string | null;
          product_url?: string | null;
          image_url?: string | null;
          estimated_price_cents?: number | null;
          priority?: "low" | "normal" | "high";
        }
      >;
      reservations: Table<
        {
          id: string;
          wish_id: string;
          family_id: string;
          reserved_by: string;
          created_at: string;
        },
        {
          id?: string;
          wish_id: string;
          family_id?: string;
          reserved_by?: string;
          created_at?: string;
        },
        never
      >;
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
