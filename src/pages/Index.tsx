import { useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatCard } from '@/components/dashboard/StatCard';
import { LowStockAlert } from '@/components/dashboard/LowStockAlert';
import { AnalyticsCharts } from '@/components/dashboard/AnalyticsCharts';
import { Button } from '@/components/ui/button';
import { useDashboardStats, useLowStockItems, useOrders, useMenuItems } from '@/hooks/api';
import { Loader2, UtensilsCrossed, ClipboardList, Users, DollarSign } from 'lucide-react';
import { isServedOrder } from '@/lib/utils';
import { formatStatCurrency } from '@/lib/stat-series';

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});
const businessDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
});

export default function Index() {
  const stats = useDashboardStats();
  const lowStock = useLowStockItems();
  const { data: orders = [] } = useOrders();
  const { data: menu = [] } = useMenuItems();

  const loading = stats.isPending || lowStock.isPending;
  const error = stats.isError || lowStock.isError;

  // Calculate actual total sales from real orders
  const actualSales = useMemo(() => {
    return orders.filter(isServedOrder).reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
  }, [orders]);

  // Actual unique customers count from real orders
  const uniqueCustomers = useMemo(() => {
    const set = new Set<string>();
    for (const o of orders) {
      if (o.customer_name && o.customer_name.trim().length > 0) {
        set.add(o.customer_name.trim().toLowerCase());
      }
    }
    return set.size;
  }, [orders]);

  // Actual metrics values
  const menusCount = menu.length;
  const ordersCount = orders.length;
  const customersCount = uniqueCustomers;
  const incomeValue = currency.format(actualSales);

  // Compute past 7 days actual trend data for sparklines
  const past7DaysData = useMemo(() => {
    const days: { dateStr: string; orders: number; sales: number; customers: Set<string> }[] = [];
    const now = Date.now();
    for (let i = 6; i >= 0; i--) {
      const dateStr = businessDate.format(now - i * 86_400_000);
      days.push({ dateStr, orders: 0, sales: 0, customers: new Set() });
    }

    for (const o of orders) {
      if (!o.created_at) continue;
      const createdAt = Date.parse(o.created_at);
      if (!Number.isFinite(createdAt)) continue;
      const dStr = businessDate.format(createdAt);
      const match = days.find((day) => day.dateStr === dStr);
      if (match) {
        match.orders += 1;
        if (isServedOrder(o)) match.sales += Number(o.total_amount) || 0;
        const name = o.customer_name?.trim().toLowerCase();
        if (name) match.customers.add(name);
      }
    }

    return {
      orders: days.map((d) => ({ label: d.dateStr, value: d.orders })),
      sales: days.map((d) => ({ label: d.dateStr, value: d.sales })),
      customers: days.map((d) => ({ label: d.dateStr, value: d.customers.size })),
    };
  }, [orders]);

  return (
    <DashboardLayout title="Dashboard">
      {loading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 aria-label="Loading dashboard" className="size-8 animate-spin text-[#dc2626]" />
        </div>
      ) : error ? (
        <div className="card-premium p-8 text-center text-destructive">
          <p>Failed to load dashboard data.</p>
          <Button
            onClick={() => {
              void stats.refetch();
              void lowStock.refetch();
            }}
            className="mt-4 bg-[#dc2626] text-white hover:bg-[#b91c1c]"
          >
            Try again
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          <AnalyticsCharts summaryCards={(
            <div className="dashboard-counts grid grid-cols-2 gap-3 md:gap-5 xl:grid-cols-4">
              <StatCard
                title="Menus"
                value={menusCount}
                icon={UtensilsCrossed}
                dataPoints={[{ label: 'Current menu count', value: menusCount }]}
                chartLabel="Current menu count"
              />
              <StatCard
                title="Orders"
                value={ordersCount}
                icon={ClipboardList}
                dataPoints={past7DaysData.orders}
                chartLabel="Orders by day over the last 7 days"
              />
              <StatCard
                title="Customers"
                value={customersCount}
                icon={Users}
                dataPoints={past7DaysData.customers}
                chartStyle="bars"
                chartLabel="Unique named customers per day over the last 7 days"
              />
              <StatCard
                title="Income"
                value={incomeValue}
                icon={DollarSign}
                dataPoints={past7DaysData.sales}
                chartLabel="Income from served orders over the last 7 days"
                formatValue={formatStatCurrency}
              />
            </div>
          )} />

          {/* ── BOTTOM LOW STOCK STATUS ── */}
          <LowStockAlert items={(lowStock.data ?? []).slice(0, 5)} />
        </div>
      )}
    </DashboardLayout>
  );
}
