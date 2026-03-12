import { useState, useEffect } from 'react';
import { WifiOff, Wifi } from 'lucide-react';

export function ConnectionStatus() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showReconnected, setShowReconnected] = useState(false);

  useEffect(() => {
    const goOnline = () => {
      setIsOnline(true);
      setShowReconnected(true);
      setTimeout(() => setShowReconnected(false), 3000);
    };
    const goOffline = () => setIsOnline(false);

    window.addEventListener('online', goOnline);
    window.addEventListener('offline', goOffline);
    return () => {
      window.removeEventListener('online', goOnline);
      window.removeEventListener('offline', goOffline);
    };
  }, []);

  if (isOnline && !showReconnected) return null;

  return (
    <div className={`fixed top-0 left-0 right-0 z-50 px-4 py-2 text-center text-sm font-medium transition-colors ${
      isOnline
        ? 'bg-green-600 text-white'
        : 'bg-yellow-600 text-white'
    }`}>
      {isOnline ? (
        <span className="flex items-center justify-center gap-2">
          <Wifi className="w-4 h-4" /> Back online
        </span>
      ) : (
        <span className="flex items-center justify-center gap-2">
          <WifiOff className="w-4 h-4" /> No internet -- showing cached data
        </span>
      )}
    </div>
  );
}
