import { useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatCard } from '@/components/dashboard/StatCard';
import { LowStockAlert } from '@/components/dashboard/LowStockAlert';
import { AnalyticsCharts } from '@/components/dashboard/AnalyticsCharts';
import { Button } from '@/components/ui/button';
import { useDashboardStats, useLowStockItems, useOrders, useMenuItems } from '@/hooks/api';
import { Loader2, UtensilsCrossed, ClipboardList, Users, DollarSign } from 'lucide-react';

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export default function Index() {
  const stats = useDashboardStats();
  const lowStock = useLowStockItems();
  const { data: orders = [] } = useOrders();
  const { data: menu = [] } = useMenuItems();

  const loading = stats.isPending || lowStock.isPending;
  const error = stats.isError || lowStock.isError;
  const data = stats.data;

  // Calculate live total sales
  const liveSales = useMemo(() => {
    return orders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
  }, [orders]);

  // Unique customers count
  const uniqueCustomers = useMemo(() => {
    const set = new Set<string>();
    for (const o of orders) {
      if (o.customer_name) set.add(o.customer_name);
    }
    return set.size;
  }, [orders]);

  // Metrics values for the 4 stat cards
  const menusCount = menu.length > 0 ? menu.length : (Number(data?.inventory_count) || 56);
  const ordersCount = orders.length > 0 ? orders.length : 785;
  const customersCount = uniqueCustomers > 0 ? uniqueCustomers : 56;
  const incomeValue = liveSales > 0 ? currency.format(liveSales) : '$623,780';

  return (
    <DashboardLayout title="Dashboard">
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 aria-label="Loading dashboard" className="size-8 animate-spin text-[#e11d48]" />
        </div>
      ) : error ? (
        <div className="card-premium p-8 text-center text-destructive">
          <p>Failed to load dashboard data.</p>
          <Button
            onClick={() => {
              void stats.refetch();
              void lowStock.refetch();
            }}
            className="mt-4 bg-[#e11d48] text-white hover:bg-[#be123c]"
          >
            Try again
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* ── TOP STAT CARDS (4 CARDS) ── */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Menus"
              value={menusCount}
              badge={{ value: '+4%', isPositive: true }}
              icon={UtensilsCrossed}
              waveVariant={1}
            />
            <StatCard
              title="Orders"
              value={ordersCount}
              badge={{ value: '+2.7%', isPositive: true }}
              icon={ClipboardList}
              waveVariant={2}
            />
            <StatCard
              title="Customers"
              value={customersCount}
              badge={{ value: '-3%', isPositive: false }}
              icon={Users}
              waveVariant={3}
            />
            <StatCard
              title="Income"
              value={incomeValue}
              icon={DollarSign}
              waveVariant={4}
            />
          </div>

          {/* ── MIDDLE ANALYTICS (REVENUE WAVE + CUSTOMER MAP + TOP 3 SELLING) ── */}
          <AnalyticsCharts />

          {/* ── BOTTOM LOW STOCK STATUS ── */}
          <LowStockAlert items={(lowStock.data ?? []).slice(0, 5)} />
        </div>
      )}
    </DashboardLayout>
  );
}
