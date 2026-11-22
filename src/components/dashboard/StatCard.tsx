import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatStatLabel, type StatPoint } from '@/lib/stat-series';
import { ChartDetails } from './ChartDetails';

export interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  dataPoints?: StatPoint[];
  chartLabel?: string;
  formatValue?: (value: number) => string;
  accent?: string;
}

function StatCardChart({ values, accent, className }: { values: number[]; accent: string; className: string }) {
  const hasData = values.length > 0;
  const points = hasData ? values : [0, 0, 0, 0, 0];
  const minimum = Math.min(0, ...points);
  const maximum = Math.max(0, ...points);
  const range = maximum - minimum || 1;
  const baseline = 34 - (-minimum / range) * 28;
  const slot = 200 / points.length;
  const width = Math.min(slot * 0.68, 36);

  return (
    <svg className={cn(className, accent)} viewBox="0 0 200 40" preserveAspectRatio="none" aria-hidden="true">
      {points.map((value, index) => {
        const height = value === 0 ? 1.5 : Math.max(2, Math.abs(value) / range * 28);
        return (
          <rect
            key={index}
            x={index * slot + (slot - width) / 2}
            y={value < 0 ? baseline : baseline - height}
            width={width}
            height={height}
            rx={Math.min(1.5, width / 3)}
            fill="currentColor"
            opacity={value === 0 ? 0.32 : 0.86}
          />
        );
      })}
    </svg>
  );
}

const formatNumber = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format;

export function StatCard({
  title, value, icon: Icon, dataPoints, chartLabel,
  accent = 'text-primary', formatValue = formatNumber,
}: StatCardProps) {
  const content = (
    <>
      <span className="stat-card-title">{title}</span>
      <Icon aria-hidden="true" className={cn('stat-card-icon', accent)} />
      <span className="stat-card-value font-display tabular-nums">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </span>
    </>
  );

  if (!dataPoints) return <div className="stat-card">{content}</div>;

  const values = dataPoints.map((point) => point.value);
  return (
    <ChartDetails
      title={title}
      description={chartLabel ?? `${title} trend`}
      trigger={(
        <button type="button" aria-label={`View ${title} details`}
          className="stat-card w-full cursor-pointer text-left hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
          {content}
          <StatCardChart values={values} accent={accent} className="stat-card-chart" />
        </button>
      )}
    >
      {dataPoints.length ? (
        <>
          <div className="rounded-lg border border-input bg-background px-3 py-1">
            <StatCardChart values={values} accent={accent} className="block h-24 w-full" />
          </div>
          <table className="w-full table-fixed text-left text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr className="border-b border-input"><th scope="col" className="w-3/5 px-2 py-2">Breakdown</th><th scope="col" className="px-2 py-2 text-right">Value</th></tr>
            </thead>
            <tbody>
              {dataPoints.map((point, index) => (
                <tr key={index} className="border-b border-input last:border-0">
                  <th scope="row" className="px-2 py-2 font-medium wrap-anywhere">{formatStatLabel(point.label)}</th>
                  <td className="px-2 py-2 text-right tabular-nums wrap-anywhere">{formatValue(point.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      ) : <p className="py-4 text-sm text-muted-foreground">No data available for this chart yet.</p>}
    </ChartDetails>
  );
}
