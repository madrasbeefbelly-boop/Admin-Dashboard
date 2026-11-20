import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatCard } from '@/components/dashboard/StatCard';
import { LowStockAlert } from '@/components/dashboard/LowStockAlert';
import { AnalyticsCharts } from '@/components/dashboard/AnalyticsCharts';
import { Button } from '@/components/ui/button';
import { useDashboardStats, useLowStockItems } from '@/hooks/api';
import { Loader2, Package, ShoppingCart, TrendingUp, TriangleAlert } from 'lucide-react';

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export default function Index() {
  const stats = useDashboardStats();
  const lowStock = useLowStockItems();
  const loading = stats.isPending || lowStock.isPending;
  const error = stats.isError || lowStock.isError;
  const data = stats.data;

  return (
    <DashboardLayout title="Dashboard" subtitle="Welcome back">
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 aria-label="Loading dashboard" className="size-8 animate-spin text-gold" />
        </div>
      ) : error ? (
        <div className="card-premium p-8 text-center text-destructive">
          <p>Failed to load dashboard data.</p>
          <Button onClick={() => { void stats.refetch(); void lowStock.refetch(); }} className="mt-4">Try again</Button>
        </div>
      ) : (
        <>
          <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard title="Inventory Items" value={Number(data?.inventory_count ?? 0)} icon={Package} />
            <StatCard title="Inventory Value" value={currency.format(Number(data?.inventory_value ?? 0))} icon={TrendingUp} variant="gold" />
            <StatCard title="Low Stock Items" value={Number(data?.low_stock_count ?? 0)} icon={TriangleAlert}
              variant={Number(data?.low_stock_count ?? 0) > 0 ? 'warning' : 'success'} />
            <StatCard title="Logged Purchases" value={Number(data?.purchase_count ?? 0)} icon={ShoppingCart} />
          </div>
          <AnalyticsCharts />
          <LowStockAlert items={(lowStock.data ?? []).slice(0, 5)} />
        </>
      )}
    </DashboardLayout>
  );
}
