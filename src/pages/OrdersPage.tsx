import { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
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
  Printer,
  Trash2,
  Loader2,
  CheckCircle2,
  Receipt,
  ShoppingBag,
} from 'lucide-react';
import { useMenuItems, useCreateOrder } from '@/hooks/api';
import { toast } from 'sonner';
import type { OrderItem } from '@/types';

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });

function formatPrice(value: string | number | null | undefined): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export default function OrdersPage() {
  const { data: menuItems = [], isLoading, error, refetch } = useMenuItems();
  const createOrder = useCreateOrder();

  const [selectedId, setSelectedId] = useState('');
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [billDialogOpen, setBillDialogOpen] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [lastOrderRef, setLastOrderRef] = useState('');

  // Only show available items that have a selling price
  const availableItems = useMemo(
    () =>
      menuItems.filter(
        (item) => item.is_available && formatPrice(item.selling_price) != null,
      ),
    [menuItems],
  );

  const subtotal = cart.reduce((sum, ci) => sum + ci.unit_price * ci.quantity, 0);
  const totalItems = cart.reduce((sum, ci) => sum + ci.quantity, 0);

  const handleAddItem = () => {
    if (!selectedId) {
      toast.error('Please select an item first');
      return;
    }
    const item = availableItems.find((i) => i.id === selectedId);
    if (!item) return;
    const price = formatPrice(item.selling_price)!;
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

  const changeQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((ci) => (ci.menu_item_id === id ? { ...ci, quantity: ci.quantity + delta } : ci))
        .filter((ci) => ci.quantity > 0),
    );
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((ci) => ci.menu_item_id !== id));
  };

  const clearCart = () => setCart([]);

  const handlePlaceOrder = async () => {
    if (cart.length === 0) {
      toast.error('Add at least one item to place an order');
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
      const ref =
        result?.data?.data?.order_ref ?? result?.data?.order_ref ?? '—';
      setLastOrderRef(ref);
      setOrderPlaced(true);
      setBillDialogOpen(true);
    } catch {
      toast.error('Could not place order. Please try again.');
    }
  };

  const handleNewOrder = () => {
    clearCart();
    setBillDialogOpen(false);
    setOrderPlaced(false);
    setLastOrderRef('');
  };

  if (isLoading) {
    return (
      <DashboardLayout title="New Order" subtitle="Select items and generate a bill">
        <div className="flex h-64 items-center justify-center">
          <Loader2 className="size-8 animate-spin text-gold" />
        </div>
      </DashboardLayout>
    );
  }

  if (error) {
    return (
      <DashboardLayout title="New Order" subtitle="Select items and generate a bill">
        <div className="card-premium p-8 text-center text-destructive">
          Failed to load menu. Make sure the backend server is running.
          <Button onClick={() => refetch()} className="mt-4 block mx-auto">
            Try Again
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="New Order" subtitle="Select items and generate a bill">
      <div className="max-w-lg mx-auto space-y-4">

        {/* ── Item selector ── */}
        <div className="card-premium p-5 space-y-3">
          <p className="text-sm font-medium text-muted-foreground">Select item</p>

          <Select value={selectedId} onValueChange={setSelectedId}>
            <SelectTrigger className="w-full" aria-label="Select a menu item">
              <SelectValue placeholder="— Choose a dish —" />
            </SelectTrigger>
            <SelectContent>
              {availableItems.length === 0 ? (
                <SelectItem value="__none" disabled>
                  No priced dishes available
                </SelectItem>
              ) : (
                availableItems.map((item) => (
                  <SelectItem key={item.id} value={item.id}>
                    <span className="flex items-center justify-between gap-4 w-full">
                      <span>{item.name}</span>
                      <span className="text-muted-foreground tabular-nums">
                        ₹{Number(item.selling_price).toFixed(0)}
                      </span>
                    </span>
                  </SelectItem>
                ))
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

        {/* ── Order summary ── */}
        <div className="card-premium overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
            <ShoppingBag className="size-4 text-gold" />
            <span className="font-semibold">Current Order</span>
            {totalItems > 0 && (
              <span className="ml-auto text-sm text-muted-foreground tabular-nums">
                {totalItems} item{totalItems !== 1 && 's'}
              </span>
            )}
          </div>

          {/* Cart items */}
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
                    {/* qty controls */}
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

          {/* Total + actions */}
          <div
            className={cn(
              'px-5 py-4 space-y-3',
              cart.length > 0 && 'border-t border-border',
            )}
          >
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
                  <Receipt className="size-4 mr-2" /> Place Order & Generate Bill
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

      {/* ── Bill Dialog ── */}
      <Dialog open={billDialogOpen} onOpenChange={setBillDialogOpen}>
        <DialogContent className="max-w-sm max-h-[calc(100dvh-2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gold">
              {orderPlaced && <CheckCircle2 className="size-5 text-success" />}
              Bill Receipt
            </DialogTitle>
            <DialogDescription>
              {orderPlaced
                ? `Order ${lastOrderRef} placed successfully.`
                : 'Preview bill below.'}
            </DialogDescription>
          </DialogHeader>

          {/* Printable bill */}
          <div className="font-mono text-sm space-y-3 py-2">
            <div className="text-center space-y-0.5">
              <p className="font-bold text-base tracking-wide">MADRAS BEEF BIRIYANI</p>
              <p className="text-xs text-muted-foreground">Order Receipt</p>
              {lastOrderRef && (
                <p className="text-xs text-muted-foreground">Ref: {lastOrderRef}</p>
              )}
              <p className="text-xs text-muted-foreground">
                {new Date().toLocaleString('en-IN', {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })}
              </p>
            </div>

            <Separator className="border-dashed" />

            <div className="space-y-1">
              {cart.map((ci) => (
                <div key={ci.menu_item_id} className="flex justify-between gap-2">
                  <span className="flex-1 truncate">
                    {ci.name} ×{ci.quantity}
                  </span>
                  <span className="tabular-nums shrink-0">
                    ₹{(ci.unit_price * ci.quantity).toFixed(0)}
                  </span>
                </div>
              ))}
            </div>

            <Separator className="border-dashed" />

            <div className="flex justify-between font-bold">
              <span>TOTAL</span>
              <span className="tabular-nums">₹{subtotal.toFixed(2)}</span>
            </div>

            <p className="text-center text-xs text-muted-foreground pt-1">
              Thank you! Visit again 🙏
            </p>
          </div>

          <DialogFooter className="flex-col gap-2 sm:flex-col">
            <Button
              className="w-full bg-gold hover:bg-gold-light"
              onClick={() => window.print()}
            >
              <Printer className="size-4 mr-2" /> Print Bill
            </Button>
            <Button variant="outline" className="w-full" onClick={handleNewOrder}>
              <Plus className="size-4 mr-2" /> New Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
