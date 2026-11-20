export interface MenuCatalogItem {
  id: string;
  name: string;
  category: string;
  description: string | null;
  cost_per_serving: string | number | null;
  selling_price: string | number | null;
  margin_percent: string | number | null;
  is_available: boolean;
  is_vegetarian: boolean;
  prep_time_minutes: number | null;
}

export interface LowStockItem {
  id: string;
  name: string;
  unit: string;
  current_stock: string | number;
  minimum_stock: string | number;
}

export interface DashboardStats {
  low_stock_count: string | number;
  inventory_value: string | number | null;
  inventory_count: string | number;
  purchase_count: string | number;
}

export interface OrderItem {
  menu_item_id: string;
  name: string;
  unit_price: number;
  quantity: number;
  category: string;
}

export interface Order {
  id: string;
  order_ref: string;
  customer_name: string | null;
  table_no: string | null;
  payment_method: string;
  total_amount: string | number;
  status: string;
  created_at: string;
  items: OrderItem[];
}
