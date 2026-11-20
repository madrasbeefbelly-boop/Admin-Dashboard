import { Link, useLocation } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProfile, useOrders } from '@/hooks/api';
import { businessName, businessTagline } from '@/brand';

import { dashboardNavigation, newOrderTarget } from './navigation';

function SidebarLinks({
  collapsed = false,
}: {
  collapsed?: boolean;
}) {
  const location = useLocation();
  const { data: profile } = useProfile();
  const { data: orders = [] } = useOrders();
  const orderCount = orders.length;

  return (
    <div className="flex h-full flex-col justify-between">
      <div>
        {/* Brand Header */}
        <div className={cn('flex items-center justify-between pb-6 pt-1 px-1', collapsed && 'justify-center')}>
          <Link
            to="/"
            className="flex items-center gap-3 min-w-0"
            aria-label={profile?.name || businessName}
          >
            <img src="/brand/Bull-logo.png" alt="" width={40} height={40}
              className="size-10 shrink-0 rounded-xl bg-black object-contain shadow-sm" />
            {!collapsed && (
              <div className="min-w-0">
                <strong className="block text-lg font-bold tracking-tight text-white leading-tight truncate">
                  {profile?.name || businessName}
                </strong>
                <small className="block text-[11px] text-white/80 font-medium truncate">
                  {profile?.tagline || businessTagline}
                </small>
              </div>
            )}
          </Link>
        </div>

        {/* Navigation Items */}
        <nav aria-label="Kitchen operations" className="space-y-1.5 py-2">
          {dashboardNavigation.map(({ name, href, icon: Icon, hasBadge, hasChevron }) => {
            const isActive = location.pathname === href;
            return (
              <Link
                key={href}
                to={href}
                aria-label={name}
                aria-current={isActive ? 'page' : undefined}
                title={collapsed ? name : undefined}
                className={cn(
                  'sidebar-link group',
                  collapsed && 'justify-center px-0',
                  isActive
                    ? collapsed
                      ? 'bg-white text-[#dc2626] font-bold rounded-xl'
                      : 'koki-cutout-tab'
                    : 'text-white/85 hover:text-white hover:bg-white/15'
                )}
              >
                <Icon
                  className={cn(
                    'size-5 shrink-0 transition-transform group-hover:scale-105',
                    isActive ? 'text-[#dc2626]' : 'text-white'
                  )}
                  aria-hidden="true"
                />
                {!collapsed && (
                  <>
                    <span className="flex-1 font-semibold text-[13px]">{name}</span>
                    {hasBadge && orderCount > 0 && (
                      <span
                        className={cn(
                          'text-xs font-bold px-2 py-0.5 rounded-full tabular-nums',
                          isActive
                            ? 'bg-red-100 text-[#dc2626]'
                            : 'bg-white/20 text-white'
                        )}
                      >
                        {orderCount}
                      </span>
                    )}
                    {hasChevron && (!hasBadge || orderCount === 0) && (
                      <ChevronRight
                        className={cn(
                          'size-4 opacity-70',
                          isActive ? 'text-[#dc2626]' : 'text-white'
                        )}
                      />
                    )}
                  </>
                )}
              </Link>
            );
          })}
        </nav>
      </div>

      {!collapsed && (
        <div className="pt-4 pb-2">
          <div className="bg-[#991b1b]/60 border border-white/15 rounded-2xl p-4 shadow-inner">
            <Link
              to={'/orders#' + newOrderTarget}
              className="w-full py-2.5 px-3 rounded-xl bg-white text-[#dc2626] hover:bg-white/95 font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm transition-all"
            >
              <Plus className="size-4 stroke-[2.5]" aria-hidden="true" />
              Add Order
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <aside
      className={cn(
        'sticky top-0 hidden h-dvh flex-col bg-[#dc2626] px-3 py-5 text-white transition-all duration-300 md:flex z-30',
        collapsed ? 'w-[4.75rem]' : 'w-[16rem]'
      )}
    >
      <SidebarLinks collapsed={collapsed} />

      {/* Bottom Mini Toggle */}
      <div className="mt-auto pt-2 border-t border-white/10">
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            'flex w-full items-center gap-2 rounded-xl px-2 py-1.5 text-xs font-semibold text-white/80 hover:text-white hover:bg-white/10 transition-colors',
            collapsed && 'justify-center'
          )}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? <ChevronRight className="size-4" /> : <ChevronLeft className="size-4" />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
