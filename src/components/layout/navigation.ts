import { Calculator, ClipboardList, LayoutDashboard, Package, Settings, ShoppingCart, UtensilsCrossed } from 'lucide-react';

export const dashboardNavigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, headerVisibility: 'hidden md:flex', mobileTab: 1 },
  { name: 'Orders', href: '/orders', icon: ClipboardList, hasBadge: true, mobileTab: 3 },
  { name: 'Menus', href: '/menu', icon: UtensilsCrossed, hasChevron: true, headerVisibility: 'hidden sm:flex', mobileTab: 2 },
  { name: 'Inventory', href: '/inventory', icon: Package, headerVisibility: 'hidden xl:flex', mobileTab: 4 },
  { name: 'Purchases', href: '/purchases', icon: ShoppingCart, headerVisibility: 'hidden xl:flex', mobileTab: 5 },
  { name: 'Profit Calculator', href: '/profit', icon: Calculator, headerVisibility: 'hidden xl:flex' },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export const mobileTabs = dashboardNavigation.filter((item) => item.mobileTab != null)
  .sort((a, b) => (a.mobileTab ?? 0) - (b.mobileTab ?? 0));

export const mobileDrawerLinks = dashboardNavigation.filter((item) => item.mobileTab == null);

export const newOrderTarget = 'new-order';
