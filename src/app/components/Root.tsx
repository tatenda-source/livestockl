import { Outlet, useLocation, useNavigate } from "react-router";
import { Home, Plus, List, Bell, CreditCard } from "lucide-react";
import { useUnreadCount } from "../../hooks/useNotifications";

export function Root() {
  const location = useLocation();
  const navigate = useNavigate();
  const { data: unreadCount } = useUnreadCount();

  const navItems = [
    { icon: Home, label: 'Home', path: '/' },
    { icon: Plus, label: 'Post', path: '/post' },
    { icon: List, label: 'List', path: '/my-listings' },
    { icon: Bell, label: 'Alert', path: '/notifications', badge: unreadCount || 0 },
    { icon: CreditCard, label: 'Pay', path: '/payments' },
  ];

  return (
    <div className="h-screen flex flex-col bg-background max-w-[480px] mx-auto">
      <div className="flex-1 overflow-y-auto">
        <Outlet />
      </div>

      <nav className="border-t bg-card shadow-lg">
        <div className="flex items-center justify-around h-16">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = location.pathname === item.path;

            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                className={`flex flex-col items-center justify-center flex-1 h-full relative transition-colors ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                {isActive && (
                  <div className="absolute top-0 left-0 right-0 h-0.5 bg-primary" />
                )}
                <div className="relative">
                  <Icon className="w-5 h-5" />
                  {item.badge && item.badge > 0 && (
                    <span className="absolute -top-1 -right-1 bg-destructive text-destructive-foreground text-xs rounded-full w-4 h-4 flex items-center justify-center">
                      {item.badge}
                    </span>
                  )}
                </div>
                <span className="text-xs mt-1">{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
