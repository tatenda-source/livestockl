import { useState } from "react";
import { X, CheckCheck, Loader2 } from "lucide-react";
import { useNotifications, useMarkAllRead, useDeleteNotification } from "../../hooks/useNotifications";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";

export function Notifications() {
  const { data: notifications, isLoading } = useNotifications();
  const markAllRead = useMarkAllRead();
  const deleteNotification = useDeleteNotification();
  const [filter, setFilter] = useState<string>('all');

  const items = notifications || [];
  const unreadCount = items.filter((n: any) => !n.read).length;

  const filteredNotifications = filter === 'all'
    ? items
    : items.filter((n: any) => {
        if (filter === 'bids') return n.type === 'bid';
        if (filter === 'messages') return n.type === 'message';
        if (filter === 'auctions') return n.type === 'auction_ending' || n.type === 'auction_won' || n.type === 'auction_lost';
        return true;
      });

  const handleMarkAllRead = () => {
    markAllRead.mutate();
  };

  const dismissNotification = (id: string) => {
    deleteNotification.mutate(id);
  };

  const formatTime = (timestamp: Date | string) => {
    const now = new Date();
    const diff = now.getTime() - new Date(timestamp).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'Just now';
    if (minutes < 60) return `${minutes} min ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days > 1 ? 's' : ''} ago`;
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high': return 'border-l-4 border-l-red-500';
      case 'medium': return 'border-l-4 border-l-yellow-500';
      case 'low': return 'border-l-4 border-l-blue-500';
      default: return '';
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'high': return '🔴';
      case 'medium': return '🟡';
      case 'low': return '🔵';
      default: return '🔵';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="sticky top-0 bg-background z-10 border-b">
        <div className="p-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h1 className="font-semibold text-lg">Notifications</h1>
            {unreadCount > 0 && (
              <Badge variant="destructive" className="rounded-full">{unreadCount}</Badge>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={handleMarkAllRead} disabled={unreadCount === 0}>
            <CheckCheck className="w-4 h-4 mr-1" />Mark all ✓
          </Button>
        </div>

        <div className="px-4 pb-3 overflow-x-auto">
          <div className="flex gap-2 min-w-max">
            {['all', 'bids', 'messages', 'auctions'].map(f => (
              <Badge
                key={f}
                variant={filter === f ? 'default' : 'outline'}
                className="cursor-pointer whitespace-nowrap capitalize"
                onClick={() => setFilter(f)}
              >
                {f === 'all' ? 'All' : f.charAt(0).toUpperCase() + f.slice(1)}
              </Badge>
            ))}
          </div>
        </div>
      </div>

      <div className="p-4 space-y-3">
        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>
        ) : filteredNotifications.length === 0 ? (
          <div className="text-center py-12"><p className="text-muted-foreground">No notifications</p></div>
        ) : (
          filteredNotifications.map((notification: any) => (
            <div
              key={notification.id}
              className={`bg-card border rounded-lg p-4 ${getPriorityColor(notification.priority)} ${!notification.read ? 'bg-primary/5' : ''}`}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">{getPriorityIcon(notification.priority)}</span>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm">{notification.title}</h3>
                  <p className="text-sm text-muted-foreground mt-1">{notification.message}</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    {formatTime(notification.timestamp ?? notification.created_at)}
                  </p>
                </div>
                <button onClick={() => dismissNotification(notification.id)} className="text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
