import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { mockLivestock } from '../app/data/mockData';
import { useAuthStore } from '../stores/authStore';

const PAGE_SIZE = 20;

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
        .order('created_at', { ascending: false })
        .limit(PAGE_SIZE);

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
  const viewCountedRef = useRef<string | null>(null);

  const query = useQuery({
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

      return data;
    },
  });

  // Increment view count once per item ID, outside of queryFn
  useEffect(() => {
    if (id && isSupabaseConfigured && viewCountedRef.current !== id) {
      const key = `viewed_${id}`;
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1');
        viewCountedRef.current = id;
        (supabase.rpc as any)('increment_view_count', { p_item_id: id }).then();
      } else {
        viewCountedRef.current = id;
      }
    }
  }, [id]);

  return query;
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
      if (!user) throw new Error('Not authenticated');

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
        .order('created_at', { ascending: false })
        .limit(50);

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
          item.bids.some(bid => bid.userId === user?.id && bid.isWinner)
        );
      }

      const { data: winningBids, error } = await supabase
        .from('bids')
        .select('livestock_id, amount, livestock_items(*)')
        .eq('user_id', user!.id)
        .eq('is_winner', true)
        .limit(50);

      if (error) throw error;
      return winningBids?.map(b => b.livestock_items).filter(Boolean) || [];
    },
  });
}

export function useUpdateListing() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  return useMutation({
    mutationFn: async ({ id, ...updates }: {
      id: string;
      title?: string;
      breed?: string;
      age?: string;
      weight?: string;
      description?: string;
      location?: string;
      health?: string;
      starting_price?: number;
      image_urls?: string[];
    }) => {
      if (!user) throw new Error('Not authenticated');

      if (!isSupabaseConfigured) {
        return { id, ...updates };
      }

      let query = supabase
        .from('livestock_items')
        .update(updates)
        .eq('id', id)
        .eq('seller_id', user.id);

      // If starting_price is being updated, atomically verify bid_count is 0
      if (updates.starting_price !== undefined) {
        query = query.eq('bid_count', 0);
      }

      const { data, error } = await query.select().single();

      if (error) {
        if (updates.starting_price !== undefined && error.code === 'PGRST116') {
          throw new Error('Cannot change starting price after bids have been placed');
        }
        throw error;
      }

      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['livestock'] });
      queryClient.invalidateQueries({ queryKey: ['my-listings'] });
    },
  });
}

export function useDeleteListing() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  return useMutation({
    mutationFn: async ({ id }: { id: string }) => {
      if (!user) throw new Error('Not authenticated');

      if (!isSupabaseConfigured) {
        return { id };
      }

      // Single atomic delete -- checks bid_count and status in the same query
      const { data, error } = await supabase
        .from('livestock_items')
        .delete()
        .eq('id', id)
        .eq('seller_id', user.id)
        .eq('status', 'active')
        .eq('bid_count', 0)
        .select('id')
        .maybeSingle();

      if (error) throw error;
      if (!data) {
        throw new Error('Cannot delete: listing has bids or is no longer active');
      }
      return { id };
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['livestock'] });
      queryClient.invalidateQueries({ queryKey: ['my-listings'] });
    },
  });
}

export function useUploadImage() {
  return useMutation({
    mutationFn: async ({ file, userId }: { file: File; userId: string }) => {
      // Validate file type and size
      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (!allowedTypes.includes(file.type)) {
        throw new Error('Only JPEG, PNG, WebP, and GIF images are allowed');
      }
      if (file.size > 5 * 1024 * 1024) {
        throw new Error('Image must be less than 5MB');
      }

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
