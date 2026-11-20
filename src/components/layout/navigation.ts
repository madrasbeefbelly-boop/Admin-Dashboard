import { Calculator, ClipboardList, LayoutDashboard, Package, Settings, ShoppingCart, UtensilsCrossed } from 'lucide-react';

export const dashboardNavigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard, headerVisibility: 'hidden md:flex' },
  { name: 'Orders', href: '/orders', icon: ClipboardList, hasBadge: true },
  { name: 'Menus', href: '/menu', icon: UtensilsCrossed, hasChevron: true, headerVisibility: 'hidden sm:flex' },
  { name: 'Inventory', href: '/inventory', icon: Package, headerVisibility: 'hidden xl:flex' },
  { name: 'Purchases', href: '/purchases', icon: ShoppingCart, headerVisibility: 'hidden xl:flex' },
  { name: 'Profit Calculator', href: '/profit', icon: Calculator, headerVisibility: 'hidden xl:flex' },
  { name: 'Settings', href: '/settings', icon: Settings },
];

export const newOrderTarget = 'new-order';
