export interface MenuItemIngredient {
  id?: string;
  menu_item_id?: string;
  inventory_item_id: string;
  ingredient_name: string;
  quantity_required: number;
  unit: string;
  current_stock?: number;
  inventory_unit?: string;
  cost_per_unit?: number;
}

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
  image_url?: string | null;
  ingredients?: MenuItemIngredient[];
  servings_available?: number | null;
  is_in_stock?: boolean;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  current_stock: number;
  minimum_stock: number;
  cost_per_unit: number;
  supplier_id?: string | null;
  supplier_name?: string | null;
  expiry_date?: string | null;
  is_active?: boolean;
}

export interface InventoryMovement {
  id: string;
  inventory_item_id: string;
  order_id?: string | null;
  movement_type: string;
  quantity: number;
  unit: string;
  previous_stock: number;
  new_stock: number;
  notes?: string | null;
  created_at: string;
  ingredient_name?: string;
  category?: string;
  order_ref?: string | null;
}

export interface LowStockItem {
  id: string;
  name: string;
  unit: string;
  current_stock: string | number;
  minimum_stock: string | number;
  shortage?: string | number;
  supplier_name?: string | null;
}

export interface DashboardStats {
  low_stock_count: string | number;
  inventory_value: string | number | null;
  inventory_count: string | number;
  purchase_count: string | number;
}

export interface OrderItem {
  id?: string;
  menu_item_id?: string;
  name: string;
  unit_price: number;
  quantity: number;
  category?: string;
  line_total?: number;
}

export interface Order {
  id: string;
  order_ref: string;
  customer_name: string | null;
  table_no: string | null;
  payment_method: string;
  total_amount: string | number;
  status: 'New' | 'Preparing' | 'Ready' | 'Completed' | 'Cancelled';
  inventory_deducted?: boolean;
  inventory_deducted_at?: string | null;
  cancellation_reason?: string | null;
  created_at: string;
  items: OrderItem[];
}
