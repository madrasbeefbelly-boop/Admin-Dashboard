export function statSeries<T>(items: T[], group: (item: T) => string, value: (item: T) => number = () => 1) {
  const totals = new Map<string, number>();
  for (const item of items) {
    const key = group(item);
    const amount = value(item);
    if (key && Number.isFinite(amount)) totals.set(key, (totals.get(key) ?? 0) + amount);
  }
  return [...totals].sort(([first], [second]) => first.localeCompare(second)).map(([, total]) => total);
}

type PurchaseLine = { purchase_date: string; quantity?: string | number; unit_price?: string | number };

export const purchaseDay = (item: PurchaseLine) => item.purchase_date?.slice(0, 10) ?? '';
export const purchaseAmount = (item: PurchaseLine) =>
  Number(item.quantity ?? 0) * Number(item.unit_price ?? 0);
