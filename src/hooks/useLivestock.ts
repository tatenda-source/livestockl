import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { mockLivestock } from '../app/data/mockData';
import { useAuthStore } from '../stores/authStore';

export function useLivestockList(category?: string) {
  return useQuery({
    queryKey: ['livestock', category],
    queryFn: async () => {
      if (!isSupabaseConfigured) {
        const items = category && category !== 'All'
          ? mockLivestock.filter(i => i.category === category)
          : mockLivestock;
        return items;
      }

      let query = supabase
        .from('livestock_items')
        .select('*, profiles!seller_id(first_name, last_name, avatar_url, verified, rating, sales_count)')
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (category && category !== 'All') {
        query = query.eq('category', category);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
  });
}

export function useLivestockItem(id: string | undefined) {
  return useQuery({
    queryKey: ['livestock', id],
    enabled: !!id,
    queryFn: async () => {
      if (!isSupabaseConfigured) {
        const item = mockLivestock.find(i => i.id === id);
        if (!item) throw new Error('Item not found');
        return item;
      }

      const { data, error } = await supabase
        .from('livestock_items')
        .select('*, profiles!seller_id(first_name, last_name, avatar_url, verified, rating, sales_count)')
        .eq('id', id!)
        .single();

      if (error) throw error;

      // Increment view count
      supabase.from('livestock_items').update({ view_count: (data.view_count || 0) + 1 }).eq('id', id!).then();

      return data;
    },
  });
}

export function useCreateListing() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  return useMutation({
    mutationFn: async (listing: {
      title: string;
      category: string;
      breed: string;
      age: string;
      weight: string;
      description: string;
      location: string;
      health: string;
      starting_price: number;
      duration_days: number;
      image_urls: string[];
    }) => {
      if (!isSupabaseConfigured) {
        return { id: 'mock-' + Date.now() };
      }

      const endTime = new Date();
      endTime.setDate(endTime.getDate() + listing.duration_days);

      const { data, error } = await supabase
        .from('livestock_items')
        .insert({
          ...listing,
          seller_id: user!.id,
          current_bid: 0,
          end_time: endTime.toISOString(),
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['livestock'] });
      queryClient.invalidateQueries({ queryKey: ['my-listings'] });
    },
  });
}

export function useMyListings() {
  const user = useAuthStore((s) => s.user);

  return useQuery({
    queryKey: ['my-listings', user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!isSupabaseConfigured) {
        return mockLivestock.slice(0, 2);
      }

      const { data, error } = await supabase
        .from('livestock_items')
        .select('*')
        .eq('seller_id', user!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });
}

export function useWonItems() {
  const user = useAuthStore((s) => s.user);

  return useQuery({
    queryKey: ['won-items', user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!isSupabaseConfigured) {
        return mockLivestock.filter(item =>
          item.bids.some(bid => bid.userId === 'user-1' && bid.isWinner)
        );
      }

      const { data: winningBids, error } = await supabase
        .from('bids')
        .select('livestock_id, amount, livestock_items(*)')
        .eq('user_id', user!.id)
        .eq('is_winner', true);

      if (error) throw error;
      return winningBids?.map(b => b.livestock_items).filter(Boolean) || [];
    },
  });
}

export function useUploadImage() {
  return useMutation({
    mutationFn: async ({ file, userId }: { file: File; userId: string }) => {
      const ext = file.name.split('.').pop();
      const path = `${userId}/${Date.now()}.${ext}`;

      const { error } = await supabase.storage
        .from('livestock-images')
        .upload(path, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('livestock-images')
        .getPublicUrl(path);

      return publicUrl;
    },
  });
}
