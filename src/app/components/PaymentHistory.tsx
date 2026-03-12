import { CheckCircle, Clock } from "lucide-react";
import { mockPayments } from "../data/mockData";
import { Badge } from "./ui/badge";

export function PaymentHistory() {
  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(date);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 bg-background z-10 border-b p-4">
        <h1 className="font-semibold text-lg">Payment History</h1>
      </div>

      {/* Payment List */}
      <div className="p-4 space-y-3">
        {mockPayments.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">No payment history</p>
          </div>
        ) : (
          mockPayments.map(payment => (
            <div key={payment.id} className="bg-card border rounded-lg p-4">
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  {payment.status === 'paid' ? (
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  ) : payment.status === 'pending' ? (
                    <Clock className="w-5 h-5 text-yellow-600" />
                  ) : (
                    <CheckCircle className="w-5 h-5 text-red-600" />
                  )}
                  <div>
                    <p className="font-semibold font-mono text-sm">
                      {payment.reference}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {payment.method} • {formatDate(payment.date)}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold">
                    ${payment.amount.toLocaleString()}
                  </p>
                  <Badge
                    variant={
                      payment.status === 'paid'
                        ? 'default'
                        : payment.status === 'pending'
                        ? 'secondary'
                        : 'destructive'
                    }
                    className="mt-1"
                  >
                    {payment.status === 'paid' ? 'Paid ✓' : payment.status === 'pending' ? 'Pending' : 'Failed'}
                  </Badge>
                </div>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                {payment.itemTitle}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
