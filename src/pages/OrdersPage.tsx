import { useEffect, useMemo, useRef, useState } from 'react';
import { catalogPhotoSource } from '@/lib/catalog-photo';
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
import { isMockMode } from '@/lib/mock-mode';
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
import { Link, useLocation } from 'react-router-dom';
import { newOrderTarget } from '@/components/layout/navigation';
import type { OrderItem } from '@/types';

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });
const cartPrice = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 2 });

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
  const mockMode = isMockMode();
  const { data: menuItems = [], isLoading: menuLoading, error: menuError, refetch: menuRefetch } = useMenuItems();
  const { data: orders = [], isLoading: ordersLoading, refetch: ordersRefetch } = useOrders();
  const createOrder = useCreateOrder();
  const deleteOrder = useDeleteOrder();
  const updateStatus = useUpdateOrderStatus();
  const { hash, key } = useLocation();
  const orderSection = useRef<HTMLDivElement>(null);

  const [selectedId, setSelectedId] = useState('');
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [updatingOrderId, setUpdatingOrderId] = useState<string | null>(null);

  useEffect(() => {
    if (hash !== '#' + newOrderTarget || menuLoading) return;
    orderSection.current?.scrollIntoView({ block: 'start' });
    orderSection.current?.focus({ preventScroll: true });
  }, [hash, key, menuLoading]);

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
      const response = await updateStatus.mutateAsync({
        id: order.id,
        status: nextStatus,
        cancellation_reason: reason,
      });

      if (nextStatus === 'Served') {
        const deducted = response.data.data?.deduction_count > 0;
        toast.success(`Order ${order.order_ref} served.${deducted ? ' Linked ingredients deducted.' : ''}`);
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
          <div id={newOrderTarget} ref={orderSection} tabIndex={-1} aria-label="New order"
            className="card-premium scroll-mt-28 p-5 space-y-3">
            <p className="text-sm font-medium text-muted-foreground">Select item</p>
            <Select value={selectedId} onValueChange={setSelectedId}>
              <SelectTrigger
                className="w-full [&>svg]:shrink-0 max-md:h-auto max-md:min-h-10 max-md:gap-2 max-md:[&>span]:min-w-0 max-md:[&>span]:flex-1 max-md:[&>span]:line-clamp-none"
                aria-label="Select a menu item"
              >
                <SelectValue placeholder="— Choose a dish —" />
              </SelectTrigger>
              <SelectContent className="max-md:w-[var(--radix-select-trigger-width)] max-md:min-w-0 max-md:max-w-[var(--radix-select-content-available-width)]">
                {availableItems.length === 0 ? (
                  <SelectItem value="__none" disabled>
                    No menu items — add dishes in Menu &amp; Costing
                  </SelectItem>
                ) : (
                  availableItems.map((item) => {
                    const price = formatPrice(item.selling_price);
                    return (
                      <SelectItem key={item.id} value={item.id} className="max-md:[&>span:last-child]:min-w-0 max-md:[&>span:last-child]:flex-1">
                        <span className="flex w-full min-w-0 items-center gap-2.5">
                          {item.image_url && item.image_url !== '/placeholder.svg' ? (
                            <img
                              src={catalogPhotoSource(item.image_url)}
                              alt=""
                              className="size-7 rounded object-cover shrink-0 border border-border/60"
                              onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                            />
                          ) : (
                            <span className="size-7 rounded bg-red-50 border border-red-100 flex items-center justify-center shrink-0">
                              <UtensilsCrossed className="size-3.5 text-red-400" />
                            </span>
                          )}
                          <span className="min-w-0 text-base font-medium max-md:flex-1 max-md:whitespace-normal max-md:wrap-anywhere md:truncate">{item.name}</span>
                          <span className="ml-auto shrink-0 whitespace-nowrap pl-2 text-base font-semibold tabular-nums">
                            {price != null ? cartPrice.format(price) : '—'}
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
                    <div key={ci.menu_item_id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 gap-y-2 px-4 py-3 sm:px-5">
                      {(() => {
                        const menuItem = (menuItems || []).find((m: any) => m.id === ci.menu_item_id);
                        const imgUrl = menuItem?.image_url;
                        return imgUrl && imgUrl !== '/placeholder.svg' ? (
                          <img
                            src={catalogPhotoSource(imgUrl)}
                            alt=""
                            className="size-11 rounded-lg object-cover shrink-0 border border-border/80"
                            onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                          />
                        ) : (
                          <div className="size-11 rounded-lg bg-red-50 border border-red-100 flex items-center justify-center shrink-0">
                            <UtensilsCrossed className="size-5 text-red-400" />
                          </div>
                        );
                      })()}
                      <div className="min-w-0">
                        <p className="text-base font-semibold leading-snug wrap-anywhere sm:text-lg">
                          {ci.name}
                        </p>
                        <p className="mt-0.5 text-base text-muted-foreground tabular-nums">
                          {cartPrice.format(ci.unit_price)} × {ci.quantity}
                        </p>
                        {!menuItems.find((item) => item.id === ci.menu_item_id)?.ingredients?.length && (
                          <p className="mt-0.5 text-xs text-amber-800">No recipe linked. Stock and cost won’t be recorded.</p>
                        )}
                      </div>
                      <span className="text-lg font-bold tabular-nums">
                        {cartPrice.format(ci.unit_price * ci.quantity)}
                      </span>
                      <div className="col-span-3 flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          className="grid size-11 place-items-center rounded-lg border border-input bg-background hover:bg-secondary"
                          onClick={() => changeQty(ci.menu_item_id, -1)}
                          aria-label={`Remove one ${ci.name}`}
                        >
                          <Minus className="size-5" />
                        </button>
                        <span className="min-w-8 text-center text-base font-semibold tabular-nums">{ci.quantity}</span>
                        <button
                          type="button"
                          className="grid size-11 place-items-center rounded-lg border border-input bg-background hover:bg-secondary"
                          onClick={() => changeQty(ci.menu_item_id, 1)}
                          aria-label={`Add one ${ci.name}`}
                        >
                          <Plus className="size-5" />
                        </button>
                        <button
                          type="button"
                          className="grid size-11 place-items-center rounded-lg text-destructive hover:bg-destructive/10"
                          onClick={() => removeFromCart(ci.menu_item_id)}
                          aria-label={`Remove ${ci.name}`}
                        >
                          <Trash2 className="size-4" />
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
                disabled={mockMode || cart.length === 0 || createOrder.isPending}
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
          {/* Section Header */}
          <div className="flex items-center justify-between pb-1">
            <div className="flex items-center gap-2">
              <History className="size-5 text-[#dc2626]" />
              <h2 className="font-display font-bold text-lg text-slate-900">Order History</h2>
            </div>
            {orders.length > 0 && (
              <Badge variant="outline" className="text-xs font-semibold px-2.5 py-0.5 rounded-lg border-slate-200 bg-white shadow-2xs">
                {orders.length} order{orders.length !== 1 && 's'}
              </Badge>
            )}
          </div>

          {ordersLoading ? (
            <div className="card-premium py-16 text-center text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="size-4 animate-spin text-[#dc2626]" /> Loading order history…
            </div>
          ) : orders.length === 0 ? (
            <div className="card-premium py-16 text-center">
              <Clock className="mx-auto mb-2 size-8 text-muted-foreground/30" />
              <p className="text-muted-foreground text-sm font-medium">No orders recorded yet</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Place an order on the left to see it appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3.5">
              {orders.map((order) => (
                <div
                  key={order.id}
                  className="card-premium p-4 sm:p-5 rounded-2xl shadow-xs hover:border-[#dc2626]/40 hover:shadow-md transition-all space-y-3"
                >
                  {/* Order Header: Ref & Status on Left | Price & Delete Button on Right */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap min-w-0">
                      <span className="font-mono text-sm font-bold text-slate-900">{order.order_ref}</span>

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
                        <Badge variant="outline" className="text-[11px] font-semibold text-red-700 border-red-300 bg-red-50">
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

                    {/* Price & Delete Action always visible side-by-side */}
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-bold text-slate-900 tabular-nums text-base">
                        {currency.format(Number(order.total_amount))}
                      </span>
                      <button
                        type="button"
                        className="size-7.5 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-600 hover:bg-red-50 active:bg-red-100 transition-colors shrink-0"
                        onClick={() => handleDeleteOrder(order.id)}
                        disabled={mockMode}
                        aria-label="Delete order"
                        title="Delete order"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>

                  {/* Order Timestamp */}
                  <p className="text-[11px] text-muted-foreground">
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

                  {/* Order Items Breakdown */}
                  {Array.isArray(order.items) && order.items.length > 0 ? (
                    <ul className="space-y-1.5 text-sm border-l-2 border-red-200/60 pl-2.5">
                      {order.items.map((i: any, idx: number) => (
                        <li key={idx} className="flex items-center justify-between gap-3 text-muted-foreground">
                          <span className="flex items-center gap-2 min-w-0">
                            {(() => {
                              const menuItem = (menuItems || []).find((m: any) => m.id === i.menu_item_id || m.name === i.name);
                              const imgUrl = menuItem?.image_url;
                              return imgUrl && imgUrl !== '/placeholder.svg' ? (
                                <img
                                  src={catalogPhotoSource(imgUrl)}
                                  alt=""
                                  className="size-6 rounded object-cover shrink-0 border border-border/60"
                                  onError={(e) => { (e.target as HTMLElement).style.display = 'none'; }}
                                />
                              ) : (
                                <div className="size-6 rounded bg-red-50 border border-red-100 flex items-center justify-center shrink-0">
                                  <UtensilsCrossed className="size-3 text-red-400" />
                                </div>
                              );
                            })()}
                            <span className="font-medium wrap-anywhere">{i.name}</span>{' '}
                            <span className="font-semibold text-foreground shrink-0">×{i.quantity}</span>
                          </span>
                          {Number(i.line_total ?? (i.unit_price * i.quantity)) > 0 && (
                            <span className="shrink-0 font-semibold tabular-nums">
                              ₹{Number(i.line_total ?? (i.unit_price * i.quantity)).toFixed(2)}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-xs text-muted-foreground">No item breakdown</p>
                  )}

                  {/* Order Status Action Controls: Exactly 2 buttons (Served and Canceled) */}
                  <div className="pt-2.5 border-t border-border/50 flex items-center gap-2.5 flex-wrap">
                    {(!order.status || order.status === 'New' || order.status === 'Pending') ? (
                      <>
                        <Button
                          size="sm"
                          className="h-8 px-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-xs transition-all"
                          disabled={mockMode || updatingOrderId === order.id}
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
                          className="h-8 px-3 border-red-200 text-red-600 hover:text-red-700 hover:bg-red-50 text-xs font-semibold shadow-xs"
                          disabled={mockMode || updatingOrderId === order.id}
                          onClick={() => handleStatusChange(order, 'Canceled')}
                        >
                          <XCircle className="size-3.5 mr-1.5" />
                          Canceled
                        </Button>
                      </>
                    ) : (
                      <span className="text-[11px] font-medium flex items-center gap-1.5">
                        {order.status === 'Canceled' || order.status === 'Cancelled' ? (
                          <span className="text-red-600 font-semibold">
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
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Shortages Rejection Dialog */}
      <Dialog
        open={shortageInfo.open}
        onOpenChange={(open) => setShortageInfo((prev) => ({ ...prev, open }))}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600 font-bold">
              <AlertTriangle className="size-5 shrink-0" />
              Insufficient Stock
            </DialogTitle>
            <DialogDescription>
              Order <strong>{shortageInfo.orderRef}</strong> cannot be marked as Served because required ingredient stock is insufficient.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="rounded-lg border border-red-200 bg-red-50/70 p-3 text-xs text-red-800 leading-relaxed">
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
                    <span className="inline-block mt-1 text-[11px] font-bold px-2 py-0.5 rounded bg-red-50 border border-red-200 text-red-700">
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
              className="bg-[#dc2626] hover:bg-[#b91c1c] text-white"
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
