import { useId } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  dataPoints?: number[];
  chartLabel?: string;
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

export function StatCard({ title, value, icon: Icon, dataPoints = [], chartLabel, accent = 'text-primary' }: StatCardProps) {
  const { path, fillPath } = pointsToPath(dataPoints);
  const gradientId = useId();
  const hasData = dataPoints.length > 0;

  return (
    <div className="stat-card">
      <p className="stat-card-title">{title}</p>
      <Icon aria-hidden="true" className={cn('stat-card-icon', accent)} />
      <p className="stat-card-value font-display tabular-nums">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      <svg
        className={cn('stat-card-chart', accent)}
        viewBox="0 0 200 40"
        preserveAspectRatio="none"
        role="img"
        aria-label={hasData ? chartLabel ?? `${title} trend` : 'No chart data yet'}
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
    </div>
  );
}
