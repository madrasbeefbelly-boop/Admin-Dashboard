import { useId } from 'react';
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
  chartStyle?: 'line' | 'bars';
  formatValue?: (value: number) => string;
  accent?: string;
}

/**
 * Converts an array of real data numbers into a smooth SVG bezier path
 */
function pointsToPath(points: number[] = [], width = 200, height = 40): { path: string; fillPath: string } {
  const paddingY = 8;
  const usableHeight = height - paddingY * 2;
  const baselineY = height - paddingY;

  if (!points || points.length === 0) {
    const flat = `M 0,${baselineY} L ${width},${baselineY}`;
    return { path: flat, fillPath: `${flat} L ${width},${height} L 0,${height} Z` };
  }

  const max = Math.max(...points);
  const min = Math.min(...points);
  const range = max - min;

  // If all values are identical (e.g. all 0, or constant count)
  if (range === 0) {
    const y = max === 0 ? baselineY : height / 2;
    const flat = `M 0,${y.toFixed(1)} L ${width},${y.toFixed(1)}`;
    return { path: flat, fillPath: `${flat} L ${width},${height} L 0,${height} Z` };
  }

  const coords = points.map((val, idx) => {
    const x = (idx / (points.length - 1)) * width;
    const y = baselineY - ((val - min) / range) * usableHeight;
    return { x, y };
  });

  let path = `M ${coords[0].x.toFixed(1)},${coords[0].y.toFixed(1)}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const p0 = coords[i];
    const p1 = coords[i + 1];
    const cp1x = (p0.x + p1.x) / 2;
    const cp1y = p0.y;
    const cp2x = (p0.x + p1.x) / 2;
    const cp2y = p1.y;
    path += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p1.x.toFixed(1)},${p1.y.toFixed(1)}`;
  }

  const fillPath = `${path} L ${width},${height} L 0,${height} Z`;
  return { path, fillPath };
}

function StatCardChart({ values, accent, className, bars }: {
  values: number[];
  accent: string;
  className: string;
  bars: boolean;
}) {
  const gradientId = useId();
  const hasData = values.length > 0;
  if (bars && hasData) {
    const peak = Math.max(1, ...values);
    const slot = 200 / values.length;
    return (
      <svg className={cn(className, accent)} viewBox="0 0 200 40" preserveAspectRatio="none" aria-hidden="true">
        {values.map((value, index) => {
          const height = value === 0 ? 1 : Math.max(2, value / peak * 30);
          return <rect key={index} x={index * slot + slot * 0.16} y={34 - height}
            width={slot * 0.68} height={height} rx="2" fill="currentColor" opacity={value === 0 ? 0.4 : 0.86} />;
        })}
      </svg>
    );
  }

  const { path, fillPath } = pointsToPath(values);

  return (
    <svg
      className={cn(className, accent)}
      viewBox="0 0 200 40"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      {hasData && (
        <>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="100%">
              <stop stopColor="currentColor" stopOpacity=".16" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={fillPath} fill={`url(#${gradientId})`} />
        </>
      )}
      <path d={path} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"
        strokeDasharray={hasData ? undefined : '2 3'} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

const formatNumber = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format;

export function StatCard({
  title, value, icon: Icon, dataPoints, chartLabel, chartStyle,
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
  const bars = chartStyle === 'bars';
  return (
    <ChartDetails
      title={title}
      description={chartLabel ?? `${title} trend`}
      trigger={(
        <button type="button" aria-label={`View ${title} details`}
          className="stat-card w-full cursor-pointer text-left hover:border-primary/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary">
          {content}
          <StatCardChart values={values} accent={accent} className="stat-card-chart" bars={bars} />
        </button>
      )}
    >
      {dataPoints.length ? (
        <>
          <div className="rounded-lg border border-input bg-background px-3 py-1">
            <StatCardChart values={values} accent={accent} className="block h-24 w-full" bars={bars} />
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
