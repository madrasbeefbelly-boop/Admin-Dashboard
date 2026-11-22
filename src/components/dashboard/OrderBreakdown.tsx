import { ClipboardList, ArrowUpRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { Order } from '@/types';
import { isServedOrder } from '@/lib/utils';
import { ChartDetails } from './ChartDetails';

export function OrderBreakdown({ orders }: { orders: Order[] }) {
  const served = orders.filter(isServedOrder).length;
  const canceled = orders.filter(({ status }) => status === 'Canceled' || status === 'Cancelled').length;
  const statuses = [
    { label: 'Served', count: served, color: 'bg-emerald-600' },
    { label: 'Open', count: orders.length - served - canceled, color: 'bg-amber-500' },
    { label: 'Canceled', count: canceled, color: 'bg-slate-500' },
  ];

  return (
    <section aria-labelledby="order-breakdown-title" className="card-premium p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <ClipboardList className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden="true" />
          <div>
            <h3 id="order-breakdown-title" className="font-display text-lg font-bold tracking-tight">Order Breakdown</h3>
            <p className="text-xs text-muted-foreground">All-time order counts by status</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/orders" className="inline-flex min-h-9 items-center gap-1 text-sm font-semibold text-primary hover:underline">
            View Orders <ArrowUpRight className="size-3.5" aria-hidden="true" />
          </Link>
          <ChartDetails title="Order Breakdown" description="All-time counts and share of orders by status">
            {orders.length ? (
              <ul className="space-y-4">
                {statuses.map(({ label, color, count }) => {
                  const share = count / orders.length * 100;
                  return (
                    <li key={label} className="space-y-1.5">
                      <div className="flex flex-wrap justify-between gap-x-3 text-sm">
                        <span className="font-medium">{label}</span>
                        <span className="tabular-nums">{count.toLocaleString('en-IN')} orders · {share.toLocaleString('en-IN', { maximumFractionDigits: 1 })}%</span>
                      </div>
                      <div aria-hidden="true" className="h-2 overflow-hidden rounded-full bg-secondary">
                        <div className={`h-full ${color}`} style={{ width: `${share}%` }} />
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : <p className="text-sm text-muted-foreground">No orders recorded yet.</p>}
          </ChartDetails>
        </div>
      </div>

      {orders.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">No orders recorded yet.</p>
      ) : (
        <>
          <div aria-hidden="true" className="mt-4 flex h-2 overflow-hidden rounded-full bg-secondary">
            {statuses.map(({ label, color, count }) => (
              <span key={label} className={color} style={{ width: `${count / orders.length * 100}%` }} />
            ))}
          </div>
          <dl className="mt-3 grid grid-cols-3 gap-2 sm:gap-4">
            {statuses.map(({ label, color, count }) => (
              <div key={label} className="min-w-0">
                <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span aria-hidden="true" className={`size-2 shrink-0 rounded-full ${color}`} />
                  {label}
                </dt>
                <dd className="mt-1 font-display text-xl font-bold tabular-nums">{count.toLocaleString('en-IN')}</dd>
              </div>
            ))}
          </dl>
        </>
      )}
    </section>
  );
}
