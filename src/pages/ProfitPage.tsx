import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Calculator, Loader2, Percent, Receipt, TrendingUp } from 'lucide-react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatCard } from '@/components/dashboard/StatCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useMenuItems, useOrders, usePurchases } from '@/hooks/api';
import { averageMenuMargin, cn, isServedOrder } from '@/lib/utils';
import type { Order } from '@/types';

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });

const businessDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
});

type DishProfit = {
  name: string;
  servings: number;
  revenue: number;
  ingredientCost: number;
  uncostedServings: number;
};

function summarizeDishes(orders: Order[], days: number) {
  const start = new Date(`${businessDate.format(new Date())}T00:00:00+05:30`).getTime() - (days - 1) * 86400000;
  const dishes = new Map<string, DishProfit>();
  for (const order of orders) {
    if (days && new Date(order.created_at).getTime() < start) continue;
    for (const item of order.items) {
      const key = item.menu_item_id ?? item.name.trim().toLowerCase();
      const dish = dishes.get(key) ?? { name: item.name, servings: 0, revenue: 0, ingredientCost: 0, uncostedServings: 0 };
      dish.servings += Number(item.quantity);
      dish.revenue += Math.round(Number(item.line_total ?? Number(item.unit_price) * item.quantity) * 100);
      if (item.ingredient_cost == null) {
        dish.uncostedServings += Number(item.quantity);
      } else {
        dish.ingredientCost += item.ingredient_cost;
      }
      dishes.set(key, dish);
    }
  }
  return [...dishes.entries()].map(([key, dish]) => {
    const costInPaise = Math.round(dish.ingredientCost * 100);
    return {
      ...dish, key,
      revenue: dish.revenue / 100,
      ingredientCost: costInPaise / 100,
      profit: dish.uncostedServings ? null : (dish.revenue - costInPaise) / 100,
    };
  }).sort((a, b) => (b.profit ?? -Infinity) - (a.profit ?? -Infinity) || a.name.localeCompare(b.name));
}

export default function ProfitPage() {
  const [manualSales, setManualSales] = useState('');
  const [period, setPeriod] = useState('30');
  const [showLosses, setShowLosses] = useState(false);
  const purchases = usePurchases();
  const menu = useMenuItems();
  const orders = useOrders();

  const served = (orders.data ?? []).filter(isServedOrder);
  const dishes = summarizeDishes(served, Number(period));
  const ranked = dishes.filter((dish) => dish.profit != null);
  const highest = ranked[0];
  const lowest = ranked[ranked.length - 1];
  const losses = ranked.filter((dish) => dish.profit < 0);
  const totalLoss = losses.reduce((total, dish) => total - dish.profit, 0);
  const missing = dishes.length - ranked.length;
  const shown = showLosses ? losses : dishes;

  const purchaseCosts = (purchases.data ?? []).reduce(
    (total, item) => total + Number(item.quantity ?? 0) * Number(item.unit_price ?? 0), 0,
  );
  const hasManual = manualSales !== '' && Number.isFinite(Number(manualSales)) && Number(manualSales) >= 0;
  const hasRevenue = hasManual || served.length > 0;
  const revenue = hasManual ? Number(manualSales) : served.reduce((total, order) => total + Number(order.total_amount), 0);
  const estimate = revenue - purchaseCosts;
  const averageMargin = averageMenuMargin(menu.data ?? []);

  return (
    <DashboardLayout title="Profit Calculator" subtitle="Compare the revenue and ingredient costs of the dishes you sell">
      {orders.isPending || purchases.isPending || menu.isPending ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 aria-label="Loading" className="size-8 animate-spin text-gold" />
        </div>
      ) : orders.isError || purchases.isError || menu.isError ? (
        <div className="card-premium p-8 text-center">
          <p role="alert">Couldn’t load your profit data.</p>
          <Button className="mt-4" onClick={() => {
            void orders.refetch();
            void purchases.refetch();
            void menu.refetch();
          }}>Try again</Button>
        </div>
      ) : (
        <div className="space-y-8">
          <section className="card-premium overflow-hidden" aria-labelledby="dish-profit-title">
            <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border p-5 sm:p-6">
              <div>
                <h2 id="dish-profit-title" className="text-xl font-semibold">Profit by dish</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Revenue minus the ingredient cost recorded when each order was served. Filtered by order date in India time.
                </p>
              </div>
              <div className="w-full sm:w-44">
                <Label htmlFor="profit-period">Order period</Label>
                <Select value={period} onValueChange={setPeriod}>
                  <SelectTrigger id="profit-period" className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Today</SelectItem>
                    <SelectItem value="7">Last 7 days</SelectItem>
                    <SelectItem value="30">Last 30 days</SelectItem>
                    <SelectItem value="90">Last 90 days</SelectItem>
                    <SelectItem value="0">All time</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {dishes.length === 0 ? (
              <div className="p-6 text-sm text-muted-foreground">
                <p>No served dishes in this period.</p>
                <Link to="/orders" className="mt-2 inline-block font-medium text-primary underline underline-offset-4">View Orders</Link>
              </div>
            ) : (
              <>
                <dl className="grid gap-4 border-b border-border bg-muted/30 p-5 sm:grid-cols-3 sm:p-6">
                  {[
                    { label: 'Highest profit', dish: highest },
                    { label: 'Lowest profit', dish: lowest },
                  ].map(({ label, dish }) => (
                    <div key={label}>
                      <dt className="text-sm text-muted-foreground">{label}</dt>
                      <dd className="mt-1 break-words font-semibold">{dish?.name ?? 'Cost unavailable'}</dd>
                      {dish && <dd className={cn('mt-0.5 text-sm tabular-nums', dish.profit < 0 && 'text-rose-700')}>{currency.format(dish.profit)}</dd>}
                    </div>
                  ))}
                  <div>
                    <dt className="text-sm text-muted-foreground">Dishes sold at a loss</dt>
                    <dd className="mt-1 font-semibold">{losses.length}</dd>
                    <dd className={cn('mt-0.5 text-sm tabular-nums', losses.length > 0 && 'text-rose-700')}>
                      {currency.format(totalLoss)} in combined losses
                    </dd>
                  </div>
                </dl>

                <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 sm:px-6">
                  <p className="text-sm text-muted-foreground">
                    {missing === 0 && 'Sorted by total profit.'}
                    {missing === 1 && 'One dish has missing costs and is excluded from the rankings.'}
                    {missing > 1 && `${missing} dishes have missing costs and are excluded from the rankings.`}
                  </p>
                  <Button variant={showLosses ? 'default' : 'outline'} size="sm" aria-pressed={showLosses} onClick={() => setShowLosses(!showLosses)}>
                    Losses only
                  </Button>
                </div>
                {shown.length === 0 ? (
                  <p className="px-5 pb-5 text-sm text-muted-foreground">No losses among dishes with recorded costs in this period.</p>
                ) : (
                  <Table role="table" aria-label="Dish profit" className="mobile-records">
                    <TableHeader role="rowgroup">
                      <TableRow role="row">
                        <TableHead role="columnheader" scope="col">Dish</TableHead>
                        <TableHead role="columnheader" scope="col" className="text-right">Servings sold</TableHead>
                        <TableHead role="columnheader" scope="col" className="text-right">Revenue</TableHead>
                        <TableHead role="columnheader" scope="col" className="text-right">Ingredient cost</TableHead>
                        <TableHead role="columnheader" scope="col" className="text-right">Profit / loss</TableHead>
                        <TableHead role="columnheader" scope="col" className="text-right">Profit / serving</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody role="rowgroup">
                      {shown.map((dish) => (
                        <TableRow role="row" key={dish.key}>
                          <TableCell role="cell" mobileLabel="Dish" className="font-medium">{dish.name}</TableCell>
                          <TableCell role="cell" mobileLabel="Servings sold" className="text-right tabular-nums">{dish.servings}</TableCell>
                          <TableCell role="cell" mobileLabel="Revenue" className="text-right tabular-nums">{currency.format(dish.revenue)}</TableCell>
                          <TableCell role="cell" mobileLabel="Ingredient cost" className="text-right tabular-nums">{dish.profit == null ? 'Incomplete' : currency.format(dish.ingredientCost)}</TableCell>
                          <TableCell role="cell" mobileLabel="Profit / loss" className={cn('text-right font-semibold tabular-nums', dish.profit < 0 && 'text-rose-700')}>
                            {dish.profit == null ? 'Unavailable' : currency.format(dish.profit)}
                          </TableCell>
                          <TableCell role="cell" mobileLabel="Profit / serving" className="text-right tabular-nums">
                            {dish.profit == null ? 'Unavailable' : currency.format(dish.profit / dish.servings)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </>
            )}
          </section>

          <section className="space-y-4" aria-labelledby="business-estimate-title">
            <div>
              <h2 id="business-estimate-title" className="text-xl font-semibold">All-time business estimate</h2>
              <p className="mt-1 text-sm text-muted-foreground">Sales less logged purchases. Operating expenses are excluded.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard title="Sales Revenue" value={hasRevenue ? currency.format(revenue) : '—'} icon={TrendingUp} />
              <StatCard title="Logged Purchase Costs" value={currency.format(purchaseCosts)} icon={Receipt} />
              <StatCard title={estimate < 0 && hasRevenue ? 'Estimated Loss' : 'Estimated Profit'} value={hasRevenue ? currency.format(estimate) : '—'} icon={Calculator} />
              <StatCard title="Average Menu Margin" value={averageMargin == null ? '—' : averageMargin.toFixed(1) + '%'} icon={Percent} />
            </div>
            <div className="card-premium max-w-xl p-5">
              <Label htmlFor="profit-sales">Override all-time sales revenue (₹)</Label>
              <Input id="profit-sales" className="mt-2" type="number" inputMode="decimal" min="0" step="0.01"
                value={manualSales} onChange={(event) => setManualSales(event.target.value)} aria-describedby="profit-sales-help" />
              <p id="profit-sales-help" className="mt-2 text-sm text-muted-foreground">
                Leave blank to use served-order totals. The dish report always uses recorded orders.
              </p>
            </div>
          </section>
        </div>
      )}
    </DashboardLayout>
  );
}
