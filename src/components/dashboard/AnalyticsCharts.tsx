import { useState, useMemo, useId, type ReactNode } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { useOrders, usePurchases } from '@/hooks/api';
import { ChevronDown } from 'lucide-react';
import { isServedOrder } from '@/lib/utils';
import { FoodMap } from './FoodMap';
import { ChartDetails } from './ChartDetails';
import { formatStatCurrency } from '@/lib/stat-series';
import { OrderBreakdown } from './OrderBreakdown';

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export function AnalyticsCharts({ summaryCards }: { summaryCards: ReactNode }) {
  const { data: orders = [] } = useOrders();
  const { data: purchases = [] } = usePurchases();
  const servedOrders = useMemo(() => orders.filter(isServedOrder), [orders]);

  const [timeFilter, setTimeFilter] = useState<'Monthly' | 'Weekly'>('Monthly');

  // Actual live Total Sales from orders
  const actualSales = useMemo(() => {
    return servedOrders.reduce((sum, o) => sum + (Number(o.total_amount) || 0), 0);
  }, [servedOrders]);

  // Actual live Costs from logged purchases
  const actualCosts = useMemo(() => {
    return purchases.reduce(
      (sum, p) => sum + (Number(p.quantity) || 0) * (Number(p.unit_price) || 0),
      0,
    );
  }, [purchases]);

  // Real Monthly & Weekly Revenue Data (Income vs Expense)
  const revenueChartData = useMemo(() => {
    if (timeFilter === 'Weekly') {
      // Past 7 Days
      const days = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const key = d.toISOString().split('T')[0];
        const label = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric' });
        days.push({ key, label, income: 0, expense: 0 });
      }

      for (const o of servedOrders) {
        if (!o.created_at) continue;
        const key = new Date(o.created_at).toISOString().split('T')[0];
        const match = days.find((day) => day.key === key);
        if (match) match.income += Number(o.total_amount) || 0;
      }

      for (const p of purchases) {
        const dateStr = p.purchase_date || p.created_at;
        if (!dateStr) continue;
        const key = new Date(dateStr).toISOString().split('T')[0];
        const match = days.find((day) => day.key === key);
        if (match) match.expense += (Number(p.quantity) || 0) * (Number(p.unit_price) || 0);
      }

      return days;
    }

    // Past 6 Months (Monthly)
    const months = [];
    const now = new Date();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-IN', { month: 'short' });
      months.push({ key, label, income: 0, expense: 0 });
    }

    for (const o of servedOrders) {
      if (!o.created_at) continue;
      const d = new Date(o.created_at);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const match = months.find((m) => m.key === key);
      if (match) match.income += Number(o.total_amount) || 0;
    }

    for (const p of purchases) {
      const dateStr = p.purchase_date || p.created_at;
      if (!dateStr) continue;
      const d = new Date(dateStr);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const match = months.find((m) => m.key === key);
      if (match) match.expense += (Number(p.quantity) || 0) * (Number(p.unit_price) || 0);
    }

    return months;
  }, [servedOrders, purchases, timeFilter]);

  // Max value and ticks for Revenue Y-Axis (1k, 5k, 10k, 20k, 30k, 40k, 50k scale)
  const revenueYAxis = useMemo(() => {
    const highest = Math.max(
      ...revenueChartData.map((d) => Math.max(d.income || 0, d.expense || 0)),
      0
    );

    if (highest <= 10000) {
      return { domain: [0, 10000] as [number, number], ticks: [0, 1000, 5000, 10000] };
    }
    if (highest <= 20000) {
      return { domain: [0, 20000] as [number, number], ticks: [0, 5000, 10000, 20000] };
    }
    if (highest <= 30000) {
      return { domain: [0, 30000] as [number, number], ticks: [0, 10000, 20000, 30000] };
    }
    if (highest <= 40000) {
      return { domain: [0, 40000] as [number, number], ticks: [0, 10000, 20000, 30000, 40000] };
    }
    if (highest <= 50000) {
      return { domain: [0, 50000] as [number, number], ticks: [0, 10000, 20000, 30000, 40000, 50000] };
    }

    const step = highest <= 100000 ? 20000 : 50000;
    const max = Math.ceil(highest / step) * step;
    const ticks = [0];
    for (let t = step; t <= max; t += step) {
      ticks.push(t);
    }
    return { domain: [0, max] as [number, number], ticks };
  }, [revenueChartData]);

  const chartId = useId();
  const renderRevenueChart = (id: string, className: string) => {
    const expenseGradient = id + '-expense';
    const incomeGradient = id + '-income';
    return (
      <div className={className}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart
            data={revenueChartData}
            margin={{ top: 15, right: 8, left: 0, bottom: 0 }}
          >
            <defs>
              {/* Purple/Violet Gradient (Expenses) */}
              <linearGradient id={expenseGradient} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#c084fc" stopOpacity={0.65} />
                <stop offset="95%" stopColor="#c084fc" stopOpacity={0.08} />
              </linearGradient>
              {/* Vibrant Red Gradient (Income - Matching Madras Beef Belly Logo) */}
              <linearGradient id={incomeGradient} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#dc2626" stopOpacity={0.85} />
                <stop offset="95%" stopColor="#dc2626" stopOpacity={0.15} />
              </linearGradient>
            </defs>

            <CartesianGrid
              strokeDasharray="0 0"
              vertical={false}
              stroke="#cbd5e1"
              strokeOpacity={0.5}
              strokeWidth={1}
            />

            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 500 }}
              dy={6}
            />

            <YAxis
              tickLine={false}
              axisLine={false}
              width={38}
              tickMargin={4}
              ticks={revenueYAxis.ticks}
              domain={revenueYAxis.domain}
              tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 600 }}
              tickFormatter={(val) => (val === 0 ? '0' : val >= 1000 ? `${val / 1000}k` : `${val}`)}
            />

            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                return (
                  <div className="rounded-xl border border-slate-100 bg-white p-3 text-xs shadow-lg space-y-1.5 min-w-[130px]">
                    <p className="font-bold text-slate-800">{label}</p>
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <span className="size-2 rounded-full bg-[#dc2626]" /> Income
                      </span>
                      <span className="font-semibold text-slate-900 tabular-nums">
                        {currency.format(Number(payload.find((item) => item.dataKey === 'income')?.value ?? 0))}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="flex items-center gap-1.5 text-slate-500">
                        <span className="size-2 rounded-full bg-[#c084fc]" /> Expense
                      </span>
                      <span className="font-semibold text-slate-900 tabular-nums">
                        {currency.format(Number(payload.find((item) => item.dataKey === 'expense')?.value ?? 0))}
                      </span>
                    </div>
                  </div>
                );
              }}
            />

            {/* Overlapping Waves derived from actual data */}
            <Area
              type="monotone"
              dataKey="expense"
              stroke="#c084fc"
              strokeWidth={2.5}
              fillOpacity={1}
              fill={'url(#' + expenseGradient + ')'}
            />
            <Area
              type="monotone"
              dataKey="income"
              stroke="#dc2626"
              strokeWidth={2.5}
              fillOpacity={1}
              fill={'url(#' + incomeGradient + ')'}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    );
  };

  return (
    <div className="space-y-6 mb-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* ── REVENUE WAVE CHART (Top on mobile, 2nd on desktop) ── */}
        <div className="order-1 md:order-2 lg:col-span-7 card-premium p-4 sm:p-6 flex flex-col justify-between overflow-hidden">
          <div className="px-1 sm:px-0">
            {/* Header: Title + Filter Toggle */}
            <div className="flex flex-wrap items-start justify-between gap-2 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-5 bg-[#dc2626] rounded-full inline-block" />
                  <h3 className="font-display font-bold text-lg text-slate-900 tracking-tight">
                    Revenue
                  </h3>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Actual order income and logged kitchen expenses
                </p>
              </div>

              {/* Monthly / Weekly Dropdown */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTimeFilter((prev) => (prev === 'Monthly' ? 'Weekly' : 'Monthly'))}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg shadow-xs hover:bg-slate-50 transition-colors"
                >
                  {timeFilter}
                  <ChevronDown className="size-3.5 text-slate-400" />
                </button>
                <ChartDetails title="Revenue" description={timeFilter === 'Weekly' ? 'Income and expense for the last 7 days' : 'Income and expense for the last 6 months'}>
                  {renderRevenueChart(chartId + '-detail', 'h-56 w-full sm:h-72')}
                  <table className="w-full table-fixed text-sm">
                    <thead className="border-b border-input text-xs text-muted-foreground">
                      <tr><th scope="col" className="p-2 text-left">Period</th><th scope="col" className="p-2 text-right">Income</th><th scope="col" className="p-2 text-right">Expense</th></tr>
                    </thead>
                    <tbody>
                      {revenueChartData.map(({ key, label, income, expense }) => (
                        <tr key={key} className="border-b border-input last:border-0">
                          <th scope="row" className="p-2 text-left font-medium">{label}</th>
                          <td className="p-2 text-right tabular-nums wrap-anywhere">{formatStatCurrency(income)}</td>
                          <td className="p-2 text-right tabular-nums wrap-anywhere">{formatStatCurrency(expense)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ChartDetails>
              </div>
            </div>

            {/* Income & Expense Banner (Actual values only) */}
            <div className="flex items-center justify-center gap-12 sm:gap-16 py-2 mb-2">
              <div className="text-center">
                <span className="text-xs text-slate-400 font-medium block">Income</span>
                <span className="font-display text-xl sm:text-2xl font-bold text-slate-900 tabular-nums">
                  {currency.format(actualSales)}
                </span>
              </div>
              <div className="text-center">
                <span className="text-xs text-slate-400 font-medium block">Expense</span>
                <span className="font-display text-xl sm:text-2xl font-bold text-slate-900 tabular-nums">
                  {currency.format(actualCosts)}
                </span>
              </div>
            </div>
          </div>

          {/* Layered Multi-Wave Area Chart - Edge-to-edge wide graph */}
          {renderRevenueChart(chartId + '-inline', 'h-64 sm:h-72 w-full pt-2')}
        </div>

        {/* ── 4 SUMMARY BOXES (2nd on mobile, Top on desktop) ── */}
        <div className="order-2 md:order-1 md:col-span-full lg:col-span-full">
          {summaryCards}
        </div>

        {/* ── FOOD MAP (3rd on mobile, right column on desktop) ── */}
        <FoodMap orders={servedOrders} className="order-3 md:order-3" />
      </div>

      <OrderBreakdown orders={orders} />
    </div>
  );
}
