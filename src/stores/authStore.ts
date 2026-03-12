import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Database } from '../lib/database.types';

type Profile = Database['public']['Tables']['profiles']['Row'];

interface AuthState {
  user: Profile | null;
  session: { access_token: string } | null;
  loading: boolean;
  initialized: boolean;

  initialize: () => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string, meta: { first_name: string; last_name: string; phone: string }) => Promise<void>;
  logout: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      session: null,
      loading: false,
      initialized: false,

      initialize: async () => {
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

            set({
              user: profile,
              session: { access_token: session.access_token },
              initialized: true,
            });
          } else {
            set({ initialized: true });
          }
        } catch {
          set({ initialized: true });
        }

        supabase.auth.onAuthStateChange(async (event, session) => {
          if (event === 'SIGNED_OUT') {
            set({ user: null, session: null });
          } else if (session?.user) {
            const { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single();

            set({
              user: profile,
              session: { access_token: session.access_token },
            });
          }
        });
      },

      login: async (email, password) => {
        set({ loading: true });
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        set({ loading: false });
        if (error) throw error;
      },

      signup: async (email, password, meta) => {
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
        await supabase.auth.signOut();
        set({ user: null, session: null });
      },
    }),
    {
      name: 'zimlivestock-auth',
      partialize: (state) => ({ user: state.user, session: state.session }),
    }
  )
);
