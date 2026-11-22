import { purchaseAmount, purchaseDay } from '@/lib/stat-series';
import { convertQuantity, normalizeUnit } from '@/lib/units';
import { isServedOrder } from '@/lib/utils';
import type { Order } from '@/types';

export type DashboardPeriod = 'Monthly' | 'Weekly';
type Purchase = Parameters<typeof purchaseDay>[0] & { created_at?: string };

const dateInIndia = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
});

function periodKey(value: string, period: DashboardPeriod) {
  const time = Date.parse(value);
  if (!Number.isFinite(time)) return '';
  return dateInIndia.format(time).slice(0, period === 'Monthly' ? 7 : 10);
}

export function dashboardActivity(orders: Order[], purchases: Purchase[], period: DashboardPeriod) {
  const monthly = period === 'Monthly';
  const now = Date.now();
  const [year, month] = dateInIndia.format(now).split('-').map(Number);
  const formatter = new Intl.DateTimeFormat('en-IN', monthly
    ? { timeZone: 'Asia/Kolkata', month: 'short' }
    : { timeZone: 'Asia/Kolkata', weekday: 'short', day: 'numeric' });
  const periods = Array.from({ length: monthly ? 6 : 7 }, (_, index) => {
    const time = monthly ? Date.UTC(year, month - 6 + index, 1) : now - (6 - index) * 86_400_000;
    return {
      key: periodKey(new Date(time).toISOString(), period),
      label: formatter.format(time),
      income: 0,
      expense: 0,
      placed: 0,
      served: 0,
    };
  });
  const byKey = new Map(periods.map((point) => [point.key, point]));
  for (const order of orders) {
    const point = byKey.get(periodKey(order.created_at, period));
    if (!point) continue;
    point.placed += 1;
    if (isServedOrder(order)) {
      point.served += 1;
      point.income += Number(order.total_amount) || 0;
    }
  }
  for (const purchase of purchases) {
    const date = purchaseDay(purchase);
    const point = byKey.get(date ? date.slice(0, monthly ? 7 : 10) : periodKey(purchase.created_at ?? '', period));
    const amount = purchaseAmount(purchase);
    if (point && Number.isFinite(amount)) point.expense += amount;
  }
  return periods.map((point) => ({ ...point, net: Math.round((point.income - point.expense) * 100) / 100 }));
}

export type DashboardActivity = ReturnType<typeof dashboardActivity>;

export function dashboardIngredientUsage(orders: Order[], activity: DashboardActivity, period: DashboardPeriod) {
  const included = new Set(activity.map((point) => point.key));
  const groups = new Map<string, Map<string, { id: string; name: string; quantity: number }>>();
  for (const order of orders) {
    if (!included.has(periodKey(order.inventory_deducted_at ?? order.created_at, period))) continue;
    for (const ingredient of order.ingredient_usage ?? []) {
      const original = normalizeUnit(ingredient.unit);
      const unit = original === 'g' ? 'kg' : original === 'ml' ? 'L' : original;
      const quantity = Number(ingredient.quantity_deducted);
      if (!unit || !Number.isFinite(quantity) || quantity <= 0) continue;
      const group = groups.get(unit) ?? new Map();
      const existing = group.get(ingredient.inventory_item_id);
      const total = (existing?.quantity ?? 0) + convertQuantity(quantity, original, unit);
      group.set(ingredient.inventory_item_id, { id: ingredient.inventory_item_id, name: ingredient.ingredient_name, quantity: total });
      groups.set(unit, group);
    }
  }
  return [...groups].map(([unit, ingredients]) => ({
    unit,
    ingredients: [...ingredients.values()].sort((a, b) => b.quantity - a.quantity || a.name.localeCompare(b.name)),
  })).sort((a, b) => (a.unit === 'kg' ? -1 : 0) - (b.unit === 'kg' ? -1 : 0) || a.unit.localeCompare(b.unit));
}

export type IngredientUsageGroup = ReturnType<typeof dashboardIngredientUsage>[number];
