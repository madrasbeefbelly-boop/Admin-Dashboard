export interface StatPoint {
  label: string;
  value: number;
}

export const formatStatCurrency = new Intl.NumberFormat('en-IN', {
  style: 'currency', currency: 'INR', maximumFractionDigits: 2,
}).format;

const dateLabel = new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

export function formatStatLabel(label: string) {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(label) ? new Date(label) : null;
  return date && Number.isFinite(date.getTime()) ? dateLabel.format(date) : label;
}

export function statSeries<T>(items: T[], group: (item: T) => string, value: (item: T) => number = () => 1) {
  const totals = new Map<string, number>();
  for (const item of items) {
    const key = group(item);
    const amount = value(item);
    if (key && Number.isFinite(amount)) totals.set(key, (totals.get(key) ?? 0) + amount);
  }
  return [...totals].sort(([first], [second]) => first.localeCompare(second)).map(([label, value]) => ({ label, value }));
}

type PurchaseLine = { purchase_date: string; quantity?: string | number; unit_price?: string | number };

export const purchaseDay = (item: PurchaseLine) => item.purchase_date?.slice(0, 10) ?? '';
export const purchaseAmount = (item: PurchaseLine) =>
  Number(item.quantity ?? 0) * Number(item.unit_price ?? 0);
