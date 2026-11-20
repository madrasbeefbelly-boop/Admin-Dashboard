import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, 
  UtensilsCrossed, 
  Package, 
  ShoppingCart, 
  Calculator,
  ClipboardList,
  Menu,
  ChevronLeft,
  ChevronRight,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProfile } from '@/hooks/api';
import { businessName, businessTagline } from '@/brand';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { useIsMobile } from '@/hooks/use-mobile';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Menu & Costing', href: '/menu', icon: UtensilsCrossed },
  { name: 'Inventory', href: '/inventory', icon: Package },
  { name: 'Purchases', href: '/purchases', icon: ShoppingCart },
  { name: 'New Order', href: '/orders', icon: ClipboardList },
  { name: 'Profit Calculator', href: '/profit', icon: Calculator },
  { name: 'Settings', href: '/settings', icon: Settings },
];

function SidebarLinks({ collapsed = false, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const location = useLocation();
  const { data: profile } = useProfile();

  return (
    <>
      <Link to="/" aria-label={profile?.name || businessName} onClick={onNavigate}
        className={cn('sidebar-brand', collapsed && 'justify-center px-0')}>
        <span className="brand-mark" aria-hidden="true" />
        {!collapsed && (
          <span>
            <strong>{profile?.name || businessName}</strong>
            <small>{profile?.tagline || businessTagline}</small>
          </span>
        )}
      </Link>
      <nav aria-label="Kitchen operations" className="sidebar-nav">
        {navigation.map(({ name, href, icon: Icon }) => (
          <Link key={href} to={href} onClick={onNavigate} aria-label={name}
            aria-current={location.pathname === href ? 'page' : undefined}
            title={collapsed ? name : undefined}
            className={cn('sidebar-link', location.pathname === href && 'sidebar-link-active', collapsed && 'justify-center')}>
            <Icon className="size-5 shrink-0" aria-hidden="true" />
            {!collapsed && <span>{name}</span>}
          </Link>
        ))}
      </nav>
    </>
  );
}

export function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  return (
    <aside className="sticky top-0 hidden h-dvh flex-col bg-[#191615] px-3 py-4 text-[#f7eee8] md:flex">
      <SidebarLinks collapsed={collapsed} />
      <button type="button" onClick={onToggle} className={cn('sidebar-link border-t-[#403331]', collapsed && 'justify-center')}
        aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-expanded={!collapsed}>
        {collapsed ? <ChevronRight className="size-5" /> : <ChevronLeft className="size-5" />}
        {!collapsed && <span>Collapse</span>}
      </button>
    </aside>
  );
}

export function MobileSidebar() {
  const isMobile = useIsMobile();
  return isMobile ? <MobileSidebarDrawer /> : null;
}

function MobileSidebarDrawer() {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button type="button" variant="outline" size="icon" className="shrink-0 md:hidden [&_svg]:size-5" aria-label="Open navigation">
          <Menu aria-hidden="true" />
        </Button>
      </SheetTrigger>
      <SheetContent side="left" className="business-sidebar w-[min(19rem,calc(100vw-2rem))] gap-0 border-r-[#403331] bg-[#191615] px-3 py-4 text-[#f7eee8]" aria-describedby={undefined}>
        <SheetTitle className="sr-only">Kitchen operations</SheetTitle>
        <SidebarLinks onNavigate={() => setOpen(false)} />
      </SheetContent>
    </Sheet>
  );
}
