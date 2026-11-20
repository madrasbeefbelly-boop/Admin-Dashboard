import type { Order } from '@/types';

export function summarizeFoodSales(orders: Order[]) {
  const dishes = new Map<string, { id: string; name: string; category: string; quantity: number; revenue: number }>();
  for (const order of orders) {
    for (const item of order.items ?? []) {
      const quantity = Number(item.quantity);
      if (!item.name || !Number.isFinite(quantity) || quantity <= 0) continue;
      const id = item.menu_item_id ?? item.name;
      const dish = dishes.get(id) ?? { id, name: item.name, category: item.category || 'Dishes', quantity: 0, revenue: 0 };
      const revenue = Number(item.line_total ?? Number(item.unit_price) * quantity);
      dish.quantity += quantity;
      dish.revenue += Number.isFinite(revenue) ? revenue : 0;
      dishes.set(id, dish);
    }
  }
  return [...dishes.values()].sort((a, b) => b.quantity - a.quantity || b.revenue - a.revenue || a.name.localeCompare(b.name));
}
