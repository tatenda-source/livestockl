import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Database } from '../lib/database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface AuthState {
  user: Profile | null;
  loading: boolean;
  initialized: boolean;

  initialize: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, meta: { first_name: string; last_name: string; phone: string }) => Promise<void>;
  logout: () => Promise<void>;
}

let authSubscription: { unsubscribe: () => void } | null = null;

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      loading: false,
      initialized: false,

      initialize: async () => {
        // Prevent double initialization (React StrictMode)
        if (get().initialized) return;

        if (!isSupabaseConfigured) {
          set({ initialized: true });
          return;
        }

        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single();

            set({ user: profile, initialized: true });
          } else {
            set({ initialized: true });
          }
        } catch {
          set({ initialized: true });
        }

        // Clean up any existing subscription before creating new one
        authSubscription?.unsubscribe();

        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
          if (event === 'SIGNED_OUT') {
            set({ user: null });
          } else if (session?.user) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single();

            set({ user: profile });
          }
        });

        authSubscription = subscription;
      },

      login: async (email, password) => {
        if (!isSupabaseConfigured) {
          // Demo mode: simulate login
          set({
            loading: true,
          });
          await new Promise(r => setTimeout(r, 500));
          set({
            user: {
              id: 'demo-user',
              email,
              first_name: 'Demo',
              last_name: 'User',
              phone: '0771234567',
              avatar_url: null,
              verified: false,
              rating: 0,
              sales_count: 0,
              created_at: new Date().toISOString(),
            },
            loading: false,
          });
          return;
        }

        set({ loading: true });
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        set({ loading: false });
        if (error) throw error;
      },

      signup: async (email, password, meta) => {
        if (!isSupabaseConfigured) {
          set({ loading: true });
          await new Promise(r => setTimeout(r, 500));
          set({
            user: {
              id: 'demo-user',
              email,
              first_name: meta.first_name,
              last_name: meta.last_name,
              phone: meta.phone,
              avatar_url: null,
              verified: false,
              rating: 0,
              sales_count: 0,
              created_at: new Date().toISOString(),
            },
            loading: false,
          });
          return;
        }

        set({ loading: true });
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { data: meta },
        });
        set({ loading: false });
        if (error) throw error;
      },

      logout: async () => {
        if (isSupabaseConfigured) {
          await supabase.auth.signOut();
        }
        set({ user: null });
      },
    }),
    {
      name: 'zimlivestock-auth',
      partialize: (state) => ({ user: state.user }),
    }
  )
);
