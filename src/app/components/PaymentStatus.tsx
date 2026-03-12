import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { usePaymentStatus } from "../../hooks/usePayments";
import { isSupabaseConfigured } from "../../lib/supabase";
import { Button } from "./ui/button";

type Status = 'pending' | 'success' | 'failed';

export function PaymentStatus() {
  const { ref } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const method = searchParams.get('method') || 'ecocash';
  const amount = searchParams.get('amount') || '0';

  // Use real polling when Supabase is configured
  const { data: paymentData } = usePaymentStatus(isSupabaseConfigured ? ref : undefined);

  // Demo mode simulation
  const [demoStatus, setDemoStatus] = useState<Status>('pending');

  useEffect(() => {
    if (!isSupabaseConfigured && demoStatus === 'pending') {
      const timer = setTimeout(() => setDemoStatus('success'), 5000);
      return () => clearTimeout(timer);
    }
  }, [demoStatus]);

  const status: Status = isSupabaseConfigured
    ? (paymentData?.status === 'paid' ? 'success' : paymentData?.status === 'failed' ? 'failed' : 'pending')
    : demoStatus;

  const getIcon = () => {
    switch (status) {
      case 'pending': return <Loader2 className="w-20 h-20 text-blue-600 animate-spin" />;
      case 'success': return <CheckCircle className="w-20 h-20 text-green-600" />;
      case 'failed': return <XCircle className="w-20 h-20 text-red-600" />;
    }
  };

  const getHeading = () => {
    switch (status) {
      case 'pending': return 'Payment Pending';
      case 'success': return 'Payment Successful';
      case 'failed': return 'Payment Failed';
    }
  };

  const getMessage = () => {
    switch (status) {
      case 'pending': return `Waiting for ${method === 'ecocash' ? 'EcoCash' : method === 'onemoney' ? 'OneMoney' : 'payment'} confirmation...`;
      case 'success': return 'Your payment has been confirmed. The seller will contact you shortly.';
      case 'failed': return 'Payment could not be processed. Please try again or contact support.';
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-card border rounded-lg shadow-lg p-8">
        <div className="flex justify-center mb-6">{getIcon()}</div>
        <h1 className="text-2xl font-bold text-center mb-4">{getHeading()}</h1>
        <div className="bg-muted rounded-lg p-3 mb-4">
          <p className="text-center font-mono text-sm">REF: {ref?.toUpperCase()}</p>
        </div>
        <p className="text-center text-muted-foreground mb-6">{getMessage()}</p>

        {status === 'pending' && (method === 'ecocash' || method === 'onemoney') && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-900 text-center">Dial *151# if you missed the prompt</p>
          </div>
        )}

        {status === 'pending' && (
          <p className="text-center text-sm text-muted-foreground mb-6">Auto-checking every 5 seconds...</p>
        )}

        <Button onClick={() => navigate('/')} variant={status === 'success' ? 'default' : 'outline'} className="w-full">
          {status === 'success' ? 'Back to Marketplace' : 'Back to Home'}
        </Button>

        {status === 'failed' && (
          <Button onClick={() => navigate(-1)} className="w-full mt-3">Try Again</Button>
        )}
      </div>
    </div>
  );
}
