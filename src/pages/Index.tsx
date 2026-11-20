import { useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatCard } from '@/components/dashboard/StatCard';
import { LowStockAlert } from '@/components/dashboard/LowStockAlert';
import { AnalyticsCharts } from '@/components/dashboard/AnalyticsCharts';
import { Button } from '@/components/ui/button';
import { useDashboardStats, useLowStockItems, useOrders, useMenuItems } from '@/hooks/api';
import { Loader2, UtensilsCrossed, ClipboardList, Users, DollarSign } from 'lucide-react';
import { isServedOrder } from '@/lib/utils';

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
  const menusCount = menu.length > 0 ? menu.length : (Number(data?.inventory_count) || 0);
  const ordersCount = orders.length;
  const customersCount = uniqueCustomers;
  const incomeValue = currency.format(actualSales);

  // Compute past 7 days actual trend data for sparklines
  const past7DaysData = useMemo(() => {
    const days: { dateStr: string; orders: number; sales: number; customers: Set<string> }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split('T')[0];
      days.push({ dateStr, orders: 0, sales: 0, customers: new Set() });
    }

    for (const o of orders) {
      if (!o.created_at) continue;
      const dStr = new Date(o.created_at).toISOString().split('T')[0];
      const match = days.find((day) => day.dateStr === dStr);
      if (match) {
        match.orders += 1;
        if (isServedOrder(o)) match.sales += Number(o.total_amount) || 0;
        if (o.customer_name) match.customers.add(o.customer_name);
      }
    }

    return {
      orders: days.map((d) => d.orders),
      sales: days.map((d) => d.sales),
      customers: days.map((d) => d.customers.size),
      menus: Array(7).fill(menusCount),
    };
  }, [orders, menusCount]);

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
          {/* ── TOP STAT CARDS (4 CARDS WITH ACTUAL DATA ONLY) ── */}
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              title="Menus"
              value={menusCount}
              icon={UtensilsCrossed}
              dataPoints={past7DaysData.menus}
            />
            <StatCard
              title="Orders"
              value={ordersCount}
              icon={ClipboardList}
              dataPoints={past7DaysData.orders}
            />
            <StatCard
              title="Customers"
              value={customersCount}
              icon={Users}
              dataPoints={past7DaysData.customers}
            />
            <StatCard
              title="Income"
              value={incomeValue}
              icon={DollarSign}
              dataPoints={past7DaysData.sales}
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
