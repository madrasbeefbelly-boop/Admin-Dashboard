import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatCard } from '@/components/dashboard/StatCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useMenuItems, usePurchases } from '@/hooks/api';
import { averageMenuMargin } from '@/lib/utils';
import { Calculator, Loader2, Percent, Receipt } from 'lucide-react';

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });

export default function ProfitPage() {
  const [sales, setSales] = useState('');
  const purchases = usePurchases();
  const menu = useMenuItems();
  const costs = (purchases.data ?? []).reduce(
    (total, item) => total + Number(item.quantity ?? 0) * Number(item.unit_price ?? 0), 0,
  );
  const revenue = Number(sales);
  const hasRevenue = sales !== '' && Number.isFinite(revenue) && revenue >= 0;
  const averageMargin = averageMenuMargin(menu.data ?? []);

  return (
    <DashboardLayout title="Profit Calculator" subtitle="Estimate profit from sales and logged purchases">
      {purchases.isPending || menu.isPending ? (
        <div className="flex h-64 items-center justify-center">
          <Loader2 aria-label="Loading costs" className="size-8 animate-spin text-gold" />
        </div>
      ) : purchases.isError || menu.isError ? (
        <div className="card-premium p-8 text-center text-destructive">
          <p>Failed to load purchase costs or menu prices.</p>
          <Button className="mt-4" onClick={() => { void purchases.refetch(); void menu.refetch(); }}>Try again</Button>
        </div>
      ) : (
        <>
          <div className="card-premium mb-6 max-w-xl p-5 sm:p-6">
            <Label htmlFor="profit-sales">Sales revenue (₹)</Label>
            <Input id="profit-sales" className="mt-2" type="number" inputMode="decimal" min="0" step="0.01"
              value={sales} onChange={event => setSales(event.target.value)} aria-describedby="profit-sales-help" />
            <p id="profit-sales-help" className="mt-2 text-sm text-muted-foreground">
              Enter sales for the period covered by your logged purchases.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            <StatCard title="Logged Purchase Costs" value={currency.format(costs)} icon={Receipt} />
            <StatCard title="Estimated Profit" value={hasRevenue ? currency.format(revenue - costs) : '—'} icon={Calculator} variant="gold" />
            <StatCard title="Average Menu Margin" value={averageMargin == null ? '—' : averageMargin.toFixed(1) + '%'} icon={Percent} />
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
