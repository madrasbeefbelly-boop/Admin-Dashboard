import { useState, type ReactNode } from 'react';
import { Header } from './Header';
import { Sidebar } from './Sidebar';
import { cn } from '@/lib/utils';

interface DashboardLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
  hideMobileSubtitle?: boolean;
}

export function DashboardLayout({ children, title, subtitle, hideMobileSubtitle }: DashboardLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={cn('min-h-dvh md:grid', collapsed ? 'md:grid-cols-[4.75rem_minmax(0,1fr)]' : 'md:grid-cols-[15.5rem_minmax(0,1fr)]')}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(value => !value)} />
      <div className="min-w-0">
        <Header title={title} subtitle={subtitle} hideMobileSubtitle={hideMobileSubtitle} />
        <main className="mx-auto max-w-[96rem] p-4 sm:p-6 xl:p-8">
          {children}
        </main>
      </div>
    </div>
  );
}
