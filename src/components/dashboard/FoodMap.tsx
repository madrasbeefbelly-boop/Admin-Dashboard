import { useState } from 'react';
import { Utensils } from 'lucide-react';
import type { Order } from '@/types';
import { summarizeFoodSales } from '@/lib/food-sales';

const businessDate = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
});
const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 });

export function FoodMap({ orders }: { orders: Order[] }) {
  const [days, setDays] = useState(30);
  const [showAll, setShowAll] = useState(false);
  const start = new Date(`${businessDate.format(new Date())}T00:00:00+05:30`).getTime() - (days - 1) * 86_400_000;
  const dishes = summarizeFoodSales(days ? orders.filter((order) => new Date(order.created_at).getTime() >= start) : orders);
  const servings = dishes.reduce((total, dish) => total + dish.quantity, 0);
  const shown = showAll ? dishes : dishes.slice(0, 5);

  return (
    <section aria-labelledby="food-map-title" className="card-premium min-w-0 p-5 sm:p-6 lg:col-span-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2">
            <span aria-hidden="true" className="inline-block h-5 w-1.5 rounded-full bg-primary" />
            <h3 id="food-map-title" className="font-display text-lg font-bold tracking-tight">Food Map</h3>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Servings sold and dish revenue</p>
        </div>
        <select aria-label="Food Map period" value={days} onChange={(event) => { setDays(Number(event.target.value)); setShowAll(false); }}
          className="min-h-9 rounded-lg border border-input bg-background px-2 text-xs font-semibold text-slate-700 focus-visible:outline-2 focus-visible:outline-primary">
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={0}>All time</option>
        </select>
      </div>

      {shown.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">
          <Utensils className="mx-auto mb-2 size-7" aria-hidden="true" />
          No dishes served in this period.
        </div>
      ) : (
        <>
          <ol className="space-y-3" aria-label="Dishes ranked by servings sold">
            {shown.map((dish) => (
              <li key={dish.id} className="min-w-0 space-y-1">
                <div className="flex items-baseline justify-between gap-2 text-sm">
                  <span className="min-w-0 font-semibold wrap-anywhere">{dish.name}</span>
                  <span className="shrink-0 font-semibold tabular-nums text-primary">{dish.quantity.toLocaleString('en-IN')} sold</span>
                </div>
                <div aria-hidden="true" className="h-1.5 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${dish.quantity / dishes[0].quantity * 100}%` }} />
                </div>
                <div className="flex flex-wrap justify-between gap-x-2 text-xs text-muted-foreground">
                  <span>{dish.category} · {Math.round(dish.quantity / servings * 100)}% of servings</span>
                  <span className="tabular-nums">{currency.format(dish.revenue)} revenue</span>
                </div>
              </li>
            ))}
          </ol>
          {dishes.length > 5 && (
            <button type="button" aria-expanded={showAll} onClick={() => setShowAll(!showAll)}
              className="mt-3 min-h-10 text-sm font-semibold text-primary underline-offset-4 hover:underline">
              {showAll ? 'Show top five' : `Show all ${dishes.length} dishes`}
            </button>
          )}
        </>
      )}
    </section>
  );
}
