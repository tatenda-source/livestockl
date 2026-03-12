import { useState } from "react";
import { useNavigate } from "react-router";
import { Heart, MapPin, Eye, MessageCircle, Gavel, CheckCircle, Loader2 } from "lucide-react";
import { categories } from "../data/mockData";
import { useLivestockList } from "../../hooks/useLivestock";
import { useFavorites, useToggleFavorite } from "../../hooks/useFavorites";
import { useStartConversation } from "../../hooks/useMessages";
import { useAuthStore } from "../../stores/authStore";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { toast } from "sonner";

export function HomeFeed() {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState<string>('All');

  const { data: livestock, isLoading, error } = useLivestockList(selectedCategory);
  const { data: favoriteIds = [] } = useFavorites();
  const { mutate: toggleFavorite } = useToggleFavorite();
  const startConversation = useStartConversation();
  const user = useAuthStore((s) => s.user);

  const handleMessage = async (item: any) => {
    if (!user) {
      navigate('/auth');
      return;
    }
    const sellerId = item.seller_id || item.sellerId;
    if (!sellerId) {
      toast.error('Seller information unavailable');
      return;
    }
    try {
      const conv = await startConversation.mutateAsync({ sellerId, livestockId: item.id });
      navigate(`/messages/${conv.id}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to start conversation');
    }
  };

  const getSellerInfo = (item: any) => {
    // Handle both mock data format and Supabase joined format
    if (item.seller) return item.seller;
    if (item.profiles) {
      const p = item.profiles;
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

  const getTimeLeft = (item: any) => {
    if (item.timeLeft) return item.timeLeft;
    if (item.end_time) {
      const diff = new Date(item.end_time).getTime() - Date.now();
      if (diff <= 0) return 'Ended';
      const hours = Math.floor(diff / (1000 * 60 * 60));
      if (hours < 24) return `${hours}h`;
      return `${Math.floor(hours / 24)}d`;
    }
    return '';
  };

  const getCurrentBid = (item: any) => item.currentBid ?? item.current_bid ?? 0;
  const getImageUrl = (item: any) => item.imageUrl ?? item.image_urls?.[0] ?? '';
  const getBidCount = (item: any) => item.bidCount ?? item.bid_count ?? 0;
  const getViewCount = (item: any) => item.viewCount ?? item.view_count ?? 0;
  const getStartingPrice = (item: any) => item.startingPrice ?? item.starting_price ?? 0;

  return (
    <div className="min-h-screen bg-background pb-4">
      <div className="sticky top-0 bg-background z-10 border-b shadow-sm">
        <div className="p-4">
          <h1 className="text-xl font-semibold">Livestock Marketplace</h1>
          <p className="text-sm text-muted-foreground">Find your next animal</p>
        </div>

        <div className="px-4 pb-3 overflow-x-auto">
          <div className="flex gap-2 min-w-max">
            <Badge
              variant={selectedCategory === 'All' ? 'default' : 'outline'}
              className="cursor-pointer whitespace-nowrap"
              onClick={() => setSelectedCategory('All')}
            >
              All
            </Badge>
            {categories.map(cat => (
              <Badge
                key={cat}
                variant={selectedCategory === cat ? 'default' : 'outline'}
                className="cursor-pointer whitespace-nowrap"
                onClick={() => setSelectedCategory(cat)}
              >
                {cat}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 pt-4 space-y-4">
        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : error ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>Failed to load listings</p>
          </div>
        ) : !livestock?.length ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>No listings found</p>
          </div>
        ) : (
          livestock.map((item: any) => {
            const seller = getSellerInfo(item);
            return (
              <div key={item.id} className="bg-card rounded-lg shadow-md overflow-hidden border">
                <div className="relative aspect-[4/3] bg-muted cursor-pointer" onClick={() => navigate(`/item/${item.id}`)}>
                  <img src={getImageUrl(item)} alt={item.title} className="w-full h-full object-cover" />
                  <div className="absolute bottom-2 left-2">
                    <Badge className="bg-black/70 text-white border-0">{item.breed}</Badge>
                  </div>
                  <div className="absolute bottom-2 right-2">
                    <Badge variant="destructive" className="font-semibold">{getTimeLeft(item)} ⏱</Badge>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); toggleFavorite(item.id); }}
                    className="absolute top-2 right-2 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center shadow-md hover:bg-white transition-colors"
                  >
                    <Heart className={`w-5 h-5 ${favoriteIds.includes(item.id) ? 'fill-red-500 text-red-500' : 'text-gray-600'}`} />
                  </button>
                </div>

                <div className="p-4 space-y-3">
                  <div>
                    <h3 className="font-semibold text-lg">{item.title}</h3>
                    <p className="text-xl font-bold text-primary">
                      Current Bid: ${getCurrentBid(item).toLocaleString()}
                    </p>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <MapPin className="w-4 h-4" />
                      <span>{item.location}</span>
                    </div>
                    <span>•</span>
                    <span>{item.age}</span>
                    <span>•</span>
                    <span>{item.weight}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="bg-primary text-primary-foreground text-xs">
                        {seller.avatar}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex items-center gap-1">
                      <span className="text-sm font-medium">{seller.name}</span>
                      {seller.verified && <CheckCircle className="w-4 h-4 text-primary fill-primary" />}
                    </div>
                  </div>

                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Gavel className="w-4 h-4" />
                      <span>{getBidCount(item)} bids</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Eye className="w-4 h-4" />
                      <span>{getViewCount(item)} views</span>
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button variant="outline" className="flex-1" onClick={(e) => { e.stopPropagation(); handleMessage(item); }} disabled={startConversation.isPending}>
                      <MessageCircle className="w-4 h-4 mr-2" />
                      Message
                    </Button>
                    <Button className="flex-1" onClick={(e) => { e.stopPropagation(); navigate(`/item/${item.id}`); }}>
                      Place Bid
                    </Button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
