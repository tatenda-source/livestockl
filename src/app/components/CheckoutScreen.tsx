import { useState } from "react";
import { useParams, useNavigate } from "react-router";
import { ArrowLeft, Lock } from "lucide-react";
import { mockLivestock, currentUser } from "../data/mockData";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { RadioGroup, RadioGroupItem } from "./ui/radio-group";
import { Separator } from "./ui/separator";

type PaymentMethod = 'ecocash' | 'onemoney' | 'card';

export function CheckoutScreen() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('ecocash');
  const [phoneNumber, setPhoneNumber] = useState(currentUser.phone);

  const item = mockLivestock.find(i => i.id === id);

  if (!item) {
    return <div className="p-4">Item not found</div>;
  }

  const platformFee = Math.round(item.currentBid * 0.05);
  const total = item.currentBid + platformFee;

  const handlePay = () => {
    // Generate payment reference
    const ref = `ZL-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
    navigate(`/payment-status/${ref}?method=${paymentMethod}&amount=${total}`);
  };

  const getInstructions = () => {
    switch (paymentMethod) {
      case 'ecocash':
        return "You'll receive a USSD prompt on your phone. Dial *151# if you miss it.";
      case 'onemoney':
        return "You'll receive a USSD prompt on your phone. Follow the instructions to complete payment.";
      case 'card':
        return "You'll be redirected to Paynow's secure payment page.";
      default:
        return "";
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 bg-background z-10 border-b p-4 flex items-center gap-3">
        <button onClick={() => navigate(-1)}>
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="font-semibold text-lg">Checkout</h1>
      </div>

      {/* Content */}
      <div className="p-4 space-y-6 pb-32">
        {/* Order Summary */}
        <div>
          <h2 className="font-semibold mb-3">ORDER SUMMARY</h2>
          <div className="bg-card border rounded-lg p-4 flex gap-3">
            <div className="w-20 h-20 bg-muted rounded-lg overflow-hidden flex-shrink-0">
              <img
                src={item.imageUrl}
                alt={item.title}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold truncate">{item.title}</h3>
              <p className="text-sm text-muted-foreground">{item.breed}</p>
              <p className="text-sm text-muted-foreground">{item.location}</p>
            </div>
          </div>
        </div>

        {/* Price Breakdown */}
        <div className="space-y-3">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Winning Bid</span>
            <span className="font-semibold">${item.currentBid.toLocaleString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Platform Fee (5%)</span>
            <span className="font-semibold">${platformFee.toLocaleString()}</span>
          </div>
          <Separator />
          <div className="flex justify-between text-lg">
            <span className="font-semibold">Total</span>
            <span className="font-bold text-primary">${total.toLocaleString()}</span>
          </div>
        </div>

        <Separator className="my-6" />

        {/* Payment Method */}
        <div>
          <h2 className="font-semibold mb-3">PAYMENT METHOD</h2>
          <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
            <div className="space-y-3">
              {/* EcoCash */}
              <label
                htmlFor="ecocash"
                className={`flex items-center gap-3 border rounded-lg p-4 cursor-pointer transition-colors ${
                  paymentMethod === 'ecocash' ? 'border-primary bg-primary/5' : 'hover:border-muted-foreground'
                }`}
              >
                <RadioGroupItem value="ecocash" id="ecocash" />
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded bg-[#00A651] flex items-center justify-center text-white font-bold text-xs">
                    EC
                  </div>
                  <span className="font-medium">EcoCash</span>
                </div>
              </label>

              {/* OneMoney */}
              <label
                htmlFor="onemoney"
                className={`flex items-center gap-3 border rounded-lg p-4 cursor-pointer transition-colors ${
                  paymentMethod === 'onemoney' ? 'border-primary bg-primary/5' : 'hover:border-muted-foreground'
                }`}
              >
                <RadioGroupItem value="onemoney" id="onemoney" />
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded bg-[#0072BC] flex items-center justify-center text-white font-bold text-xs">
                    OM
                  </div>
                  <span className="font-medium">OneMoney</span>
                </div>
              </label>

              {/* Card */}
              <label
                htmlFor="card"
                className={`flex items-center gap-3 border rounded-lg p-4 cursor-pointer transition-colors ${
                  paymentMethod === 'card' ? 'border-primary bg-primary/5' : 'hover:border-muted-foreground'
                }`}
              >
                <RadioGroupItem value="card" id="card" />
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded bg-primary flex items-center justify-center text-white font-bold text-xs">
                    PN
                  </div>
                  <span className="font-medium">Pay Online (Card)</span>
                </div>
              </label>
            </div>
          </RadioGroup>
        </div>

        {/* Phone Input (for mobile payments only) */}
        {(paymentMethod === 'ecocash' || paymentMethod === 'onemoney') && (
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                📱
              </span>
              <Input
                id="phone"
                type="tel"
                placeholder="0771 234 567"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex gap-2">
            <span className="text-blue-600">ℹ️</span>
            <p className="text-sm text-blue-900">{getInstructions()}</p>
          </div>
        </div>
      </div>

      {/* Fixed Bottom CTA */}
      <div className="fixed bottom-16 left-0 right-0 bg-card border-t shadow-lg max-w-[480px] mx-auto">
        <div className="p-4 space-y-2">
          <Button onClick={handlePay} className="w-full h-12 text-lg font-semibold">
            Pay ${total.toLocaleString()}
          </Button>
          <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
            <Lock className="w-3 h-3" />
            <span>Secured by Paynow</span>
          </div>
        </div>
      </div>
    </div>
  );
}
