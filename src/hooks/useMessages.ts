import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useAuthStore } from '../stores/authStore';

// Mock data for demo mode
const mockConversations = [
  {
    id: 'conv-1',
    participant_1: 'demo-user',
    participant_2: 'user-seller-1',
    livestock_id: '1',
    last_message_at: new Date(Date.now() - 5 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
    other_participant: { first_name: 'John', last_name: 'M.' },
    livestock_items: { title: 'Ngoni Bull' },
    last_message: 'Is the bull still available?',
  },
  {
    id: 'conv-2',
    participant_1: 'user-seller-2',
    participant_2: 'demo-user',
    livestock_id: '2',
    last_message_at: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
    other_participant: { first_name: 'Grace', last_name: 'T.' },
    livestock_items: { title: 'Boer Goat Pair' },
    last_message: 'Yes, you can come view them this weekend.',
  },
];

const mockMessages: Record<string, any[]> = {
  'conv-1': [
    { id: 'msg-1', conversation_id: 'conv-1', sender_id: 'demo-user', content: 'Hi, is the bull still available?', read: true, created_at: new Date(Date.now() - 60 * 60 * 1000).toISOString() },
    { id: 'msg-2', conversation_id: 'conv-1', sender_id: 'user-seller-1', content: 'Yes it is! Are you interested?', read: true, created_at: new Date(Date.now() - 50 * 60 * 1000).toISOString() },
    { id: 'msg-3', conversation_id: 'conv-1', sender_id: 'demo-user', content: 'Is the bull still available?', read: false, created_at: new Date(Date.now() - 5 * 60 * 1000).toISOString() },
  ],
  'conv-2': [
    { id: 'msg-4', conversation_id: 'conv-2', sender_id: 'demo-user', content: 'Can I come see the goats?', read: true, created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() },
    { id: 'msg-5', conversation_id: 'conv-2', sender_id: 'user-seller-2', content: 'Yes, you can come view them this weekend.', read: true, created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString() },
  ],
};

export function useConversations() {
  const user = useAuthStore((s) => s.user);

  return useQuery({
    queryKey: ['conversations', user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!isSupabaseConfigured) {
        return mockConversations;
      }

      const userId = user!.id;

      // Fetch conversations where user is a participant
      const { data, error } = await supabase
        .from('conversations')
        .select(`
          *,
          p1:profiles!participant_1(first_name, last_name),
          p2:profiles!participant_2(first_name, last_name),
          livestock_items(title)
        `)
        .or(`participant_1.eq.${userId},participant_2.eq.${userId}`)
        .order('last_message_at', { ascending: false });

      if (error) throw error;

      // Get last message for each conversation
      const convIds = (data || []).map((c: any) => c.id);
      let lastMessages: Record<string, string> = {};

      if (convIds.length > 0) {
        // Fetch last message for each conversation
        const { data: msgs } = await supabase
          .from('messages')
          .select('conversation_id, content')
          .in('conversation_id', convIds)
          .order('created_at', { ascending: false })
          .limit(50);

        if (msgs) {
          for (const msg of msgs) {
            if (!lastMessages[msg.conversation_id]) {
              lastMessages[msg.conversation_id] = msg.content;
            }
          }
        }
      }

      return (data || []).map((c: any) => ({
        ...c,
        other_participant: c.participant_1 === userId ? c.p2 : c.p1,
        last_message: lastMessages[c.id] || '',
      }));
    },
  });
}

export function useMessages(conversationId: string | undefined) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['messages', conversationId],
    enabled: !!conversationId,
    queryFn: async () => {
      if (!isSupabaseConfigured) {
        return mockMessages[conversationId!] || [];
      }

      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId!)
        .order('created_at', { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  // Realtime subscription for new messages (debounced)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    if (!conversationId || !isSupabaseConfigured) return;

    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        () => {
          clearTimeout(debounceRef.current);
          debounceRef.current = setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
            queryClient.invalidateQueries({ queryKey: ['conversations'] });
          }, 1000);
        }
      )
      .subscribe();

    return () => {
      clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [conversationId, queryClient]);

  return query;
}

export function useSendMessage() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  return useMutation({
    mutationFn: async ({ conversationId, content }: { conversationId: string; content: string }) => {
      if (!user) throw new Error('Not authenticated');

      if (!isSupabaseConfigured) {
        const newMsg = {
          id: 'msg-' + Date.now(),
          conversation_id: conversationId,
          sender_id: user.id,
          content,
          read: false,
          created_at: new Date().toISOString(),
        };
        // Add to mock data
        if (!mockMessages[conversationId]) mockMessages[conversationId] = [];
        mockMessages[conversationId].push(newMsg);
        return newMsg;
      }

      // Insert message
      const { data, error } = await supabase
        .from('messages')
        .insert({ conversation_id: conversationId, sender_id: user.id, content })
        .select()
        .single();

      if (error) throw error;

      // Update conversation last_message_at
      await supabase
        .from('conversations')
        .update({ last_message_at: new Date().toISOString() })
        .eq('id', conversationId);

      return data;
    },
    onSuccess: (_, { conversationId }) => {
      queryClient.invalidateQueries({ queryKey: ['messages', conversationId] });
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}

export function useStartConversation() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  return useMutation({
    mutationFn: async ({ sellerId, livestockId }: { sellerId: string; livestockId?: string }) => {
      if (!user) throw new Error('Not authenticated');

      if (!isSupabaseConfigured) {
        // Find existing mock conversation
        const existing = mockConversations.find(
          (c) =>
            ((c.participant_1 === user.id && c.participant_2 === sellerId) ||
              (c.participant_1 === sellerId && c.participant_2 === user.id)) &&
            c.livestock_id === (livestockId || null)
        );
        if (existing) return existing;
        // Create new mock conversation
        const newConv = {
          id: 'conv-' + Date.now(),
          participant_1: user.id,
          participant_2: sellerId,
          livestock_id: livestockId || null,
          last_message_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
          other_participant: { first_name: 'Seller', last_name: '' },
          livestock_items: { title: 'Listing' },
          last_message: '',
        };
        mockConversations.unshift(newConv);
        return newConv;
      }

      // Ensure consistent ordering: lower UUID first
      const p1 = user.id < sellerId ? user.id : sellerId;
      const p2 = user.id < sellerId ? sellerId : user.id;

      // Try to find existing conversation
      let query = supabase
        .from('conversations')
        .select('*')
        .eq('participant_1', p1)
        .eq('participant_2', p2);

      if (livestockId) {
        query = query.eq('livestock_id', livestockId);
      } else {
        query = query.is('livestock_id', null);
      }

      const { data: existing } = await query.maybeSingle();

      if (existing) return existing;

      // Create new conversation
      const { data, error } = await supabase
        .from('conversations')
        .insert({
          participant_1: p1,
          participant_2: p2,
          livestock_id: livestockId || null,
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}
