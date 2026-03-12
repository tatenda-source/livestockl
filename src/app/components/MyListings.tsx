import { useState } from "react";
import { useNavigate } from "react-router";
import { MessageCircle, Edit, Trash2 } from "lucide-react";
import { mockLivestock, currentUser } from "../data/mockData";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";
import { Button } from "./ui/button";
import { Badge } from "./ui/badge";

export function MyListings() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('selling');

  // Mock user's selling items
  const sellingItems = mockLivestock.slice(0, 2);
  
  // Mock user's won items (items where user has winning bid)
  const wonItems = mockLivestock.filter(item =>
    item.bids.some(bid => bid.userId === currentUser.id && bid.isWinner)
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 bg-background z-10 border-b p-4">
        <h1 className="font-semibold text-lg">My Marketplace</h1>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="p-4">
        <TabsList className="grid w-full grid-cols-2 mb-4">
          <TabsTrigger value="selling">Selling</TabsTrigger>
          <TabsTrigger value="won">Won</TabsTrigger>
        </TabsList>

        <TabsContent value="selling" className="space-y-4">
          {sellingItems.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">No active listings</p>
              <Button onClick={() => navigate('/post')}>
                Post Your First Listing
              </Button>
            </div>
          ) : (
            sellingItems.map(item => (
              <div key={item.id} className="bg-card border rounded-lg p-4">
                <div className="flex gap-3">
                  <div className="w-20 h-20 bg-muted rounded-lg overflow-hidden flex-shrink-0">
                    <img
                      src={item.imageUrl}
                      alt={item.title}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold truncate">{item.title}</h3>
                    <p className="text-lg font-bold text-primary">
                      ${item.currentBid.toLocaleString()}
                    </p>
                    <Badge variant={item.status === 'active' ? 'default' : 'secondary'}>
                      {item.status === 'active' ? 'Active' : 'Ended'}
                    </Badge>
                    <p className="text-sm text-muted-foreground mt-1">
                      {item.bidCount} bids • {item.viewCount} views
                    </p>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <Button variant="outline" size="sm" className="flex-1">
                    <Edit className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1">
                    <Trash2 className="w-4 h-4 mr-1" />
                    Delete
                  </Button>
                </div>
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="won" className="space-y-4">
          {wonItems.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground mb-4">No won auctions</p>
              <Button onClick={() => navigate('/')}>
                Browse Listings
              </Button>
            </div>
          ) : (
            wonItems.map(item => {
              const winningBid = item.bids.find(b => b.userId === currentUser.id && b.isWinner);
              return (
                <div key={item.id} className="bg-card border rounded-lg p-4">
                  <div className="flex gap-3">
                    <div className="w-20 h-20 bg-muted rounded-lg overflow-hidden flex-shrink-0">
                      <img
                        src={item.imageUrl}
                        alt={item.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold truncate">{item.title}</h3>
                      <p className="text-lg font-bold text-primary">
                        Won at ${winningBid?.amount.toLocaleString()}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {item.location} • {item.breed}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Button
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      onClick={() => navigate(`/checkout/${item.id}`)}
                    >
                      Pay Now
                    </Button>
                    <Button variant="outline" className="flex-1">
                      <MessageCircle className="w-4 h-4 mr-1" />
                      Chat
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
