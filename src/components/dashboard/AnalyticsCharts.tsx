import { useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { Badge } from '@/components/ui/badge';
import { useOrders, usePurchases, useMenuItems } from '@/hooks/api';
import { averageMenuMargin } from '@/lib/utils';
import { TrendingUp, Award, DollarSign, Utensils, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export function AnalyticsCharts() {
  const { data: orders = [] } = useOrders();
  const { data: purchases = [] } = usePurchases();
  const { data: menu = [] } = useMenuItems();

  const avgMargin = averageMenuMargin(menu) ?? 45; // Default to ~45% margin if menu margins not calculated

  // Calculate Total Sales
  const totalSales = useMemo(() => {
    return orders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
  }, [orders]);

  // Calculate Total Purchase Costs
  const totalCosts = useMemo(() => {
    return purchases.reduce(
      (sum, p) => sum + (Number(p.quantity) || 0) * (Number(p.unit_price) || 0),
      0,
    );
  }, [purchases]);

  // Calculate Net Profit
  const totalProfit = useMemo(() => {
    if (totalCosts > 0) {
      return totalSales - totalCosts;
    }
    // If no purchases logged yet, estimate based on average menu margin
    return Math.round(totalSales * (avgMargin / 100));
  }, [totalSales, totalCosts, avgMargin]);

  const profitMarginPercent = totalSales > 0 ? Math.round((totalProfit / totalSales) * 100) : 0;

  // Aggregate Top 3 Selling Foods
  const top3Selling = useMemo(() => {
    const itemMap: Record<
      string,
      { name: string; quantity: number; revenue: number; category: string }
    > = {};

    for (const order of orders) {
      if (!Array.isArray(order.items)) continue;
      for (const item of order.items) {
        if (!item.name) continue;
        if (!itemMap[item.name]) {
          itemMap[item.name] = {
            name: item.name,
            quantity: 0,
            revenue: 0,
            category: item.category || 'Dishes',
          };
        }
        const qty = Number(item.quantity) || 1;
        itemMap[item.name].quantity += qty;
        itemMap[item.name].revenue +=
          Number(item.line_total) || (Number(item.unit_price) || 0) * qty;
      }
    }

    return Object.values(itemMap)
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 3);
  }, [orders]);

  const maxQuantity = top3Selling[0]?.quantity || 1;

  // Timeline Data for Sales & Profit (Past 7 Days)
  const timelineData = useMemo(() => {
    const map = new Map<string, { date: string; sales: number; profit: number }>();

    // Generate past 7 days
    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(today.getDate() - i);
      const label = d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
      map.set(label, { date: label, sales: 0, profit: 0 });
    }

    // Populate from actual orders
    for (const order of orders) {
      if (!order.created_at) continue;
      const label = new Date(order.created_at).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
      });
      const current = map.get(label) || { date: label, sales: 0, profit: 0 };
      const sale = Number(order.total_amount) || 0;
      current.sales += sale;
      current.profit += Math.round(sale * (avgMargin / 100));
      map.set(label, current);
    }

    return Array.from(map.values());
  }, [orders, avgMargin]);

  const rankBadges = [
    { label: '#1', color: 'bg-amber-500/10 text-amber-600 border-amber-500/30' },
    { label: '#2', color: 'bg-slate-500/10 text-slate-600 border-slate-500/30' },
    { label: '#3', color: 'bg-orange-500/10 text-orange-600 border-orange-500/30' },
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
      {/* ── LEFT: Sales & Profit Graph (7 columns on lg) ── */}
      <div className="lg:col-span-7 card-premium p-5 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
            <div>
              <div className="flex items-center gap-2">
                <TrendingUp className="size-4 text-gold" />
                <h3 className="font-display font-semibold text-base text-foreground">
                  Order Sales &amp; Profit Trend
                </h3>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Daily sales and estimated profit over the last 7 days
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1.5 text-xs">
                <span className="size-2.5 rounded-full bg-gold inline-block" />
                <span className="text-muted-foreground">Sales</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <span className="size-2.5 rounded-full bg-success inline-block" />
                <span className="text-muted-foreground">Profit</span>
              </div>
            </div>
          </div>

          {/* Quick Metrics Bar */}
          <div className="grid grid-cols-3 gap-2 py-3 px-3.5 mb-4 rounded-lg bg-background/80 border border-border/60">
            <div>
              <span className="text-[11px] text-muted-foreground block">Total Sales</span>
              <span className="font-semibold text-sm tabular-nums text-foreground">
                {currency.format(totalSales)}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-muted-foreground block">Estimated Profit</span>
              <span className="font-semibold text-sm tabular-nums text-success">
                {currency.format(totalProfit)}
              </span>
            </div>
            <div>
              <span className="text-[11px] text-muted-foreground block">Profit Margin</span>
              <span className="font-semibold text-sm tabular-nums text-foreground">
                {profitMarginPercent}%
              </span>
            </div>
          </div>
        </div>

        {/* Recharts Area Chart */}
        <div className="h-56 w-full pt-2">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={timelineData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="salesGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--color-gold, #b63228)" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="var(--color-gold, #b63228)" stopOpacity={0.0} />
                </linearGradient>
                <linearGradient id="profitGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#16a34a" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#16a34a" stopOpacity={0.0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e5e9" opacity={0.6} />
              <XAxis
                dataKey="date"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: '#888' }}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 11, fill: '#888' }}
                tickFormatter={(val) => `₹${val}`}
              />
              <Tooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  return (
                    <div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md space-y-1">
                      <p className="font-semibold text-foreground">{label}</p>
                      <p className="text-gold font-medium">
                        Sales: {currency.format(Number(payload[0]?.value) || 0)}
                      </p>
                      <p className="text-success font-medium">
                        Profit: {currency.format(Number(payload[1]?.value) || 0)}
                      </p>
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="sales"
                stroke="var(--color-gold, #b63228)"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#salesGradient)"
              />
              <Area
                type="monotone"
                dataKey="profit"
                stroke="#16a34a"
                strokeWidth={2}
                fillOpacity={1}
                fill="url(#profitGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── RIGHT: Top 3 Selling Food (5 columns on lg) ── */}
      <div className="lg:col-span-5 card-premium p-5 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Award className="size-4 text-amber-500" />
              <h3 className="font-display font-semibold text-base text-foreground">
                Top 3 Selling Food
              </h3>
            </div>
            <Link
              to="/orders"
              className="text-xs text-gold hover:underline flex items-center gap-0.5"
            >
              Orders <ArrowUpRight className="size-3" />
            </Link>
          </div>

          <p className="text-xs text-muted-foreground mb-4">
            Highest demanded dishes ranked by total portions sold
          </p>

          {top3Selling.length === 0 ? (
            <div className="py-10 text-center space-y-2">
              <Utensils className="mx-auto size-8 text-muted-foreground/30" />
              <p className="text-sm text-muted-foreground">No orders placed yet</p>
              <p className="text-xs text-muted-foreground/70">
                Place orders in the Orders page to see your best selling dishes.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {top3Selling.map((food, index) => {
                const percent = Math.min(Math.round((food.quantity / maxQuantity) * 100), 100);
                return (
                  <div key={food.name} className="flex items-center gap-3">
                    <img
                      src={`/MBB - Images/${food.name}.jpg`}
                      alt={food.name}
                      className="size-12 rounded-lg object-cover border border-border/80 shrink-0"
                      onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                    />
                    <div className="flex-1 min-w-0 space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Badge
                            variant="outline"
                            className={`text-xs px-1.5 py-0 font-bold shrink-0 ${rankBadges[index]?.color}`}
                          >
                            {rankBadges[index]?.label}
                          </Badge>
                          <span className="font-medium text-sm text-foreground truncate">
                            {food.name}
                          </span>
                        </div>
                        <span className="font-semibold text-sm tabular-nums text-gold shrink-0">
                          {food.quantity} sold
                        </span>
                      </div>

                      {/* Progress Bar */}
                      <div className="h-2 w-full bg-secondary/60 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gold transition-all duration-500"
                          style={{ width: `${percent}%` }}
                        />
                      </div>

                      <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                        <span>{food.category}</span>
                        <span>{currency.format(food.revenue)} revenue</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer info pill */}
        <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-between text-xs text-muted-foreground">
          <span>Updated in real time</span>
          <span className="font-medium text-foreground">{orders.length} total orders</span>
        </div>
      </div>
    </div>
  );
}
