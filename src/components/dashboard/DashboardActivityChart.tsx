import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { DashboardActivity, IngredientUsageGroup } from '@/lib/dashboard-period';
import { formatStatCurrency } from '@/lib/stat-series';
import { cn } from '@/lib/utils';

const formatCount = new Intl.NumberFormat('en-IN').format;
const formatQuantity = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 7 }).format;
const formatAxis = new Intl.NumberFormat('en-IN', { notation: 'compact', maximumFractionDigits: 1 }).format;
const formatCurrencyAxis = new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', notation: 'compact', maximumFractionDigits: 1,
}).format;

export function ActivityBarChart({ data, view, className }: {
  data: DashboardActivity;
  view: 'profit' | 'orders';
  className: string;
}) {
  const profit = view === 'profit';
  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} barGap={3} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="var(--color-input)" />
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
          <YAxis axisLine={false} tickLine={false} width={48} tick={{ fontSize: 11 }}
            domain={([min, max]) => [Math.min(0, min), Math.max(1, max)]}
            allowDecimals={false} tickFormatter={profit ? formatCurrencyAxis : formatAxis} />
          <Tooltip
            cursor={{ fill: 'var(--color-muted)', opacity: 0.6 }}
            formatter={(value) => profit ? formatStatCurrency(Number(value)) : formatCount(Number(value))}
          />
          <ReferenceLine y={0} stroke="var(--color-muted-foreground)" />
          {profit ? (
            <Bar dataKey="net" name="Profit / loss" maxBarSize={40} isAnimationActive={false}>
              {data.map(({ key, net }) => <Cell key={key} fill={net < 0 ? '#dc2626' : '#047857'} />)}
            </Bar>
          ) : (
            <>
              <Bar dataKey="placed" name="Placed" fill="#64748b" radius={[3, 3, 0, 0]} maxBarSize={26} isAnimationActive={false} />
              <Bar dataKey="served" name="Served" fill="#dc2626" radius={[3, 3, 0, 0]} maxBarSize={26} isAnimationActive={false} />
            </>
          )}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function IngredientUsageChart({ group, limit }: { group?: IngredientUsageGroup; limit?: number }) {
  if (!group) {
    return <p className="py-8 text-center text-sm text-muted-foreground">No ingredient deductions recorded for this period.</p>;
  }
  const peak = group.ingredients[0].quantity;
  return (
    <ol aria-label="Ingredients ranked by amount deducted" className="space-y-3">
      {group.ingredients.slice(0, limit).map(({ id, name, quantity }) => (
        <li key={id} className="space-y-1">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="font-medium wrap-anywhere">{name}</span>
            <span className="shrink-0 font-semibold tabular-nums">{formatQuantity(quantity)} {group.unit}</span>
          </div>
          <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-primary" style={{ width: `${quantity / peak * 100}%` }} />
          </div>
        </li>
      ))}
    </ol>
  );
}

const money = [
  { key: 'income', label: 'Income', format: formatStatCurrency },
  { key: 'expense', label: 'Expense', format: formatStatCurrency },
] as const;
const orderCounts = [
  { key: 'placed', label: 'Placed', format: formatCount },
  { key: 'served', label: 'Served', format: formatCount },
] as const;
const net = { key: 'net', label: 'Profit / loss', format: formatStatCurrency } as const;

export function ActivityTable({ data, view }: { data: DashboardActivity; view: 'revenue' | 'profit' | 'orders' }) {
  const columns = view === 'orders' ? orderCounts : view === 'profit' ? [...money, net] : money;
  return (
    <table className="w-full table-fixed text-xs sm:text-sm">
      <thead className="border-b border-input text-xs text-muted-foreground">
        <tr>
          <th scope="col" className="px-1 py-2 text-left sm:px-2">Period</th>
          {columns.map(({ key, label }) => <th key={key} scope="col" className="px-1 py-2 text-right sm:px-2">{label}</th>)}
        </tr>
      </thead>
      <tbody>
        {data.map((point) => (
          <tr key={point.key} className="border-b border-input last:border-0">
            <th scope="row" className="px-1 py-2 text-left font-medium sm:px-2">{point.label}</th>
            {columns.map(({ key, format }) => (
              <td key={key} className={cn('px-1 py-2 text-right tabular-nums wrap-anywhere sm:px-2',
                key === 'net' && point.net < 0 && 'font-semibold text-destructive')}>
                {format(point[key])}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
