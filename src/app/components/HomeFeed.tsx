import { useState } from "react";
import { useNavigate } from "react-router";
import { Heart, MapPin, User, Eye, MessageCircle, Gavel, CheckCircle } from "lucide-react";
import { mockLivestock, categories, type Livestock } from "../data/mockData";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Avatar, AvatarFallback } from "./ui/avatar";

export function HomeFeed() {
  const navigate = useNavigate();
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [favorites, setFavorites] = useState<Set<string>>(new Set());

  const filteredLivestock = selectedCategory === 'All'
    ? mockLivestock
    : mockLivestock.filter(item => item.category === selectedCategory);

  const toggleFavorite = (id: string) => {
    setFavorites(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-background pb-4">
      {/* Sticky Header */}
      <div className="sticky top-0 bg-background z-10 border-b shadow-sm">
        <div className="p-4">
          <h1 className="text-xl font-semibold">Livestock Marketplace</h1>
          <p className="text-sm text-muted-foreground">Find your next animal</p>
        </div>

        {/* Category Filter Pills */}
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

      {/* Livestock Cards */}
      <div className="px-4 pt-4 space-y-4">
        {filteredLivestock.map(item => (
          <LivestockCard
            key={item.id}
            item={item}
            isFavorite={favorites.has(item.id)}
            onToggleFavorite={() => toggleFavorite(item.id)}
            onCardClick={() => navigate(`/item/${item.id}`)}
            onBidClick={() => navigate(`/item/${item.id}`)}
          />
        ))}
      </div>
    </div>
  );
}

interface LivestockCardProps {
  item: Livestock;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  onCardClick: () => void;
  onBidClick: () => void;
}

function LivestockCard({ item, isFavorite, onToggleFavorite, onCardClick, onBidClick }: LivestockCardProps) {
  return (
    <div className="bg-card rounded-lg shadow-md overflow-hidden border">
      {/* Image Section */}
      <div className="relative aspect-[4/3] bg-muted cursor-pointer" onClick={onCardClick}>
        <img
          src={item.imageUrl}
          alt={item.title}
          className="w-full h-full object-cover"
        />
        
        {/* Breed Badge (bottom-left) */}
        <div className="absolute bottom-2 left-2">
          <Badge className="bg-black/70 text-white border-0">
            {item.breed}
          </Badge>
        </div>
        
        {/* Time Left Badge (bottom-right) */}
        <div className="absolute bottom-2 right-2">
          <Badge variant="destructive" className="font-semibold">
            {item.timeLeft} ⏱
          </Badge>
        </div>
        
        {/* Favorite Button (top-right) */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleFavorite();
          }}
          className="absolute top-2 right-2 w-8 h-8 bg-white/90 rounded-full flex items-center justify-center shadow-md hover:bg-white transition-colors"
        >
          <Heart
            className={`w-5 h-5 ${isFavorite ? 'fill-red-500 text-red-500' : 'text-gray-600'}`}
          />
        </button>
      </div>

      {/* Content Section */}
      <div className="p-4 space-y-3">
        {/* Title & Bid */}
        <div>
          <h3 className="font-semibold text-lg">{item.title}</h3>
          <p className="text-xl font-bold text-primary">
            Current Bid: ${item.currentBid.toLocaleString()}
          </p>
        </div>

        {/* Details Row */}
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

        {/* Seller Info */}
        <div className="flex items-center gap-2">
          <Avatar className="w-8 h-8">
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
              {item.seller.avatar}
            </AvatarFallback>
          </Avatar>
          <div className="flex items-center gap-1">
            <span className="text-sm font-medium">{item.seller.name}</span>
            {item.seller.verified && (
              <CheckCircle className="w-4 h-4 text-primary fill-primary" />
            )}
          </div>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            <Gavel className="w-4 h-4" />
            <span>{item.bidCount} bids</span>
          </div>
          <div className="flex items-center gap-1">
            <Eye className="w-4 h-4" />
            <span>{item.viewCount} views</span>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="outline"
            className="flex-1"
            onClick={(e) => {
              e.stopPropagation();
              // Message functionality
            }}
          >
            <MessageCircle className="w-4 h-4 mr-2" />
            Message
          </Button>
          <Button
            className="flex-1"
            onClick={(e) => {
              e.stopPropagation();
              onBidClick();
            }}
          >
            Place Bid
          </Button>
        </div>
      </div>
    </div>
  );
}
