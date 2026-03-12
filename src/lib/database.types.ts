export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          first_name: string;
          last_name: string;
          phone: string;
          avatar_url: string | null;
          verified: boolean;
          rating: number;
          sales_count: number;
          created_at: string;
        };
        Insert: {
          id: string;
          email: string;
          first_name: string;
          last_name: string;
          phone: string;
          avatar_url?: string | null;
          verified?: boolean;
          rating?: number;
          sales_count?: number;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
      };
      livestock_items: {
        Row: {
          id: string;
          title: string;
          category: 'Cattle' | 'Goats' | 'Sheep' | 'Pigs' | 'Chickens' | 'Other';
          breed: string;
          age: string;
          weight: string;
          description: string;
          location: string;
          health: 'Excellent' | 'Good' | 'Fair';
          starting_price: number;
          current_bid: number;
          bid_count: number;
          view_count: number;
          image_urls: string[];
          seller_id: string;
          status: 'active' | 'ended' | 'sold' | 'cancelled';
          duration_days: number;
          end_time: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          title: string;
          category: 'Cattle' | 'Goats' | 'Sheep' | 'Pigs' | 'Chickens' | 'Other';
          breed: string;
          age: string;
          weight: string;
          description: string;
          location: string;
          health: 'Excellent' | 'Good' | 'Fair';
          starting_price: number;
          current_bid?: number;
          bid_count?: number;
          view_count?: number;
          image_urls?: string[];
          seller_id: string;
          status?: 'active' | 'ended' | 'sold' | 'cancelled';
          duration_days: number;
          end_time: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['livestock_items']['Insert']>;
      };
      bids: {
        Row: {
          id: string;
          livestock_id: string;
          user_id: string;
          amount: number;
          is_winner: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          livestock_id: string;
          user_id: string;
          amount: number;
          is_winner?: boolean;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['bids']['Insert']>;
      };
      payments: {
        Row: {
          id: string;
          user_id: string;
          livestock_id: string;
          reference: string;
          amount: number;
          method: 'EcoCash' | 'OneMoney' | 'Card';
          status: 'pending' | 'paid' | 'failed';
          paynow_reference: string | null;
          phone: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          livestock_id: string;
          reference: string;
          amount: number;
          method: 'EcoCash' | 'OneMoney' | 'Card';
          status?: 'pending' | 'paid' | 'failed';
          paynow_reference?: string | null;
          phone?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['payments']['Insert']>;
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          type: 'bid' | 'message' | 'auction_ending' | 'auction_won' | 'auction_lost' | 'verification' | 'payment';
          title: string;
          message: string;
          read: boolean;
          priority: 'high' | 'medium' | 'low';
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          type: 'bid' | 'message' | 'auction_ending' | 'auction_won' | 'auction_lost' | 'verification' | 'payment';
          title: string;
          message: string;
          read?: boolean;
          priority?: 'high' | 'medium' | 'low';
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['notifications']['Insert']>;
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
