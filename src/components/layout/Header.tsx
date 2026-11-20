import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bell,
  MessageSquare,
  Gift,
  Settings,
  User,
  LogOut,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useProfile } from '@/hooks/api';
import { useNotifications } from '@/hooks/use-notifications';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { MobileSidebar } from './Sidebar';

interface HeaderProps {
  title: string;
  subtitle?: string;
  hideMobileSubtitle?: boolean;
}

export function Header({ title, subtitle, hideMobileSubtitle }: HeaderProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  // API hooks
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const handleSettingsClick = () => {
    navigate('/settings');
  };

  const handleNotificationClick = (notification: any) => {
    if (!notification.is_read) {
      markAsRead(notification.id);
    }
    if (notification.reference_type === 'Inventory') navigate('/inventory');
  };

  const displayName = user
    ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email?.split('@')[0]
    : 'Admin';

  return (
    <header className="sticky top-0 z-20 bg-[#fafafb]/90 backdrop-blur-md border-b border-slate-100">
      <div className="mx-auto flex max-w-[96rem] items-center justify-between gap-4 px-4 py-3.5 sm:px-6 xl:px-8">
        {/* Title area */}
        <div className="flex min-w-0 items-center gap-3">
          <MobileSidebar />
          <div className="min-w-0">
            <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
              {title}
            </h1>
            {subtitle && (
              <p
                className={
                  hideMobileSubtitle
                    ? 'hidden text-xs text-slate-400 md:block mt-0.5'
                    : 'text-xs text-slate-400 mt-0.5'
                }
              >
                {subtitle}
              </p>
            )}
          </div>
        </div>

        {/* Right utility icons with Koki badge counters */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          {/* 1. Bell Icon with Pink Pill Badge */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="relative p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
                aria-label="Notifications"
              >
                <Bell className="size-5" />
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-[#e11d48] text-[10px] font-bold text-white rounded-full flex items-center justify-center shadow-xs">
                  {unreadCount > 0 ? unreadCount : 12}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 max-md:max-w-[calc(100vw-1rem)]">
              <div className="flex items-center justify-between px-4 py-2 border-b border-border">
                <h4 className="font-semibold text-sm">Notifications</h4>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-[#e11d48] h-auto p-0 hover:bg-transparent hover:text-[#e11d48]/80"
                  onClick={() => markAllAsRead()}
                >
                  Mark all as read
                </Button>
              </div>
              <div className="max-h-[300px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="px-4 py-6 text-center text-xs text-muted-foreground">
                    All caught up! No unread notifications.
                  </div>
                ) : (
                  notifications.map((notification: any) => (
                    <DropdownMenuItem
                      key={notification.id}
                      className="cursor-pointer px-4 py-3 border-b border-border last:border-0 flex-col items-start gap-1"
                      onClick={() => handleNotificationClick(notification)}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className={`font-medium text-xs ${!notification.is_read ? 'text-foreground font-semibold' : 'text-muted-foreground'}`}>
                          {notification.title}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{notification.message}</p>
                    </DropdownMenuItem>
                  ))
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 2. Message Square with Pink Badge */}
          <button
            type="button"
            onClick={() => navigate('/orders')}
            className="relative p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            title="Messages & Customer Feedback"
            aria-label="Messages"
          >
            <MessageSquare className="size-5" />
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-[#e11d48] text-[10px] font-bold text-white rounded-full flex items-center justify-center shadow-xs">
              5
            </span>
          </button>

          {/* 3. Gift Icon with Dark Slate Badge */}
          <button
            type="button"
            onClick={() => navigate('/menu')}
            className="relative p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors hidden sm:flex"
            title="Promotions & Special Offers"
            aria-label="Promotions"
          >
            <Gift className="size-5" />
            <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-[#334155] text-[10px] font-bold text-white rounded-full flex items-center justify-center shadow-xs">
              2
            </span>
          </button>

          {/* 4. Settings Gear with Orange Alert Badge */}
          <button
            type="button"
            onClick={handleSettingsClick}
            className="relative p-2 rounded-xl text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            title="Settings & System Status"
            aria-label="Settings"
          >
            <Settings className="size-5" />
            <span className="absolute -top-1 -right-1 size-[18px] bg-amber-500 text-[10px] font-bold text-white rounded-full flex items-center justify-center shadow-xs">
              !
            </span>
          </button>

          {/* 5. User Profile Pill / Avatar */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-2 pl-2 pr-1 py-1 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label="User account"
              >
                <div className="size-8 rounded-full bg-rose-100 border border-rose-200 text-[#e11d48] font-bold flex items-center justify-center text-xs shadow-xs overflow-hidden">
                  {profileLoading ? (
                    <Loader2 className="size-4 animate-spin text-[#e11d48]" />
                  ) : (
                    <span>{displayName.slice(0, 2).toUpperCase()}</span>
                  )}
                </div>
                <span className="hidden sm:inline-block text-xs font-semibold text-slate-700 max-w-[80px] truncate">
                  {displayName}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-4 py-3 border-b border-border">
                <p className="font-semibold text-sm text-foreground">{displayName}</p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{user?.email}</p>
                <p className="text-[11px] text-[#e11d48] font-bold mt-1 capitalize">{user?.role || 'Manager'}</p>
              </div>
              <DropdownMenuItem onClick={handleSettingsClick} className="cursor-pointer">
                <Settings className="size-4 mr-2" />
                <span>Settings</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive">
                <LogOut className="size-4 mr-2" />
                <span>Logout</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
