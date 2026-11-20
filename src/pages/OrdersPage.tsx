import { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
  Search,
  Plus,
  Minus,
  ShoppingBag,
  Printer,
  Trash2,
  Loader2,
  CheckCircle2,
  UtensilsCrossed,
  Receipt,
} from 'lucide-react';
import { useMenuItems, useCreateOrder } from '@/hooks/api';
import { toast } from 'sonner';
import type { MenuCatalogItem, OrderItem } from '@/types';

const categoryColors: Record<string, string> = {
  Starters: 'bg-gold/10 text-gold border-gold/20',
  Gravy: 'bg-gold/10 text-gold border-gold/20',
  Snacks: 'bg-secondary text-secondary-foreground border-border',
  Noodles: 'bg-info/10 text-info border-info/20',
  Shawarma: 'bg-success/10 text-success border-success/20',
  Main: 'bg-gold/10 text-gold border-gold/20',
  BBQ: 'bg-destructive/10 text-destructive border-destructive/20',
  Rice: 'bg-warning/10 text-warning border-warning/20',
  Dessert: 'bg-info/10 text-info border-info/20',
  'Live Station': 'bg-success/10 text-success border-success/20',
  Appetizer: 'bg-secondary text-secondary-foreground border-border',
};

const currency = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });

function formatPrice(value: string | number | null | undefined) {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export default function OrdersPage() {
  const { data: menuItems = [], isLoading, error, refetch } = useMenuItems();
  const createOrder = useCreateOrder();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [cart, setCart] = useState<OrderItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [tableNo, setTableNo] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [billDialogOpen, setBillDialogOpen] = useState(false);
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [lastOrderRef, setLastOrderRef] = useState('');

  const categories = useMemo(
    () => ['all', ...new Set(menuItems.map((i) => i.category))],
    [menuItems],
  );

  const availableItems = useMemo(
    () =>
      menuItems.filter((item) => {
        const price = formatPrice(item.selling_price);
        if (!item.is_available || price == null) return false;
        const matchSearch = item.name.toLowerCase().includes(search.toLowerCase());
        const matchCategory = categoryFilter === 'all' || item.category === categoryFilter;
        return matchSearch && matchCategory;
      }),
    [menuItems, search, categoryFilter],
  );

  const subtotal = cart.reduce((sum, ci) => sum + ci.unit_price * ci.quantity, 0);
  const totalItems = cart.reduce((sum, ci) => sum + ci.quantity, 0);

  const addToCart = (item: MenuCatalogItem) => {
    const price = formatPrice(item.selling_price);
    if (price == null) return;
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

  const clearCart = () => {
    setCart([]);
    setCustomerName('');
    setTableNo('');
    setPaymentMethod('Cash');
  };

  const cartQtyFor = (id: string) => cart.find((ci) => ci.menu_item_id === id)?.quantity ?? 0;

  const handlePlaceOrder = async () => {
    if (cart.length === 0) {
      toast.error('Add at least one item to place an order');
      return;
    }
    try {
      const result = await createOrder.mutateAsync({
        customer_name: customerName || null,
        table_no: tableNo || null,
        payment_method: paymentMethod,
        items: cart,
        total_amount: subtotal,
      });
      const ref = result?.data?.data?.order_ref ?? result?.data?.order_ref ?? '—';
      setLastOrderRef(ref);
      setOrderPlaced(true);
      setBillDialogOpen(true);
    } catch {
      toast.error('Could not place order. Please try again.');
    }
  };

  const handlePrintBill = () => {
    window.print();
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
      <div className="flex flex-col lg:flex-row gap-6">
        {/* ── LEFT: menu picker ── */}
        <div className="flex-1 min-w-0">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-3 mb-5">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search dishes…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[180px] max-sm:w-full" aria-label="Filter by category">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((c) => (
                  <SelectItem key={c} value={c}>
                    {c === 'all' ? 'All Categories' : c}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Menu grid */}
          {availableItems.length === 0 ? (
            <div className="card-premium py-16 text-center">
              <UtensilsCrossed className="mx-auto mb-3 size-10 text-muted-foreground/40" />
              <p className="text-muted-foreground">
                {menuItems.filter((i) => i.is_available && formatPrice(i.selling_price) != null)
                  .length === 0
                  ? 'No available priced dishes yet. Add dishes with a selling price in Menu & Costing.'
                  : 'No dishes match your search.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
              {availableItems.map((item) => {
                const qty = cartQtyFor(item.id);
                const price = formatPrice(item.selling_price)!;
                return (
                  <div
                    key={item.id}
                    className={cn(
                      'card-premium p-4 flex flex-col gap-2 transition-all duration-200',
                      qty > 0 && 'border-gold/30 bg-gold/[0.03]',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <Badge className={cn('border mb-1 text-[11px]', categoryColors[item.category])}>
                          {item.category}
                        </Badge>
                        <h3 className="font-semibold leading-snug [overflow-wrap:anywhere]">
                          {item.name}
                        </h3>
                        {item.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                            {item.description}
                          </p>
                        )}
                      </div>
                      <span className="font-semibold text-gold shrink-0 tabular-nums">
                        ₹{price.toFixed(0)}
                      </span>
                    </div>

                    {qty === 0 ? (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full border-gold/30 hover:bg-gold/10 hover:text-gold"
                        onClick={() => addToCart(item)}
                      >
                        <Plus className="size-3.5 mr-1" /> Add
                      </Button>
                    ) : (
                      <div className="flex items-center justify-between gap-2">
                        <Button
                          size="icon"
                          variant="outline"
                          className="size-8 shrink-0"
                          onClick={() => changeQty(item.id, -1)}
                          aria-label="Remove one"
                        >
                          <Minus className="size-3.5" />
                        </Button>
                        <span className="font-semibold tabular-nums w-6 text-center">{qty}</span>
                        <Button
                          size="icon"
                          variant="outline"
                          className="size-8 shrink-0 border-gold/40"
                          onClick={() => changeQty(item.id, 1)}
                          aria-label="Add one"
                        >
                          <Plus className="size-3.5" />
                        </Button>
                        <span className="ml-auto text-sm tabular-nums text-muted-foreground">
                          ₹{(price * qty).toFixed(0)}
                        </span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* ── RIGHT: order summary / bill ── */}
        <div className="lg:w-80 xl:w-96 shrink-0">
          <div className="card-premium sticky top-4 flex flex-col gap-0 overflow-hidden">
            {/* Header */}
            <div className="flex items-center gap-2 px-5 py-4 border-b border-border">
              <ShoppingBag className="size-4 text-gold" />
              <span className="font-semibold">Current Order</span>
              {totalItems > 0 && (
                <Badge className="ml-auto bg-gold/15 text-gold border-gold/30 tabular-nums">
                  {totalItems} item{totalItems !== 1 && 's'}
                </Badge>
              )}
            </div>

            {/* Customer / table */}
            <div className="px-5 py-4 border-b border-border space-y-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">Customer name (optional)</label>
                <Input
                  placeholder="e.g. Ahmed"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  className="h-8 text-sm"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Table / Token</label>
                  <Input
                    placeholder="e.g. T3"
                    value={tableNo}
                    onChange={(e) => setTableNo(e.target.value)}
                    className="h-8 text-sm"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1 block">Payment</label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Cash">Cash</SelectItem>
                      <SelectItem value="UPI">UPI</SelectItem>
                      <SelectItem value="Card">Card</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
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
                    <div key={ci.menu_item_id} className="flex items-center gap-2 px-5 py-3">
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

            {/* Total + actions */}
            <div className="px-5 py-4 border-t border-border space-y-3">
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
      </div>

      {/* ── Bill Dialog ── */}
      <Dialog open={billDialogOpen} onOpenChange={setBillDialogOpen}>
        <DialogContent className="max-w-sm max-h-[calc(100dvh-2rem)] overflow-y-auto print:shadow-none print:border-none">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-gold">
              {orderPlaced && <CheckCircle2 className="size-5 text-success" />}
              Bill Receipt
            </DialogTitle>
            <DialogDescription>
              {orderPlaced ? `Order ${lastOrderRef} placed successfully.` : 'Preview bill below.'}
            </DialogDescription>
          </DialogHeader>

          {/* Printable bill */}
          <div className="font-mono text-sm space-y-3 py-2" id="bill-print-area">
            <div className="text-center space-y-0.5">
              <p className="font-bold text-base tracking-wide">MADRAS BEEF BIRIYANI</p>
              <p className="text-xs text-muted-foreground">Order Receipt</p>
              {lastOrderRef && <p className="text-xs text-muted-foreground">Ref: {lastOrderRef}</p>}
              <p className="text-xs text-muted-foreground">
                {new Date().toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
              </p>
            </div>

            {(customerName || tableNo) && (
              <div className="text-xs space-y-0.5 border-t border-dashed border-border pt-2">
                {customerName && <p>Customer: {customerName}</p>}
                {tableNo && <p>Table/Token: {tableNo}</p>}
                <p>Payment: {paymentMethod}</p>
              </div>
            )}

            <Separator className="border-dashed" />

            <div className="space-y-1">
              {cart.map((ci) => (
                <div key={ci.menu_item_id} className="flex justify-between gap-2">
                  <span className="flex-1 truncate">
                    {ci.name} ×{ci.quantity}
                  </span>
                  <span className="tabular-nums shrink-0">₹{(ci.unit_price * ci.quantity).toFixed(0)}</span>
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

          <DialogFooter className="flex-col gap-2 sm:flex-col print:hidden">
            <Button
              className="w-full bg-gold hover:bg-gold-light"
              onClick={handlePrintBill}
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
