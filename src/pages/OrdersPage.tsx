import { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import {
  Plus,
  Minus,
  Trash2,
  Loader2,
  Receipt,
  ShoppingBag,
  AlertTriangle,
  CheckCircle2,
  Clock,
  History,
} from 'lucide-react';
import { useMenuItems, useCreateOrder, useOrders, useDeleteOrder } from '@/hooks/api';
import { toast } from 'sonner';
import type { OrderItem } from '@/types';

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });

function formatPrice(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return new Date(dateStr).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
}

export default function OrdersPage() {
  const { data: menuItems = [], isLoading: menuLoading, error: menuError, refetch: menuRefetch } = useMenuItems();
  const { data: orders = [], isLoading: ordersLoading, refetch: ordersRefetch } = useOrders();
  const createOrder = useCreateOrder();
  const deleteOrder = useDeleteOrder();

  const [selectedId, setSelectedId] = useState('');
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [printerError, setPrinterError] = useState(false);
  const [lastRef, setLastRef] = useState('');

  const availableItems = useMemo(() => menuItems, [menuItems]);

  const subtotal = cart.reduce((sum, ci) => sum + ci.unit_price * ci.quantity, 0);
  const totalItems = cart.reduce((sum, ci) => sum + ci.quantity, 0);

  const handleAddItem = () => {
    if (!selectedId) {
      toast.error('Select an item first');
      return;
    }
    const item = availableItems.find((i) => i.id === selectedId);
    if (!item) return;
    const price = formatPrice(item.selling_price) ?? 0;
    setCart((prev) => {
      const existing = prev.find((ci) => ci.menu_item_id === item.id);
      if (existing) {
        return prev.map((ci) =>
          ci.menu_item_id === item.id ? { ...ci, quantity: ci.quantity + 1 } : ci,
        );
      }
      return [
        ...prev,
        {
          menu_item_id: item.id,
          name: item.name,
          unit_price: price,
          quantity: 1,
          category: item.category,
        },
      ];
    });
    setSelectedId('');
  };

  const changeQty = (id: string, delta: number) =>
    setCart((prev) =>
      prev
        .map((ci) => (ci.menu_item_id === id ? { ...ci, quantity: ci.quantity + delta } : ci))
        .filter((ci) => ci.quantity > 0),
    );

  const removeFromCart = (id: string) =>
    setCart((prev) => prev.filter((ci) => ci.menu_item_id !== id));

  const clearCart = () => setCart([]);

  const handlePlaceOrder = async () => {
    if (cart.length === 0) {
      toast.error('Add at least one item');
      return;
    }
    try {
      const result = await createOrder.mutateAsync({
        customer_name: null,
        table_no: null,
        payment_method: 'Cash',
        items: cart,
        total_amount: subtotal,
      });
      const ref = result?.data?.data?.order_ref ?? result?.data?.order_ref ?? '—';
      setLastRef(ref);
      clearCart();
      setPrinterError(true);
      await ordersRefetch();
      toast.success('Order recorded in database');
    } catch (err: any) {
      console.error('Order creation error:', err);
      const msg = err?.response?.data?.error || err?.message || 'Could not place order. Please try again.';
      toast.error(msg);
    }
  };

  const handleDeleteOrder = async (id: string) => {
    if (!window.confirm('Delete this order?')) return;
    try {
      await deleteOrder.mutateAsync(id);
      await ordersRefetch();
      toast.success('Order deleted');
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Could not delete order';
      toast.error(msg);
    }
  };

  if (menuLoading) {
    return (
      <DashboardLayout title="Orders" subtitle="Place orders and track sales">
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="size-8 animate-spin text-gold" />
        </div>
      </DashboardLayout>
    );
  }

  if (menuError) {
    return (
      <DashboardLayout title="Orders" subtitle="Place orders and track sales">
        <div className="card-premium p-8 text-center text-destructive">
          Failed to load menu.
          <Button onClick={() => menuRefetch()} className="mt-4 block mx-auto">
            Try Again
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Orders" subtitle="Place orders and track sales">
      {/* ── Printer error banner ── */}
      {printerError && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-destructive/40 bg-destructive/10 px-5 py-4">
          <AlertTriangle className="size-6 text-destructive shrink-0" />
          <div className="flex-1">
            <p className="font-semibold text-destructive">PLEASE CONNECT THE BILL PRINTER</p>
            <p className="text-sm text-muted-foreground">
              Order <span className="font-mono font-medium text-foreground">{lastRef}</span> was saved to the database.
              Bill will print once the printer is connected.
            </p>
          </div>
          <button
            className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-medium text-destructive hover:bg-destructive/10 border border-destructive/30"
            onClick={() => setPrinterError(false)}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Two-Column Layout: Left for Placing Orders, Right for Order History */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ── LEFT COLUMN: Select & Cart (5 cols on lg) ── */}
        <div className="lg:col-span-5 space-y-4">
          {/* Item selector */}
          <div className="card-premium p-5 space-y-3">
            <p className="text-sm font-medium text-muted-foreground">Select item</p>
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger className="w-full" aria-label="Select a menu item">
                <SelectValue placeholder="— Choose a dish —" />
              </SelectTrigger>
              <SelectContent>
                {availableItems.length === 0 ? (
                  <SelectItem value="__none" disabled>
                    No menu items — add dishes in Menu &amp; Costing
                  </SelectItem>
                ) : (
                  availableItems.map((item) => {
                    const price = formatPrice(item.selling_price);
                    return (
                      <SelectItem key={item.id} value={item.id}>
                        <span className="flex items-center justify-between gap-4 w-full">
                          <span>{item.name}</span>
                          <span className="text-muted-foreground tabular-nums">
                            {price != null ? `₹${price.toFixed(0)}` : '—'}
                          </span>
                        </span>
                      </SelectItem>
                    );
                  })
                )}
              </SelectContent>
            </Select>
            <Button
              className="w-full bg-gold hover:bg-gold-light text-primary-foreground font-semibold"
              onClick={handleAddItem}
              disabled={!selectedId}
            >
              <Plus className="size-4 mr-2" /> Add Item
            </Button>
          </div>

          {/* Cart */}
          <div className="card-premium overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
              <ShoppingBag className="size-4 text-gold" />
              <span className="font-semibold">Current Order</span>
              {totalItems > 0 && (
                <span className="ml-auto text-sm text-muted-foreground tabular-nums">
                  {totalItems} item{totalItems !== 1 && 's'}
                </span>
              )}
            </div>

            <ScrollArea className="max-h-72">
              {cart.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <Receipt className="mx-auto mb-2 size-8 text-muted-foreground/30" />
                  <p className="text-sm text-muted-foreground">No items added yet</p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {cart.map((ci) => (
                    <div key={ci.menu_item_id} className="flex items-center gap-3 px-5 py-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-tight [overflow-wrap:anywhere]">
                          {ci.name}
                        </p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          ₹{ci.unit_price.toFixed(0)} × {ci.quantity}
                        </p>
                      </div>
                      <span className="font-semibold tabular-nums text-sm shrink-0">
                        ₹{(ci.unit_price * ci.quantity).toFixed(0)}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          className="size-6 rounded flex items-center justify-center hover:bg-secondary"
                          onClick={() => changeQty(ci.menu_item_id, -1)}
                          aria-label="Remove one"
                        >
                          <Minus className="size-3" />
                        </button>
                        <span className="text-xs w-4 text-center tabular-nums">{ci.quantity}</span>
                        <button
                          className="size-6 rounded flex items-center justify-center hover:bg-secondary"
                          onClick={() => changeQty(ci.menu_item_id, 1)}
                          aria-label="Add one"
                        >
                          <Plus className="size-3" />
                        </button>
                        <button
                          className="size-6 rounded flex items-center justify-center text-destructive hover:bg-destructive/10"
                          onClick={() => removeFromCart(ci.menu_item_id)}
                          aria-label={`Remove ${ci.name}`}
                        >
                          <Trash2 className="size-3" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>

            <div className={cn('px-5 py-4 space-y-3', cart.length > 0 && 'border-t border-border')}>
              <div className="flex items-center justify-between font-semibold text-lg">
                <span>Total</span>
                <span className="text-gold tabular-nums">{currency.format(subtotal)}</span>
              </div>
              <Button
                className="w-full bg-gold hover:bg-gold-light text-primary-foreground font-semibold"
                disabled={cart.length === 0 || createOrder.isPending}
                onClick={handlePlaceOrder}
              >
                {createOrder.isPending ? (
                  <>
                    <Loader2 className="size-4 mr-2 animate-spin" /> Placing…
                  </>
                ) : (
                  <>
                    <Receipt className="size-4 mr-2" /> Place Order &amp; Generate Bill
                  </>
                )}
              </Button>
              {cart.length > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-muted-foreground hover:text-destructive"
                  onClick={clearCart}
                >
                  <Trash2 className="size-3.5 mr-1.5" /> Clear order
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* ── RIGHT COLUMN: Order History (7 cols on lg) ── */}
        <div className="lg:col-span-7 space-y-4">
          <div className="card-premium overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-border">
              <div className="flex items-center gap-2">
                <History className="size-4 text-gold" />
                <h2 className="font-semibold text-base">Order History</h2>
              </div>
              {orders.length > 0 && (
                <Badge variant="outline" className="text-xs">
                  {orders.length} order{orders.length !== 1 && 's'}
                </Badge>
              )}
            </div>

            {ordersLoading ? (
              <div className="py-16 text-center text-muted-foreground flex items-center justify-center gap-2">
                <Loader2 className="size-4 animate-spin text-gold" /> Loading order history…
              </div>
            ) : orders.length === 0 ? (
              <div className="py-16 text-center">
                <Clock className="mx-auto mb-2 size-8 text-muted-foreground/30" />
                <p className="text-muted-foreground text-sm">No orders recorded yet</p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Place an order on the left to see it appear here.
                </p>
              </div>
            ) : (
              <>
                <ScrollArea className="max-h-[580px]">
                  <div className="divide-y divide-border">
                    {orders.map((order) => (
                      <div key={order.id} className="flex items-start gap-4 px-5 py-3.5 hover:bg-secondary/20 transition-colors">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-mono text-sm font-semibold">{order.order_ref}</span>
                            <Badge variant="outline" className="text-[11px] text-success border-success/30 bg-success/5">
                              <CheckCircle2 className="size-2.5 mr-1" />
                              {order.status || 'Completed'}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {Array.isArray(order.items) && order.items.length > 0
                              ? order.items.map((i: any) => `${i.name} ×${i.quantity}`).join(' · ')
                              : 'No item breakdown'}
                          </p>
                          <p className="text-[11px] text-muted-foreground/70 mt-1">
                            {order.created_at ? (
                              <>
                                {new Date(order.created_at).toLocaleString('en-IN', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  hour12: true,
                                })}
                                {' · '}
                                {timeAgo(order.created_at)}
                              </>
                            ) : (
                              'Recently placed'
                            )}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-semibold text-gold tabular-nums text-base">
                            {currency.format(Number(order.total_amount))}
                          </p>
                        </div>
                        <button
                          className="size-7 rounded flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0 mt-0.5"
                          onClick={() => handleDeleteOrder(order.id)}
                          aria-label="Delete order"
                          title="Delete order"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
                <div className="px-5 py-3.5 border-t border-border flex items-center justify-between text-sm bg-secondary/10">
                  <span className="text-muted-foreground">{orders.length} order{orders.length !== 1 && 's'} total</span>
                  <span className="font-semibold text-gold tabular-nums">
                    {currency.format(orders.reduce((s, o) => s + (Number(o.total_amount) || 0), 0))} total revenue
                  </span>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
