import { useState, useMemo } from 'react';
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
import { OrderBreakdown } from './OrderBreakdown';

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

export function AnalyticsCharts() {
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

  // Max value for Revenue Y-Axis
  const maxRevenueVal = useMemo(() => {
    const highest = Math.max(
      ...revenueChartData.map((d) => Math.max(d.income, d.expense)),
      0
    );
    return highest > 0 ? Math.ceil(highest * 1.2) : 1000;
  }, [revenueChartData]);

  return (
    <div className="space-y-6 mb-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* ── LEFT: REVENUE WAVE CHART (7 cols on lg) ── */}
        <div className="lg:col-span-7 card-premium p-6 flex flex-col justify-between">
          <div>
            {/* Header: Title + Filter Toggle */}
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-5 bg-[#e11d48] rounded-full inline-block" />
                  <h3 className="font-display font-bold text-lg text-slate-900 tracking-tight">
                    Revenue
                  </h3>
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Actual order income and logged kitchen expenses
                </p>
              </div>

              {/* Monthly / Weekly Dropdown */}
              <div className="relative inline-block">
                <button
                  type="button"
                  onClick={() => setTimeFilter((prev) => (prev === 'Monthly' ? 'Weekly' : 'Monthly'))}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg shadow-xs hover:bg-slate-50 transition-colors"
                >
                  {timeFilter}
                  <ChevronDown className="size-3.5 text-slate-400" />
                </button>
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

          {/* Layered Multi-Wave Area Chart */}
          <div className="h-64 sm:h-72 w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart
                data={revenueChartData}
                margin={{ top: 15, right: 10, left: -10, bottom: 0 }}
              >
                <defs>
                  {/* Purple/Violet Gradient (Expenses) */}
                  <linearGradient id="purpleWaveGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#c084fc" stopOpacity={0.65} />
                    <stop offset="95%" stopColor="#c084fc" stopOpacity={0.08} />
                  </linearGradient>
                  {/* Vibrant Pink/Magenta Gradient (Income) */}
                  <linearGradient id="pinkWaveGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#e11d48" stopOpacity={0.85} />
                    <stop offset="95%" stopColor="#e11d48" stopOpacity={0.15} />
                  </linearGradient>
                </defs>

                <CartesianGrid
                  strokeDasharray="0 0"
                  vertical={false}
                  stroke="#f1f5f9"
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
                  domain={[0, maxRevenueVal]}
                  tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: 500 }}
                  tickFormatter={(val) => (val >= 1000 ? `₹${val / 1000}k` : `₹${val}`)}
                />

                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="rounded-xl border border-slate-100 bg-white p-3 text-xs shadow-lg space-y-1.5 min-w-[130px]">
                        <p className="font-bold text-slate-800">{label}</p>
                        <div className="flex items-center justify-between gap-3">
                          <span className="flex items-center gap-1.5 text-slate-500">
                            <span className="size-2 rounded-full bg-[#e11d48]" /> Income
                          </span>
                          <span className="font-semibold text-slate-900 tabular-nums">
                            {currency.format(Number(payload[1]?.value ?? payload[0]?.value))}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="flex items-center gap-1.5 text-slate-500">
                            <span className="size-2 rounded-full bg-[#c084fc]" /> Expense
                          </span>
                          <span className="font-semibold text-slate-900 tabular-nums">
                            {currency.format(Number(payload[0]?.value))}
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
                  fill="url(#purpleWaveGradient)"
                />
                <Area
                  type="monotone"
                  dataKey="income"
                  stroke="#e11d48"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#pinkWaveGradient)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <FoodMap orders={servedOrders} />
      </div>

      <OrderBreakdown orders={orders} />
    </div>
  );
}
