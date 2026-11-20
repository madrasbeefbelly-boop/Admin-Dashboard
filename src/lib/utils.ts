import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Order } from "@/types";

export function isServedOrder(order: Pick<Order, 'status'>) {
  return order.status === 'Served' || order.status === 'Completed';
}

export function averageMenuMargin(items: { margin_percent: string | number | null }[]) {
  const margins = items.flatMap(({ margin_percent }) => margin_percent == null ? [] : [Number(margin_percent)]);
  return margins.length ? margins.reduce((sum, margin) => sum + margin, 0) / margins.length : null;
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
