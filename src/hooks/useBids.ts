import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
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
        .order('amount', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Realtime subscription for bid updates
  useEffect(() => {
    if (!livestockId || !isSupabaseConfigured) return;

    const channel = supabase
      .channel(`bids:${livestockId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'bids', filter: `livestock_id=eq.${livestockId}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['bids', livestockId] });
          queryClient.invalidateQueries({ queryKey: ['livestock', livestockId] });
        }
      )
      .subscribe();

    return () => {
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
      if (!isSupabaseConfigured) {
        return { id: 'mock-bid-' + Date.now(), amount };
      }

      // Insert bid
      const { data: bid, error: bidError } = await supabase
        .from('bids')
        .insert({
          livestock_id: livestockId,
          user_id: user!.id,
          amount,
        })
        .select()
        .single();

      if (bidError) throw bidError;

      // Update livestock current_bid and bid_count
      const { error: updateError } = await supabase
        .from('livestock_items')
        .update({
          current_bid: amount,
          bid_count: supabase.rpc ? undefined : 0, // handled by trigger ideally
        })
        .eq('id', livestockId)
        .lt('current_bid', amount);

      if (updateError) throw updateError;

      return bid;
    },
    onSuccess: (_, { livestockId }) => {
      queryClient.invalidateQueries({ queryKey: ['bids', livestockId] });
      queryClient.invalidateQueries({ queryKey: ['livestock', livestockId] });
      queryClient.invalidateQueries({ queryKey: ['livestock'] });
    },
  });
}
