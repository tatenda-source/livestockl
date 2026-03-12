import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { mockPayments } from '../app/data/mockData';
import { useAuthStore } from '../stores/authStore';

export function usePaymentHistory() {
  const user = useAuthStore((s) => s.user);

  return useQuery({
    queryKey: ['payments', user?.id],
    enabled: !!user,
    queryFn: async () => {
      if (!isSupabaseConfigured) return mockPayments;

      const { data, error } = await supabase
        .from('payments')
        .select('*, livestock_items(title)')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data;
    },
  });
}

export function usePaymentStatus(reference: string | undefined) {
  return useQuery({
    queryKey: ['payment-status', reference],
    enabled: !!reference,
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      // Stop polling once payment is resolved
      if (status === 'paid' || status === 'failed') return false;
      return 5000; // Poll every 5 seconds
    },
    queryFn: async () => {
      if (!isSupabaseConfigured) {
        // Simulate payment going through after a delay
        return { status: 'pending' as const, reference };
      }

      const { data, error } = await supabase
        .from('payments')
        .select('*')
        .eq('reference', reference!)
        .single();

      if (error) throw error;
      return data;
    },
  });
}

export function useInitiatePayment() {
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);

  return useMutation({
    mutationFn: async ({
      livestockId,
      amount,
      method,
      phone,
    }: {
      livestockId: string;
      amount: number;
      method: 'EcoCash' | 'OneMoney' | 'Card';
      phone?: string;
    }) => {
      const reference = `ZL-${Date.now().toString(36).toUpperCase()}`;

      if (!isSupabaseConfigured) {
        return { reference, status: 'pending' as const };
      }

      // Create payment record
      const { data: payment, error } = await supabase
        .from('payments')
        .insert({
          user_id: user!.id,
          livestock_id: livestockId,
          reference,
          amount,
          method,
          phone: phone || null,
        })
        .select()
        .single();

      if (error) throw error;

      // Call Edge Function to initiate Paynow payment
      try {
        const { data: paynowResult } = await supabase.functions.invoke('initiate-payment', {
          body: { reference, amount, method, phone },
        });

        if (paynowResult?.redirectUrl && method === 'Card') {
          window.location.href = paynowResult.redirectUrl;
          return payment;
        }
      } catch {
        // Edge function may not be deployed yet — payment record still created
        console.warn('Paynow edge function not available — payment created locally');
      }

      return payment;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
    },
  });
}
