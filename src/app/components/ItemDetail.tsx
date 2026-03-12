import { useState } from "react";
import { useParams, useNavigate } from "react-router";
import { ArrowLeft, Heart, Share2, MapPin, Star, MessageCircle, Trophy } from "lucide-react";
import { mockLivestock, currentUser } from "../data/mockData";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";
import { Input } from "./ui/input";
import { Avatar, AvatarFallback } from "./ui/avatar";
import { Separator } from "./ui/separator";

export function ItemDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [bidAmount, setBidAmount] = useState('');

  const item = mockLivestock.find(i => i.id === id);

  if (!item) {
    return (
      <div className="p-4">
        <p>Item not found</p>
      </div>
    );
  }

  const minBid = item.currentBid + 50;
  const isWinner = item.bids.find(b => b.userId === currentUser.id && b.isWinner);

  const handlePlaceBid = () => {
    const amount = parseInt(bidAmount);
    if (amount >= minBid) {
      // Place bid logic here
      alert(`Bid placed: $${amount}`);
      setBidAmount('');
    }
  };

  const handlePayNow = () => {
    navigate(`/checkout/${item.id}`);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 bg-background z-10 border-b p-4 flex items-center justify-between">
        <button onClick={() => navigate('/')} className="flex items-center gap-2">
          <ArrowLeft className="w-5 h-5" />
          <span>Back</span>
        </button>
        <div className="flex items-center gap-3">
          <button className="p-2 hover:bg-muted rounded-full">
            <Heart className="w-5 h-5" />
          </button>
          <button className="p-2 hover:bg-muted rounded-full">
            <Share2 className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="pb-32">
        {/* Hero Image */}
        <div className="relative aspect-[4/3] bg-muted">
          <img
            src={item.imageUrl}
            alt={item.title}
            className="w-full h-full object-cover"
          />
          
          <div className="absolute bottom-3 left-3">
            <Badge className="bg-black/70 text-white border-0">
              {item.breed}
            </Badge>
          </div>
          
          <div className="absolute bottom-3 right-3">
            <Badge variant="destructive" className="font-semibold">
              {item.timeLeft} ⏱
            </Badge>
          </div>
        </div>

        {/* Item Details */}
        <div className="p-4 space-y-4">
          <div>
            <h1 className="text-2xl font-bold">{item.title}</h1>
            <p className="text-2xl font-bold text-primary mt-1">
              Current Bid: ${item.currentBid.toLocaleString()}
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Starting: ${item.startingPrice.toLocaleString()}
            </p>
          </div>

          {/* Stats Grid */}
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

          {/* Seller Card */}
          <div className="bg-card border rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Avatar className="w-12 h-12">
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {item.seller.avatar}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <div className="flex items-center gap-1">
                    <span className="font-semibold">{item.seller.name}</span>
                    {item.seller.verified && (
                      <Badge variant="secondary" className="text-xs">✓</Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                    <span>{item.seller.rating}</span>
                    <span>•</span>
                    <span>{item.seller.salesCount} sales</span>
                  </div>
                </div>
              </div>
              <Button size="sm" variant="outline">
                <MessageCircle className="w-4 h-4 mr-1" />
                Chat
              </Button>
            </div>
          </div>

          {/* Description */}
          <div>
            <h3 className="font-semibold mb-2">Description</h3>
            <p className="text-muted-foreground">{item.description}</p>
          </div>

          <Separator />

          {/* Bid History */}
          <div>
            <h3 className="font-semibold mb-3">Bid History</h3>
            <div className="space-y-2">
              {item.bids.map((bid) => (
                <div
                  key={bid.id}
                  className={`flex items-center justify-between p-3 rounded-lg ${
                    bid.isWinner ? 'bg-primary/10 border border-primary' : 'bg-muted'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Avatar className="w-8 h-8">
                      <AvatarFallback className="bg-muted-foreground text-white text-xs">
                        {bid.userName.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{bid.userName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">${bid.amount.toLocaleString()}</span>
                    {bid.isWinner && (
                      <Trophy className="w-4 h-4 text-primary" />
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Fixed Bottom Bar */}
      <div className="fixed bottom-16 left-0 right-0 bg-card border-t shadow-lg max-w-[480px] mx-auto">
        {item.status === 'active' ? (
          <div className="p-4 space-y-2">
            <p className="text-sm text-muted-foreground">
              Minimum bid: ${minBid.toLocaleString()}
            </p>
            <div className="flex gap-2">
              <div className="flex-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  $
                </span>
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
                disabled={!bidAmount || parseInt(bidAmount) < minBid}
                className="px-8"
              >
                Bid Now
              </Button>
            </div>
          </div>
        ) : isWinner ? (
          <div className="p-4">
            <Button onClick={handlePayNow} className="w-full bg-green-600 hover:bg-green-700">
              Pay ${item.currentBid.toLocaleString()} — Paynow
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
