import { useState } from "react";
import { useParams, useNavigate } from "react-router";
import { ArrowLeft, Heart, Share2, MapPin, Star, MessageCircle, Trophy, Loader2 } from "lucide-react";
import { useLivestockItem } from "../../hooks/useLivestock";
import { useBids, usePlaceBid } from "../../hooks/useBids";
import { useAuthStore } from "../../stores/authStore";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Separator } from "./ui/separator";
import { toast } from "sonner";

export function ItemDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [bidAmount, setBidAmount] = useState('');
  const user = useAuthStore((s) => s.user);

  const { data: item, isLoading } = useLivestockItem(id);
  const { data: bids } = useBids(id);
  const placeBid = usePlaceBid();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!item) {
    return <div className="p-4"><p>Item not found</p></div>;
  }

  // Normalize data for both mock and Supabase formats
  const currentBid = item.currentBid ?? (item as any).current_bid ?? 0;
  const startingPrice = item.startingPrice ?? (item as any).starting_price ?? 0;
  const imageUrl = item.imageUrl ?? (item as any).image_urls?.[0] ?? '';
  const status = item.status ?? 'active';
  const minBid = currentBid + 50;

  const getSellerInfo = () => {
    if (item.seller) return item.seller;
    if ((item as any).profiles) {
      const p = (item as any).profiles;
      return {
        name: `${p.first_name} ${p.last_name?.charAt(0) || ''}.`,
        avatar: `${p.first_name?.charAt(0) || ''}${p.last_name?.charAt(0) || ''}`,
        verified: p.verified,
        rating: p.rating,
        salesCount: p.sales_count,
      };
    }
    return { name: 'Seller', avatar: 'S', verified: false, rating: 0, salesCount: 0 };
  };

  const seller = getSellerInfo();

  const getTimeLeft = () => {
    if (item.timeLeft) return item.timeLeft;
    if ((item as any).end_time) {
      const diff = new Date((item as any).end_time).getTime() - Date.now();
      if (diff <= 0) return 'Ended';
      const hours = Math.floor(diff / (1000 * 60 * 60));
      if (hours < 24) return `${hours}h`;
      return `${Math.floor(hours / 24)}d`;
    }
    return '';
  };

  // Normalize bids for display
  const displayBids = (bids || item.bids || []).map((b: any) => ({
    id: b.id,
    userName: b.userName ?? `${b.profiles?.first_name || ''} ${b.profiles?.last_name?.charAt(0) || ''}.`,
    amount: b.amount,
    isWinner: b.isWinner ?? b.is_winner,
    userId: b.userId ?? b.user_id,
  }));

  const isWinner = displayBids.some((b: any) => {
    const bidUserId = b.userId;
    const currentUserId = user?.id || 'user-1';
    return bidUserId === currentUserId && b.isWinner;
  });

  const handlePlaceBid = async () => {
    const amount = parseInt(bidAmount);
    if (amount < minBid) return;

    if (!user) {
      navigate('/auth');
      return;
    }

    try {
      await placeBid.mutateAsync({ livestockId: id!, amount });
      toast.success(`Bid placed: $${amount}`);
      setBidAmount('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to place bid');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 bg-background z-10 border-b p-4 flex items-center justify-between">
        <button onClick={() => navigate('/')} className="flex items-center gap-2">
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>
        <div className="flex items-center gap-3">
          <button className="p-2 hover:bg-muted rounded-full"><Heart className="w-5 h-5" /></button>
          <button className="p-2 hover:bg-muted rounded-full"><Share2 className="w-5 h-5" /></button>
        </div>
      </div>

      <div className="pb-32">
        <div className="relative aspect-[4/3] bg-muted">
          <img src={imageUrl} alt={item.title} className="w-full h-full object-cover" />
          <div className="absolute bottom-3 left-3">
            <Badge className="bg-black/70 text-white border-0">{item.breed}</Badge>
          </div>
          <div className="absolute bottom-3 right-3">
            <Badge variant="destructive" className="font-semibold">{getTimeLeft()} ⏱</Badge>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div>
            <h1 className="text-2xl font-bold">{item.title}</h1>
            <p className="text-2xl font-bold text-primary mt-1">Current Bid: ${currentBid.toLocaleString()}</p>
            <p className="text-sm text-muted-foreground mt-1">Starting: ${startingPrice.toLocaleString()}</p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="bg-muted rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Age</p>
              <p className="font-semibold mt-1">{item.age}</p>
            </div>
            <div className="bg-muted rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Weight</p>
              <p className="font-semibold mt-1">{item.weight}</p>
            </div>
            <div className="bg-muted rounded-lg p-3 text-center">
              <p className="text-xs text-muted-foreground">Location</p>
              <p className="font-semibold mt-1">{item.location}</p>
            </div>
          </div>

          <div className="bg-card border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="w-12 h-12">
                  <AvatarFallback className="bg-primary text-primary-foreground">{seller.avatar}</AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-1">
                    <span className="font-semibold">{seller.name}</span>
                    {seller.verified && <Badge variant="secondary" className="text-xs">✓</Badge>}
                  </div>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                    <span>{seller.rating}</span>
                    <span>•</span>
                    <span>{seller.salesCount} sales</span>
                  </div>
                </div>
              </div>
              <Button size="sm" variant="outline">
                <MessageCircle className="w-4 h-4 mr-1" />Chat
              </Button>
            </div>
          </div>

          <div>
            <h3 className="font-semibold mb-2">Description</h3>
            <p className="text-muted-foreground">{item.description}</p>
          </div>

          <Separator />

          <div>
            <h3 className="font-semibold mb-3">Bid History</h3>
            <div className="space-y-2">
              {displayBids.map((bid: any) => (
                <div
                  key={bid.id}
                  className={`flex items-center justify-between p-3 rounded-lg ${bid.isWinner ? 'bg-primary/10 border border-primary' : 'bg-muted'}`}
                >
                  <div className="flex items-center gap-2">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="bg-muted-foreground text-white text-xs">{bid.userName.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{bid.userName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">${bid.amount.toLocaleString()}</span>
                    {bid.isWinner && <Trophy className="w-4 h-4 text-primary" />}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="fixed bottom-16 left-0 right-0 bg-card border-t shadow-lg max-w-[480px] mx-auto">
        {status === 'active' ? (
          <div className="p-4 space-y-2">
            <p className="text-sm text-muted-foreground">Minimum bid: ${minBid.toLocaleString()}</p>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                <Input
                  type="number"
                  placeholder={minBid.toString()}
                  value={bidAmount}
                  onChange={(e) => setBidAmount(e.target.value)}
                  className="pl-7"
                />
              </div>
              <Button
                onClick={handlePlaceBid}
                disabled={!bidAmount || parseInt(bidAmount) < minBid || placeBid.isPending}
                className="px-8"
              >
                {placeBid.isPending ? 'Bidding...' : 'Bid Now'}
              </Button>
            </div>
          </div>
        ) : isWinner ? (
          <div className="p-4">
            <Button onClick={() => navigate(`/checkout/${item.id}`)} className="w-full bg-green-600 hover:bg-green-700">
              Pay ${currentBid.toLocaleString()} — Paynow
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
