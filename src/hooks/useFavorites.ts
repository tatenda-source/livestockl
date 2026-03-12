import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

// Demo mode: persist favorites in Zustand + localStorage
interface DemoFavoritesState {
  favoriteIds: string[];
  add: (id: string) => void;
  remove: (id: string) => void;
  has: (id: string) => boolean;
}

const useDemoFavoritesStore = create<DemoFavoritesState>()(
  persist(
    (set, get) => ({
      favoriteIds: [],
      add: (id: string) =>
        set((state) => ({
          favoriteIds: state.favoriteIds.includes(id)
            ? state.favoriteIds
            : [...state.favoriteIds, id],
        })),
      remove: (id: string) =>
        set((state) => ({
          favoriteIds: state.favoriteIds.filter((fid) => fid !== id),
        })),
      has: (id: string) => get().favoriteIds.includes(id),
    }),
    { name: 'zimlivestock-favorites' }
  )
);

export function useFavorites() {
  const user = useAuthStore((s) => s.user);
  const demoFavorites = useDemoFavoritesStore((s) => s.favoriteIds);

  return useQuery({
    queryKey: ['favorites', user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!isSupabaseConfigured) {
        return demoFavorites;
      }

      const { data, error } = await supabase
        .from('favorites')
        .select('livestock_id')
        .eq('user_id', user!.id);

      if (error) throw error;
      return data.map((row: { livestock_id: string }) => row.livestock_id);
    },
  });
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const demoStore = useDemoFavoritesStore();

  return useMutation({
    mutationFn: async (livestockId: string) => {
      if (!user) throw new Error('Not authenticated');

      if (!isSupabaseConfigured) {
        if (demoStore.has(livestockId)) {
          demoStore.remove(livestockId);
        } else {
          demoStore.add(livestockId);
        }
        return;
      }

      // Check if favorite exists
      const { data: existing, error: selectError } = await supabase
        .from('favorites')
        .select('id')
        .eq('user_id', user.id)
        .eq('livestock_id', livestockId)
        .maybeSingle();

      if (selectError) throw selectError;

      if (existing) {
        const { error } = await supabase
          .from('favorites')
          .delete()
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('favorites')
          .insert({ user_id: user.id, livestock_id: livestockId });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites', user?.id] });
    },
  });
}

export function useIsFavorite(livestockId: string): boolean {
  const { data: favoriteIds } = useFavorites();
  return favoriteIds?.includes(livestockId) ?? false;
}
