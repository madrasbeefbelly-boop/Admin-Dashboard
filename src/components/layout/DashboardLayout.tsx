import { useState, type ReactNode } from 'react';
import { Header } from './Header';
import { MobileBottomNav } from './MobileBottomNav';
import { Sidebar } from './Sidebar';
import { cn } from '@/lib/utils';

interface DashboardLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
}

export function DashboardLayout({ children, title, subtitle }: DashboardLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      className={cn(
        'min-h-dvh md:grid bg-[#fafafb]',
        collapsed ? 'md:grid-cols-[4.75rem_minmax(0,1fr)]' : 'md:grid-cols-[16rem_minmax(0,1fr)]'
      )}
    >
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((value) => !value)} />
      <div className="min-w-0 flex flex-col min-h-dvh bg-[#fafafb]">
        <Header title={title} subtitle={subtitle} />
        <main className="mx-auto w-full max-w-[96rem] flex-1 px-4 pt-4 pb-[calc(5rem+env(safe-area-inset-bottom))] sm:px-6 sm:pt-6 md:pb-6 xl:p-8">
          {children}
        </main>
      </div>
      <MobileBottomNav />
    </div>
  );
}
