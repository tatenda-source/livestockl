import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { mockLivestock } from '../app/data/mockData';
import { useAuthStore } from '../stores/authStore';

export function useBids(livestockId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['bids', livestockId],
    enabled: !!livestockId,
    queryFn: async () => {
      if (!isSupabaseConfigured) {
        const item = mockLivestock.find(i => i.id === livestockId);
        return item?.bids || [];
      }

      const { data, error } = await supabase
        .from('bids')
        .select('*, profiles!user_id(first_name, last_name)')
        .eq('livestock_id', livestockId!)
        .order('amount', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data;
    },
  });

  // Realtime subscription for bid updates
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!livestockId || !isSupabaseConfigured) return;

    const channel = supabase
      .channel(`bids:${livestockId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'bids', filter: `livestock_id=eq.${livestockId}` },
        () => {
          clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ['bids', livestockId] });
            queryClient.invalidateQueries({ queryKey: ['livestock', livestockId] });
          }, 1000);
        }
      )
      .subscribe();

    return () => {
      clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [livestockId, queryClient]);

  return query;
}

export function usePlaceBid() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  return useMutation({
    mutationFn: async ({ livestockId, amount }: { livestockId: string; amount: number }) => {
      if (!user) throw new Error('Not authenticated');

      if (!isSupabaseConfigured) {
        // Validate seller cannot bid on own listing in demo mode
        const item = mockLivestock.find(i => i.id === livestockId);
        if (item && (item as any).sellerId === user.id) {
          throw new Error('Cannot bid on your own listing');
        }
        return { id: 'mock-bid-' + Date.now(), amount };
      }

      // Use atomic database function for bid placement
      const { data, error } = await (supabase.rpc as any)('place_bid', {
        p_livestock_id: livestockId,
        p_user_id: user.id,
        p_amount: amount,
      });

      if (error) throw error;
      return { id: data, amount };
    },
    onSuccess: (_, { livestockId }) => {
      queryClient.invalidateQueries({ queryKey: ['bids', livestockId] });
      queryClient.invalidateQueries({ queryKey: ['livestock', livestockId] });
      queryClient.invalidateQueries({ queryKey: ['livestock'] });
    },
  });
}
