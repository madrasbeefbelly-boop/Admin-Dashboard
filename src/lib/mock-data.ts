import { AxiosError, type AxiosAdapter, type InternalAxiosRequestConfig } from 'axios';
import { businessName, businessTagline } from '@/brand';
import type { InventoryItem, MenuCatalogItem, Order } from '@/types';

const suppliers = [
  { id: 'sample-grain', name: 'Sample Grain Supply', address: 'Chennai' },
  { id: 'sample-meat', name: 'Sample Butcher', address: 'Chennai' },
  { id: 'sample-market', name: 'Sample Produce Market', address: 'Chennai' },
];

const inventory: InventoryItem[] = [
  { id: 'sample-rice', name: 'Basmati Rice', category: 'Rice', unit: 'kg', current_stock: 48, minimum_stock: 12, cost_per_unit: 112 },
  { id: 'sample-beef', name: 'Boneless Beef', category: 'Meat', unit: 'kg', current_stock: 8.6, minimum_stock: 4, cost_per_unit: 420 },
  { id: 'sample-onions', name: 'Red Onions', category: 'Vegetables', unit: 'kg', current_stock: 6.2, minimum_stock: 3, cost_per_unit: 48 },
  { id: 'sample-oil', name: 'Cooking Oil', category: 'Oil', unit: 'L', current_stock: 3.5, minimum_stock: 2, cost_per_unit: 145 },
  { id: 'sample-spice', name: 'Pepper Masala', category: 'Spices', unit: 'kg', current_stock: 0.35, minimum_stock: 0.5, cost_per_unit: 660 },
  { id: 'sample-eggs', name: 'Eggs', category: 'Other', unit: 'pieces', current_stock: 31, minimum_stock: 12, cost_per_unit: 7 },
  { id: 'sample-noodles', name: 'Wheat Noodles', category: 'Other', unit: 'kg', current_stock: 5, minimum_stock: 2, cost_per_unit: 130 },
  { id: 'sample-wraps', name: 'Rumali Roti', category: 'Bakery', unit: 'pieces', current_stock: 6, minimum_stock: 10, cost_per_unit: 15 },
];

const recipe = (name: string, category: string, sellingPrice: number, image: string, quantities: Record<string, number>): MenuCatalogItem => {
  const ingredients = inventory.flatMap((item) => {
    const required = quantities[item.id];
    return required ? [{
      inventory_item_id: item.id, ingredient_name: item.name, quantity_required: required, unit: item.unit,
      current_stock: item.current_stock, inventory_unit: item.unit, cost_per_unit: item.cost_per_unit,
    }] : [];
  });
  const cost = Number(ingredients.reduce((total, item) => total + item.quantity_required * item.cost_per_unit, 0).toFixed(2));
  const servings = Math.min(...ingredients.map((item) => Math.floor(item.current_stock / item.quantity_required)));
  return {
    id: `sample-${image}`, name, category, description: null, image_url: `/MBB - Images/${image}`,
    cost_per_serving: cost, selling_price: sellingPrice, margin_percent: (sellingPrice - cost) / sellingPrice * 100,
    is_available: true, is_vegetarian: false, prep_time_minutes: 18, ingredients,
    servings_available: servings, is_in_stock: servings > 0,
  };
};

const menu = [
  recipe('Beef Thokku Biryani', 'Rice', 149, 'Beef Thooku Biryani Half Plate.jpg', { 'sample-rice': 0.18, 'sample-beef': 0.16, 'sample-onions': 0.05, 'sample-spice': 0.012 }),
  recipe('Beef Fried Rice', 'Rice', 140, 'Beef Fried Rice.jpg', { 'sample-rice': 0.18, 'sample-beef': 0.12, 'sample-eggs': 1, 'sample-oil': 0.02 }),
  recipe('Pepper Beef', 'Starters', 165, 'Pepper Beef.jpg', { 'sample-beef': 0.22, 'sample-onions': 0.08, 'sample-spice': 0.02 }),
  recipe('Khushka with Egg', 'Rice', 90, 'Khushka with Egg.jpg', { 'sample-rice': 0.18, 'sample-eggs': 1, 'sample-oil': 0.012 }),
  recipe('Beef Noodles', 'Noodles', 145, 'Beef Noodles.jpg', { 'sample-noodles': 0.16, 'sample-beef': 0.12, 'sample-oil': 0.018 }),
  recipe('Shawarma', 'Shawarma', 110, 'Shawarma.jpg', { 'sample-wraps': 1, 'sample-beef': 0.13, 'sample-onions': 0.035 }),
  recipe('Chilli Beef Gravy', 'Gravy', 140, 'Chilli Beef Gravy.jpg', { 'sample-beef': 0.3, 'sample-onions': 0.09, 'sample-spice': 0.024, 'sample-oil': 0.015 }),
  recipe('Beef Pakoda', 'Snacks', 100, 'Beef Pakoda.jpg', { 'sample-beef': 0.11, 'sample-onions': 0.09, 'sample-oil': 0.035 }),
];

const date = (daysAgo: number) => {
  const today = new Date();
  return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - daysAgo, 12));
};

const pastMonth = (offset: number) => {
  const today = date(0);
  return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - offset, 15, 12));
};

const orderDates = [
  ...[5, 3, 6, 2, 4, 7, 3, 4, 2, 5].flatMap((count, day) => Array.from({ length: count }, () => date(day))),
  ...[12, 8, 15, 10, 7].flatMap((count, month) => Array.from({ length: count }, () => pastMonth(month + 1))),
];

const orders: Order[] = orderDates.map((day, index) => {
  const status = index < 2 ? 'New' : index % 11 === 0 ? 'Canceled' : 'Served';
  const selection = index % 3 === 0 ? [menu[index % menu.length], menu[(index + 3) % menu.length]] : [menu[index % menu.length]];
  const items = selection.map((dish, line) => {
    const quantity = 1 + (index + line) % 3;
    const price = Number(dish.selling_price);
    return {
      id: `sample-line-${index}-${line}`, menu_item_id: dish.id, name: dish.name, category: dish.category,
      quantity, unit_price: price, line_total: price * quantity,
      ingredient_cost: status === 'Served' ? Number(dish.cost_per_serving) * quantity : null,
    };
  });
  return {
    id: `sample-order-${index}`, order_ref: `DEMO-${String(orderDates.length - index).padStart(3, '0')}`,
    customer_name: `Sample Customer ${index % 24 + 1}`, table_no: String(index % 8 + 1), payment_method: index % 3 ? 'UPI' : 'Cash',
    status, inventory_deducted: status === 'Served', items, total_amount: items.reduce((total, item) => total + item.line_total, 0),
    created_at: day.toISOString(), ...(status === 'Canceled' && { cancellation_reason: 'Sample cancellation' }),
  };
});

const purchases = [date(1), date(3), date(6), date(9), ...[1, 2, 3, 4, 5].map(pastMonth)].map((day, index) => {
  const item = inventory[index % inventory.length];
  return {
    id: `sample-purchase-${index}`, inventory_item_id: item.id, ingredient_name: item.name,
    supplier_name: suppliers[index % suppliers.length].name, purchase_date: day.toISOString().slice(0, 10),
    quantity: [18, 5, 12, 4, 2, 36, 9, 20, 14][index], unit: item.unit, unit_price: item.cost_per_unit,
  };
});

const lowStock = inventory.filter((item) => item.current_stock <= item.minimum_stock)
  .map((item) => ({ ...item, shortage: Number((item.minimum_stock - item.current_stock).toFixed(2)) }));

const responses = new Map<string, unknown>([
  ['/dashboard/stats', {
    low_stock_count: lowStock.length, inventory_count: inventory.length, purchase_count: purchases.length,
    inventory_value: inventory.reduce((total, item) => total + item.current_stock * item.cost_per_unit, 0),
  }],
  ['/orders', orders], ['/menu-items', menu], ['/inventory', inventory], ['/inventory/low-stock', lowStock],
  ['/purchases', purchases], ['/suppliers', suppliers],
  ['/profile', { name: businessName, tagline: businessTagline, email: 'kitchen@example.test', phone: '', address: '', city: 'Chennai' }],
  ['/notifications', [{
    id: 'sample-notification', title: 'Pepper masala is running low', message: '0.35 kg remaining in sample inventory.',
    is_read: false, created_at: date(0).toISOString(), reference_type: 'Inventory',
  }]],
]);

function mockError(config: InternalAxiosRequestConfig, status: number, message: string) {
  return new AxiosError(message, 'ERR_BAD_REQUEST', config, undefined, {
    status, statusText: message, headers: {}, config, data: { success: false, error: message },
  });
}

export const mockAdapter: AxiosAdapter = async (config) => {
  if (config.method !== 'get') throw mockError(config, 403, 'Mock Mode is read-only. Exit Mock Mode to save changes.');

  const path = config.url ?? '';
  let data = responses.get(path);
  if (path.startsWith('/menu-items/')) data = menu.find((item) => `/menu-items/${item.id}` === path);
  if (path === '/search') {
    const query = String(config.params?.q ?? '').trim().toLowerCase();
    const pick = (items: { id: string; name: string }[], type: string) => query.length < 2 ? [] : items
      .filter((item) => item.name.toLowerCase().includes(query)).slice(0, 5).map(({ id, name }) => ({ id, name, type }));
    data = { menuItems: pick(menu, 'menu'), inventory: pick(inventory, 'inventory') };
  }
  if (data === undefined) throw mockError(config, 404, 'This request is unavailable in Mock Mode.');

  return { status: 200, statusText: 'OK', headers: {}, config, data: { success: true, data } };
};
