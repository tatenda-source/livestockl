import { useState, useEffect } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { Button } from "./ui/button";

type PaymentStatus = 'pending' | 'success' | 'failed';

export function PaymentStatus() {
  const { ref } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const method = searchParams.get('method') || 'ecocash';
  const amount = searchParams.get('amount') || '0';
  
  const [status, setStatus] = useState<PaymentStatus>('pending');
  const [countdown, setCountdown] = useState(5);

  // Simulate payment status polling
  useEffect(() => {
    if (status === 'pending') {
      const timer = setTimeout(() => {
        // Simulate successful payment after 5 seconds
        setStatus('success');
      }, 5000);
      
      return () => clearTimeout(timer);
    }
  }, [status]);

  // Countdown for auto-checking message
  useEffect(() => {
    if (status === 'pending' && countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [status, countdown]);

  const getIcon = () => {
    switch (status) {
      case 'pending':
        return <Loader2 className="w-20 h-20 text-blue-600 animate-spin" />;
      case 'success':
        return <CheckCircle className="w-20 h-20 text-green-600" />;
      case 'failed':
        return <XCircle className="w-20 h-20 text-red-600" />;
    }
  };

  const getHeading = () => {
    switch (status) {
      case 'pending':
        return 'Payment Pending';
      case 'success':
        return 'Payment Successful';
      case 'failed':
        return 'Payment Failed';
    }
  };

  const getMessage = () => {
    switch (status) {
      case 'pending':
        return `Waiting for ${method === 'ecocash' ? 'EcoCash' : method === 'onemoney' ? 'OneMoney' : 'payment'} confirmation...`;
      case 'success':
        return 'Your payment has been confirmed. The seller will contact you shortly.';
      case 'failed':
        return 'Payment could not be processed. Please try again or contact support.';
    }
  };

  const getMethodName = () => {
    switch (method) {
      case 'ecocash':
        return 'EcoCash';
      case 'onemoney':
        return 'OneMoney';
      case 'card':
        return 'Card';
      default:
        return 'Payment';
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-card border rounded-lg shadow-lg p-8">
        {/* Icon */}
        <div className="flex justify-center mb-6">
          {getIcon()}
        </div>

        {/* Heading */}
        <h1 className="text-2xl font-bold text-center mb-4">
          {getHeading()}
        </h1>

        {/* Reference */}
        <div className="bg-muted rounded-lg p-3 mb-4">
          <p className="text-center font-mono text-sm">
            REF: {ref?.toUpperCase()}
          </p>
        </div>

        {/* Message */}
        <p className="text-center text-muted-foreground mb-6">
          {getMessage()}
        </p>

        {/* Instructions (pending only) */}
        {status === 'pending' && (method === 'ecocash' || method === 'onemoney') && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
            <p className="text-sm text-blue-900 text-center">
              Dial *151# if you missed the prompt
            </p>
          </div>
        )}

        {/* Auto-checking message (pending only) */}
        {status === 'pending' && (
          <p className="text-center text-sm text-muted-foreground mb-6">
            Auto-checking every 5 seconds...
          </p>
        )}

        {/* Action Button */}
        <Button
          onClick={() => navigate('/')}
          variant={status === 'success' ? 'default' : 'outline'}
          className="w-full"
        >
          {status === 'success' ? 'Back to Marketplace' : 'Back to Home'}
        </Button>

        {/* Retry button (failed only) */}
        {status === 'failed' && (
          <Button
            onClick={() => navigate(-1)}
            className="w-full mt-3"
          >
            Try Again
          </Button>
        )}
      </div>
    </div>
  );
}
