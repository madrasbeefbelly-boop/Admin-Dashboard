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
  waveVariant?: 1 | 2 | 3 | 4;
  className?: string;
}

const wavePaths: Record<number, string> = {
  // Wave 1: Rolling undulating wave (Menus)
  1: 'M 0,28 C 15,30 25,18 40,24 C 55,30 70,12 85,22 C 100,32 115,16 130,24 C 145,32 160,10 175,18 C 185,23 195,14 200,16',
  // Wave 2: Energetic wave with central peak and hills (Orders)
  2: 'M 0,30 C 12,30 20,22 30,27 C 40,32 48,12 58,26 C 68,36 78,16 88,28 C 98,38 108,6 118,18 C 128,28 138,14 148,24 C 158,32 168,10 178,20 C 188,26 195,12 200,16',
  // Wave 3: Gentler low-amplitude rolling wave (Customers)
  3: 'M 0,24 C 20,28 35,18 55,24 C 75,30 95,16 115,22 C 135,28 155,14 175,20 C 188,24 195,16 200,18',
  // Wave 4: Wave rising towards right (Income)
  4: 'M 0,30 C 30,30 60,28 90,26 C 120,24 140,8 165,12 C 180,14 190,28 200,22',
};

export function StatCard({
  title,
  value,
  badge,
  icon: Icon,
  waveVariant = 1,
  className,
}: StatCardProps) {
  const pathD = wavePaths[waveVariant] || wavePaths[1];
  const fillPathD = `${pathD} L 200,40 L 0,40 Z`;

  return (
    <div
      className={cn(
        'stat-card flex flex-col justify-between overflow-hidden relative group',
        className
      )}
    >
      <div className="flex items-start justify-between">
        {/* Metric Value & Title */}
        <div>
          <div className="flex items-center gap-2">
            <span className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-slate-900 tabular-nums">
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
          <p className="text-xs font-medium text-slate-400 mt-1 capitalize">{title}</p>
        </div>

        {/* Top-Right Outline Icon */}
        <div className="text-rose-500/80 p-1.5 rounded-xl transition-colors group-hover:text-rose-600">
          <Icon className="size-6 stroke-[1.8]" />
        </div>
      </div>

      {/* Bottom Sparkline Wave */}
      <div className="w-full pt-4 -mx-1 -mb-1 overflow-hidden">
        <svg
          viewBox="0 0 200 40"
          preserveAspectRatio="none"
          className="w-full h-8 sm:h-9 overflow-visible"
        >
          <defs>
            <linearGradient id={`wave-gradient-${waveVariant}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e11d48" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#e11d48" stopOpacity="0.0" />
            </linearGradient>
          </defs>
          <path
            d={fillPathD}
            fill={`url(#wave-gradient-${waveVariant})`}
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
