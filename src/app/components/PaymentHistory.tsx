import { CheckCircle, Clock, Loader2, XCircle } from "lucide-react";
import { usePaymentHistory } from "../../hooks/usePayments";
import { Badge } from "./ui/badge";

export function PaymentHistory() {
  const { data: payments, isLoading } = usePaymentHistory();

  const formatDate = (date: Date | string) => {
    return new Intl.DateTimeFormat('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(new Date(date));
  };

  const getTitle = (payment: any) => payment.itemTitle ?? payment.livestock_items?.title ?? 'Unknown item';

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 bg-background z-10 border-b p-4">
        <h1 className="font-semibold text-lg">Payment History</h1>
      </div>

      <div className="p-4 space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : !payments?.length ? (
          <div className="text-center py-12"><p className="text-muted-foreground">No payment history</p></div>
        ) : (
          payments.map((payment: any) => (
            <div key={payment.id} className="bg-card border rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {payment.status === 'paid' ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : payment.status === 'pending' ? (
                    <Clock className="w-5 h-5 text-yellow-600" />
                  ) : (
                    <XCircle className="w-5 h-5 text-red-600" />
                  )}
                  <div>
                    <p className="font-semibold font-mono text-sm">{payment.reference}</p>
                    <p className="text-sm text-muted-foreground">
                      {payment.method} • {formatDate(payment.date ?? payment.created_at)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold">${payment.amount.toLocaleString()}</p>
                  <Badge
                    variant={payment.status === 'paid' ? 'default' : payment.status === 'pending' ? 'secondary' : 'destructive'}
                    className="mt-1"
                  >
                    {payment.status === 'paid' ? 'Paid ✓' : payment.status === 'pending' ? 'Pending' : 'Failed'}
                  </Badge>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-2">{getTitle(payment)}</p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
