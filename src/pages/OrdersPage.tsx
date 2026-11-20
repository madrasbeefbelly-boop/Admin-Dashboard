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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  Plus,
  Minus,
  Trash2,
  Loader2,
  Receipt,
  ShoppingBag,
  CheckCircle2,
  Clock,
  History,
  Flame,
  PackageCheck,
  XCircle,
  AlertTriangle,
  ChefHat,
  ArrowRight,
  UtensilsCrossed,
} from 'lucide-react';
import { useMenuItems, useCreateOrder, useOrders, useDeleteOrder, useUpdateOrderStatus } from '@/hooks/api';
import { toast } from 'sonner';
import { Link } from 'react-router-dom';
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
  const updateStatus = useUpdateOrderStatus();

  const [selectedId, setSelectedId] = useState('');
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  // Shortage modal state
  const [shortageInfo, setShortageInfo] = useState<{
    open: boolean;
    orderRef?: string;
    shortages: { name: string; required: number; available: number; shortage: number; unit: string }[];
  }>({ open: false, shortages: [] });

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
      clearCart();
      await ordersRefetch();
      toast.success(`Order ${ref} created in 'New' status`);
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

  const handleStatusChange = async (order: any, nextStatus: 'Served' | 'Canceled') => {
    let reason: string | undefined = undefined;
    if (nextStatus === 'Canceled') {
      const proceed = window.confirm(`Cancel order ${order.order_ref}?`);
      if (!proceed) return;
      reason = window.prompt('Optional cancellation reason:') || 'Canceled by staff';
    }

    try {
      setUpdatingOrderId(order.id);
      await updateStatus.mutateAsync({
        id: order.id,
        status: nextStatus,
        cancellation_reason: reason,
      });

      if (nextStatus === 'Served') {
        toast.success(`Order ${order.order_ref} served! Ingredients deducted.`);
      } else {
        toast.info(`Order ${order.order_ref} marked Canceled.`);
      }
      await ordersRefetch();
    } catch (err: any) {
      const res = err?.response?.data;
      if (res?.shortages && res.shortages.length > 0) {
        setShortageInfo({
          open: true,
          orderRef: order.order_ref,
          shortages: res.shortages,
        });
        toast.error(`Insufficient stock! ${res.shortages.length} ingredient(s) are short.`);
      } else {
        toast.error(res?.error || err?.message || 'Failed to update order status');
      }
    } finally {
      setUpdatingOrderId(null);
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
                    const isOutOfStock = item.is_in_stock === false || item.servings_available === 0;
                    return (
                      <SelectItem key={item.id} value={item.id}>
                        <span className="flex items-center gap-2.5 w-full">
                          {item.image_url && item.image_url !== '/placeholder.svg' ? (
                            <img
                              src={item.image_url}
                              alt=""
                              className="size-7 rounded object-cover shrink-0 border border-border/60"
                              onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                            />
                          ) : (
                            <div className="size-7 rounded bg-rose-50 border border-rose-100 flex items-center justify-center shrink-0">
                              <UtensilsCrossed className="size-3.5 text-rose-400" />
                            </div>
                          )}
                          <span className="truncate">{item.name}</span>
                          {item.ingredients && item.ingredients.length > 0 && (
                            <span className={cn(
                              'text-[10px] px-1.5 py-0.5 rounded font-semibold shrink-0 ml-1',
                              isOutOfStock
                                ? 'bg-rose-100 text-rose-700'
                                : (item.servings_available ?? 0) <= 5
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-emerald-100 text-emerald-700'
                            )}>
                              {isOutOfStock ? '0 stock' : `${item.servings_available} in stock`}
                            </span>
                          )}
                          <span className="text-muted-foreground tabular-nums ml-auto shrink-0 pl-2">
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
                      {(() => {
                        const menuItem = (menuItems || []).find((m: any) => m.id === ci.menu_item_id);
                        const imgUrl = menuItem?.image_url;
                        return imgUrl && imgUrl !== '/placeholder.svg' ? (
                          <img
                            src={imgUrl}
                            alt=""
                            className="size-11 rounded-lg object-cover shrink-0 border border-border/80"
                            onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                          />
                        ) : (
                          <div className="size-11 rounded-lg bg-rose-50 border border-rose-100 flex items-center justify-center shrink-0">
                            <UtensilsCrossed className="size-5 text-rose-400" />
                          </div>
                        );
                      })()}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-tight [overflow-wrap:anywhere]">
                          {ci.name}
                        </p>
                        <p className="text-xs text-muted-foreground tabular-nums mt-0.5">
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
                    <ShoppingBag className="size-4 mr-2" /> Place Order
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

                            {/* Order Status Badge */}
                            {(!order.status || order.status === 'New' || order.status === 'Pending') && (
                              <Badge variant="outline" className="text-[11px] font-semibold text-amber-700 border-amber-300 bg-amber-50">
                                <Clock className="size-2.5 mr-1" />
                                Pending
                              </Badge>
                            )}

                            {(order.status === 'Served' || order.status === 'Completed' || order.status === 'Ready') && (
                              <Badge variant="outline" className="text-[11px] font-semibold text-emerald-700 border-emerald-300 bg-emerald-50">
                                <CheckCircle2 className="size-2.5 mr-1" />
                                Served
                              </Badge>
                            )}

                            {(order.status === 'Canceled' || order.status === 'Cancelled') && (
                              <Badge variant="outline" className="text-[11px] font-semibold text-rose-700 border-rose-300 bg-rose-50">
                                <XCircle className="size-2.5 mr-1" />
                                Canceled
                              </Badge>
                            )}

                            {order.inventory_deducted && (
                              <Badge variant="outline" className="text-[10px] font-medium text-emerald-700 border-emerald-200 bg-emerald-50/80">
                                ✓ Stock Deducted
                              </Badge>
                            )}
                          </div>

                          <p className="text-[11px] text-muted-foreground mt-0.5">
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

                          {Array.isArray(order.items) && order.items.length > 0 ? (
                            <ul className="mt-2.5 space-y-1 text-xs border-l-2 border-gold/30 pl-2.5">
                              {order.items.map((i: any, idx: number) => (
                                <li key={idx} className="flex items-center justify-between gap-3 text-muted-foreground">
                                  <span className="flex items-center gap-2 min-w-0">
                                    {(() => {
                                      const menuItem = (menuItems || []).find((m: any) => m.id === i.menu_item_id || m.name === i.name);
                                      const imgUrl = menuItem?.image_url;
                                      return imgUrl && imgUrl !== '/placeholder.svg' ? (
                                        <img
                                          src={imgUrl}
                                          alt=""
                                          className="size-6 rounded object-cover shrink-0 border border-border/60"
                                          onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                                        />
                                      ) : (
                                        <div className="size-6 rounded bg-rose-50 border border-rose-100 flex items-center justify-center shrink-0">
                                          <UtensilsCrossed className="size-3 text-rose-400" />
                                        </div>
                                      );
                                    })()}
                                    <span className="truncate">{i.name}</span>{' '}
                                    <span className="font-semibold text-foreground shrink-0">×{i.quantity}</span>
                                  </span>
                                  {Number(i.line_total ?? (i.unit_price * i.quantity)) > 0 && (
                                    <span className="tabular-nums shrink-0">
                                      ₹{Number(i.line_total ?? (i.unit_price * i.quantity)).toFixed(2)}
                                    </span>
                                  )}
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-xs text-muted-foreground mt-1">No item breakdown</p>
                          )}

                          {/* Order Status Action Controls: Exactly 2 buttons (Served and Canceled) */}
                          <div className="mt-3 flex items-center gap-2.5 flex-wrap pt-2.5 border-t border-border/50">
                            {(!order.status || order.status === 'New' || order.status === 'Pending') ? (
                              <>
                                <Button
                                  size="sm"
                                  className="h-8 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all"
                                  disabled={updatingOrderId === order.id}
                                  onClick={() => handleStatusChange(order, 'Served')}
                                >
                                  {updatingOrderId === order.id ? (
                                    <Loader2 className="size-3.5 mr-1.5 animate-spin" />
                                  ) : (
                                    <CheckCircle2 className="size-3.5 mr-1.5" />
                                  )}
                                  Served
                                </Button>

                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 px-3 border-rose-200 text-rose-600 hover:text-rose-700 hover:bg-rose-50 text-xs font-semibold shadow-xs"
                                  disabled={updatingOrderId === order.id}
                                  onClick={() => handleStatusChange(order, 'Canceled')}
                                >
                                  <XCircle className="size-3.5 mr-1.5" />
                                  Canceled
                                </Button>
                              </>
                            ) : (
                              <span className="text-[11px] font-medium flex items-center gap-1.5">
                                {order.status === 'Canceled' || order.status === 'Cancelled' ? (
                                  <span className="text-rose-600 font-semibold">
                                    {order.cancellation_reason ? `Canceled: ${order.cancellation_reason}` : 'Order was canceled'}
                                  </span>
                                ) : (
                                  <span className="text-emerald-700 font-semibold flex items-center gap-1">
                                    <CheckCircle2 className="size-3 text-emerald-600" /> Fulfilled &amp; Served
                                  </span>
                                )}
                              </span>
                            )}
                          </div>
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

      {/* Shortages Rejection Dialog */}
      <Dialog
        open={shortageInfo.open}
        onOpenChange={(open) => setShortageInfo((prev) => ({ ...prev, open }))}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600 font-bold">
              <AlertTriangle className="size-5 shrink-0" />
              Insufficient Stock
            </DialogTitle>
            <DialogDescription>
              Order <strong>{shortageInfo.orderRef}</strong> cannot be marked as Served because required ingredient stock is insufficient.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="rounded-lg border border-rose-200 bg-rose-50/70 p-3 text-xs text-rose-800 leading-relaxed">
              Serving this order was blocked to prevent negative inventory. Please restock these ingredients:
            </div>

            <div className="rounded-xl border border-slate-200 divide-y divide-slate-100 overflow-hidden text-sm bg-white shadow-xs">
              {shortageInfo.shortages.map((s, idx) => (
                <div key={idx} className="p-3 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 truncate">{s.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Available: <span className="font-semibold text-amber-700">{s.available} {s.unit}</span>
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-xs text-slate-500">Need: <span className="font-semibold">{s.required} {s.unit}</span></p>
                    <span className="inline-block mt-1 text-[11px] font-bold px-2 py-0.5 rounded bg-rose-50 border border-rose-200 text-rose-700">
                      Short: {s.shortage} {s.unit}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <DialogFooter className="flex sm:justify-between items-center gap-2">
            <Button asChild variant="outline" className="border-slate-300">
              <Link to="/inventory">
                Go to Inventory <ArrowRight className="size-3.5 ml-1.5" />
              </Link>
            </Button>
            <Button
              className="bg-[#e11d48] hover:bg-[#be123c] text-white"
              onClick={() => setShortageInfo({ open: false, shortages: [] })}
            >
              Understood
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
