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
import { isServedOrder } from '@/lib/utils';
import { FoodMap } from './FoodMap';
import { ChartDetails } from './ChartDetails';
import { dashboardActivity, dashboardIngredientUsage, type DashboardPeriod } from '@/lib/dashboard-period';
import { ActivityBarChart, ActivityTable, IngredientUsageChart } from './DashboardActivityChart';
import { OrderBreakdown } from './OrderBreakdown';

const currency = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const chartViews = {
  revenue: { title: 'Revenue', description: 'Served-order income and logged purchases' },
  profit: { title: 'Profit & Loss', description: 'Served-order income minus logged purchases.' },
  ingredients: { title: 'Ingredient Usage', description: 'Ingredient quantities deducted from stock for orders' },
  orders: { title: 'Orders Volume', description: 'Orders placed and served, grouped by the date they were placed' },
};

const selectClassName = 'min-h-10 max-w-full rounded-lg border border-input bg-background px-2 text-xs font-semibold focus-visible:outline-2 focus-visible:outline-primary';

type ChartView = keyof typeof chartViews;

export function AnalyticsCharts({ summaryCards }: { summaryCards: ReactNode }) {
  const { data: orders = [] } = useOrders();
  const { data: purchases = [] } = usePurchases();
  const servedOrders = useMemo(() => orders.filter(isServedOrder), [orders]);

  const [timeFilter, setTimeFilter] = useState<DashboardPeriod>('Monthly');
  const [view, setView] = useState<ChartView>('revenue');
  const [ingredientUnit, setIngredientUnit] = useState('');
  const revenueChartData = useMemo(() => dashboardActivity(orders, purchases, timeFilter), [orders, purchases, timeFilter]);
  const usage = useMemo(() => dashboardIngredientUsage(orders, revenueChartData, timeFilter), [orders, revenueChartData, timeFilter]);
  const usageGroup = usage.find(({ unit }) => unit === ingredientUnit) ?? usage[0];
  const totals = revenueChartData.reduce(
    (total, period) => ({
      income: total.income + period.income,
      expense: total.expense + period.expense,
      placed: total.placed + period.placed,
      served: total.served + period.served,
    }),
    { income: 0, expense: 0, placed: 0, served: 0 },
  );
  const net = Math.round((totals.income - totals.expense) * 100) / 100;
  const period = timeFilter === 'Weekly' ? 'Last 7 days' : 'Last 6 months';
  const activeChart = chartViews[view];
  const summary = view === 'revenue' ? [
    { label: 'Income', value: currency.format(totals.income) },
    { label: 'Logged purchases', value: currency.format(totals.expense) },
  ] : view === 'profit' ? [
    { label: net < 0 ? 'Estimated loss' : 'Estimated profit', value: currency.format(Math.abs(net)) },
  ] : [
    { label: 'Orders placed', value: totals.placed.toLocaleString('en-IN') },
    { label: 'Served', value: totals.served.toLocaleString('en-IN') },
  ];

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

  const renderActivity = (expanded: boolean) => {
    const className = expanded ? 'h-56 w-full sm:h-72' : 'h-64 w-full pt-2 sm:h-72';
    if (view === 'revenue') return renderRevenueChart(chartId + (expanded ? '-detail' : '-inline'), className);
    if (view === 'ingredients') {
      return (
        <div className={expanded ? 'py-2' : 'min-h-56 pt-3 sm:min-h-64'}>
          <IngredientUsageChart group={usageGroup} limit={expanded ? undefined : 5} />
        </div>
      );
    }
    return <ActivityBarChart data={revenueChartData} view={view} className={className} />;
  };

  return (
    <div className="space-y-6 mb-8">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        <section aria-labelledby="dashboard-activity-title" className="order-1 md:order-2 lg:col-span-7 card-premium p-4 sm:p-6 flex min-w-0 flex-col justify-between overflow-hidden">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="h-5 w-1.5 shrink-0 rounded-full bg-primary" aria-hidden="true" />
                <h3 id="dashboard-activity-title" className="font-display text-lg font-bold tracking-tight">{activeChart.title}</h3>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{activeChart.description}</p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select aria-label="Chart view" value={view} onChange={(event) => setView(event.target.value as ChartView)} className={selectClassName}>
                {Object.entries(chartViews).map(([key, { title }]) => <option key={key} value={key}>{title}</option>)}
              </select>
              <select aria-label="Chart period" value={timeFilter} onChange={(event) => setTimeFilter(event.target.value as DashboardPeriod)} className={selectClassName}>
                <option value="Monthly">Monthly</option>
                <option value="Weekly">Weekly</option>
              </select>
              <ChartDetails title={activeChart.title} description={`${period} · ${activeChart.description}`}>
                {renderActivity(true)}
                {view !== 'ingredients' && <ActivityTable data={revenueChartData} view={view} />}
              </ChartDetails>
            </div>
          </div>

          {view === 'ingredients' ? (
            <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-muted-foreground">{period}</p>
              {usage.length > 1 && (
                <select aria-label="Ingredient unit" className={selectClassName}
                  value={usageGroup?.unit} onChange={(event) => setIngredientUnit(event.target.value)}>
                  {usage.map(({ unit }) => <option key={unit} value={unit}>{unit}</option>)}
                </select>
              )}
            </div>
          ) : (
            <dl className="my-4 flex flex-wrap justify-center gap-x-8 gap-y-2 text-center">
              {summary.map(({ label, value }) => (
                <div key={label}>
                  <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
                  <dd className="font-display text-xl font-bold tabular-nums sm:text-2xl">{value}</dd>
                </div>
              ))}
            </dl>
          )}
          {renderActivity(false)}
        </section>

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
