import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { mockNotifications } from '../app/data/mockData';
import { useAuthStore } from '../stores/authStore';

export function useNotifications() {
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['notifications', user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!isSupabaseConfigured) return mockNotifications;

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Realtime subscription for new notifications
  useEffect(() => {
    if (!user || !isSupabaseConfigured) return;

    const channel = supabase
      .channel(`notifications:${user.id}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${user.id}` },
        () => {
          queryClient.invalidateQueries({ queryKey: ['notifications', user.id] });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, queryClient]);

  return query;
}

export function useUnreadCount() {
  const user = useAuthStore((s) => s.user);

  return useQuery({
    queryKey: ['notifications-unread', user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!isSupabaseConfigured) {
        return mockNotifications.filter(n => !n.read).length;
      }

      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user!.id)
        .eq('read', false);

      if (error) throw error;
      return count || 0;
    },
  });
}

export function useMarkAllRead() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  return useMutation({
    mutationFn: async () => {
      if (!isSupabaseConfigured) return;

      const { error } = await supabase
        .from('notifications')
        .update({ read: true })
        .eq('user_id', user!.id)
        .eq('read', false);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      queryClient.invalidateQueries({ queryKey: ['notifications-unread'] });
    },
  });
}
