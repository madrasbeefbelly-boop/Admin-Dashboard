import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatCard } from '@/components/dashboard/StatCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useMenuItems, usePurchases, useOrders } from '@/hooks/api';
import { averageMenuMargin } from '@/lib/utils';
import { Calculator, Loader2, Percent, Receipt, TrendingUp, ShoppingBag } from 'lucide-react';
import { cn } from '@/lib/utils';

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });

export default function ProfitPage() {
  const [manualSales, setManualSales] = useState('');
  const purchases = usePurchases();
  const menu = useMenuItems();
  const orders = useOrders();

  const costs = (purchases.data ?? []).reduce(
    (total, item) => total + Number(item.quantity ?? 0) * Number(item.unit_price ?? 0), 0,
  );

  // Revenue from recorded orders
  const orderRevenue = (orders.data ?? []).reduce(
    (total, order) => total + Number(order.total_amount ?? 0), 0,
  );

  const hasManual = manualSales !== '' && Number.isFinite(Number(manualSales)) && Number(manualSales) >= 0;
  // Prefer manual entry; fall back to order revenue if orders exist
  const revenue = hasManual ? Number(manualSales) : orderRevenue;
  const revenueSource = hasManual ? 'manual' : orders.data && orders.data.length > 0 ? 'orders' : 'none';

  const averageMargin = averageMenuMargin(menu.data ?? []);
  const profit = revenue - costs;
  const profitMarginPct = revenue > 0 ? (profit / revenue) * 100 : null;

  const isLoading = purchases.isPending || menu.isPending || orders.isPending;
  const isError = purchases.isError || menu.isError;

  // Recent orders for breakdown
  const recentOrders = (orders.data ?? []).slice(0, 10);

  return (
    <DashboardLayout title="Profit Calculator" subtitle="Real revenue from orders & estimated profit">
      {isLoading ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 aria-label="Loading" className="size-8 animate-spin text-gold" />
        </div>
      ) : isError ? (
        <div className="card-premium p-8 text-center text-destructive">
          <p>Failed to load data.</p>
          <Button
            className="mt-4"
            onClick={() => {
              void purchases.refetch();
              void menu.refetch();
              void orders.refetch();
            }}
          >
            Try again
          </Button>
        </div>
      ) : (
        <>
          {/* Revenue source info */}
          {revenueSource === 'orders' && (
            <div className="mb-5 card-premium p-4 flex items-center gap-3 border-gold/20 bg-gold/[0.03]">
              <ShoppingBag className="size-5 text-gold shrink-0" />
              <div className="text-sm">
                <span className="font-medium text-gold">Revenue auto-filled from {orders.data!.length} recorded orders.</span>
                <span className="text-muted-foreground ml-1">
                  You can override below with a custom figure.
                </span>
              </div>
            </div>
          )}

          {/* Manual override input */}
          <div className="card-premium mb-6 max-w-xl p-5 sm:p-6">
            <Label htmlFor="profit-sales">
              {revenueSource === 'orders'
                ? 'Override revenue (₹) — leave blank to use order totals'
                : 'Sales revenue (₹)'}
            </Label>
            <Input
              id="profit-sales"
              className="mt-2"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              placeholder={revenueSource === 'orders' ? `${orderRevenue.toFixed(2)} (from orders)` : '0.00'}
              value={manualSales}
              onChange={(event) => setManualSales(event.target.value)}
              aria-describedby="profit-sales-help"
            />
            <p id="profit-sales-help" className="mt-2 text-sm text-muted-foreground">
              {revenueSource === 'orders'
                ? 'Order revenue is automatically summed from your recorded orders in New Order page.'
                : 'Enter your total sales for the period covered by logged purchases.'}
            </p>
          </div>

          {/* Stat cards */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4 mb-8">
            <StatCard title="Total Revenue" value={revenueSource === 'none' && !hasManual ? '—' : currency.format(revenue)} icon={TrendingUp} />
            <StatCard title="Logged Purchase Costs" value={currency.format(costs)} icon={Receipt} />
            <StatCard
              title="Estimated Profit"
              value={revenueSource === 'none' && !hasManual ? '—' : currency.format(profit)}
              icon={Calculator}
              variant="gold"
            />
            <StatCard
              title="Average Menu Margin"
              value={averageMargin == null ? '—' : averageMargin.toFixed(1) + '%'}
              icon={Percent}
            />
          </div>

          {/* Profit margin bar */}
          {profitMarginPct != null && (
            <div className="card-premium p-5 mb-8 max-w-xl">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">Profit Margin</span>
                <span
                  className={cn(
                    'font-semibold tabular-nums',
                    profitMarginPct >= 0 ? 'text-success' : 'text-destructive',
                  )}
                >
                  {profitMarginPct.toFixed(1)}%
                </span>
              </div>
              <div className="h-2.5 rounded-full bg-secondary overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    profitMarginPct >= 0 ? 'bg-success' : 'bg-destructive',
                  )}
                  style={{ width: `${Math.min(Math.abs(profitMarginPct), 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Recent orders breakdown */}
          {recentOrders.length > 0 && (
            <div className="card-premium overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                <h2 className="font-semibold">Recent Orders</h2>
                <Badge className="bg-gold/10 text-gold border-gold/20">
                  {orders.data!.length} total
                </Badge>
              </div>
              <div className="divide-y divide-border">
                {recentOrders.map((order) => (
                  <div key={order.id} className="flex items-center gap-3 px-5 py-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium tabular-nums">{order.order_ref}</p>
                      <p className="text-xs text-muted-foreground">
                        {order.customer_name ? order.customer_name + ' · ' : ''}
                        {new Date(order.created_at).toLocaleString('en-IN', {
                          dateStyle: 'short',
                          timeStyle: 'short',
                        })}
                      </p>
                    </div>
                    <Badge variant="outline" className="text-xs shrink-0">
                      {order.payment_method}
                    </Badge>
                    <span className="font-semibold tabular-nums text-gold shrink-0">
                      ₹{Number(order.total_amount).toFixed(0)}
                    </span>
                  </div>
                ))}
              </div>
              {orders.data!.length > 10 && (
                <div className="px-5 py-3 text-xs text-muted-foreground border-t border-border">
                  Showing 10 of {orders.data!.length} orders
                </div>
              )}
            </div>
          )}
        </>
      )}
    </DashboardLayout>
  );
}
