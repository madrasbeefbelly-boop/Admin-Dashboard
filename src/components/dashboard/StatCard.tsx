import { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface StatCardProps {
  title: string;
  value: string | number;
  badge?: {
    value: string;
    isPositive?: boolean;
  };
  icon: LucideIcon;
  dataPoints?: number[];
  className?: string;
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

export function StatCard({
  title,
  value,
  badge,
  icon: Icon,
  dataPoints = [],
  className,
}: StatCardProps) {
  const { path: pathD, fillPath: fillPathD } = pointsToPath(dataPoints);

  return (
    <div
      className={cn(
        'stat-card flex flex-col justify-between overflow-hidden relative group',
        className
      )}
    >
      <div className="flex items-start justify-between">
        {/* Metric Value & Title */}
        <div className="stat-card-metric">
          <div className="flex items-center gap-2">
            <span className="stat-card-value font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
              {typeof value === 'number' ? value.toLocaleString() : value}
            </span>
            {badge && (
              <span
                className={cn(
                  'text-[11px] font-bold px-1.5 py-0.5 rounded-md inline-flex items-center',
                  badge.isPositive !== false
                    ? 'text-emerald-600 bg-emerald-50'
                    : 'text-rose-600 bg-rose-50'
                )}
              >
                {badge.value}
              </span>
            )}
          </div>
          <p className="text-xs font-medium text-muted-foreground mt-1 capitalize">{title}</p>
        </div>

        {/* Top-Right Outline Icon */}
        <div className="text-rose-500/80 p-1.5 rounded-xl transition-colors group-hover:text-rose-600">
          <Icon className="size-6 stroke-[1.8]" />
        </div>
      </div>

      {/* Bottom Sparkline Wave derived from actual data */}
      <div className="w-full pt-4 -mx-1 -mb-1 overflow-hidden">
        <svg
          viewBox="0 0 200 40"
          preserveAspectRatio="none"
          className="w-full h-8 sm:h-9 overflow-visible"
        >
          <defs>
            <linearGradient id={`wave-gradient-${title.toLowerCase()}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e11d48" stopOpacity={0.12} />
              <stop offset="100%" stopColor="#e11d48" stopOpacity={0.0} />
            </linearGradient>
          </defs>
          <path
            d={fillPathD}
            fill={`url(#wave-gradient-${title.toLowerCase()})`}
          />
          <path
            d={pathD}
            fill="none"
            stroke="#e11d48"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}
