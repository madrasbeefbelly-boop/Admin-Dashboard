import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  Bell,
  Settings,
  LogOut,
  Loader2,
} from 'lucide-react';
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
import { dashboardNavigation } from './navigation';
import { cn } from '@/lib/utils';

interface HeaderProps {
  title: string;
  subtitle?: string;
  hideMobileSubtitle?: boolean;
}

export function Header({ title, subtitle, hideMobileSubtitle }: HeaderProps) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [showNotifications, setShowNotifications] = useState(false);

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
    : profile?.name || 'Admin';

  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join('') || 'MB';

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

        {/* Right utility icons with real data counters only */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <nav aria-label="Dashboard shortcuts" className="flex items-center gap-0.5 sm:gap-1">
            {dashboardNavigation.map(({ name, href, icon: Icon, headerVisibility }) => (
              <NavLink
                key={href}
                to={href}
                end={href === '/'}
                aria-label={name}
                title={name}
                className={cn(
                  'flex rounded-xl p-2 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800 aria-[current=page]:text-primary',
                  headerVisibility,
                )}
              >
                <Icon className="size-5" aria-hidden="true" />
              </NavLink>
            ))}
          </nav>

          <DropdownMenu onOpenChange={(open) => { if (!open) setShowNotifications(false); }}>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="relative flex items-center gap-2 pl-2 pr-1 py-1 rounded-full hover:bg-slate-100 transition-colors cursor-pointer"
                aria-label={unreadCount > 0 ? `User account, ${unreadCount} unread notifications` : 'User account'}
              >
                <div className="size-8 rounded-full bg-rose-100 border border-rose-200 text-[#e11d48] font-bold flex items-center justify-center text-xs shadow-xs overflow-hidden">
                  {profileLoading ? (
                    <Loader2 className="size-4 animate-spin text-[#e11d48]" />
                  ) : (
                    <span>{initials}</span>
                  )}
                </div>
                {unreadCount > 0 && (
                  <span aria-hidden="true" className="absolute right-0 top-0 size-2 rounded-full bg-primary ring-2 ring-background" />
                )}
                <span className="hidden sm:inline-block text-xs font-semibold text-slate-700 max-w-[90px] truncate">
                  {displayName}
                </span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <div className="px-4 py-3 border-b border-border">
                <p className="font-semibold text-sm text-foreground">{displayName}</p>
                <p className="text-xs text-muted-foreground mt-0.5 truncate">{user?.email}</p>
                <p className="text-[11px] text-[#e11d48] font-bold mt-1 capitalize">
                  {user?.role || 'Manager'}
                </p>
              </div>
              <DropdownMenuItem
                aria-expanded={showNotifications}
                onSelect={(event) => {
                  event.preventDefault();
                  setShowNotifications((visible) => !visible);
                }}
              >
                <Bell className="mr-2 size-4" aria-hidden="true" />
                Notifications{unreadCount > 0 && ` (${unreadCount})`}
              </DropdownMenuItem>
              {showNotifications && (
                <div className="border-b border-border bg-muted/60">
                  {unreadCount > 0 && (
                    <DropdownMenuItem onSelect={(event) => {
                      event.preventDefault();
                      markAllAsRead();
                    }}>
                      Mark all as read
                    </DropdownMenuItem>
                  )}
                  {notifications.length === 0 ? (
                    <p className="px-3 py-4 text-sm text-muted-foreground">No notifications.</p>
                  ) : (
                    <div className="max-h-60 overflow-y-auto">
                      {notifications.map((notification) => (
                        <DropdownMenuItem
                          key={notification.id}
                          className="flex-col items-start gap-1 px-3 py-2"
                          onSelect={() => handleNotificationClick(notification)}
                        >
                          <span className={cn('text-xs', !notification.is_read && 'font-semibold')}>
                            {notification.title}
                          </span>
                          <span className="text-xs text-muted-foreground">{notification.message}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                          </span>
                        </DropdownMenuItem>
                      ))}
                    </div>
                  )}
                </div>
              )}
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
