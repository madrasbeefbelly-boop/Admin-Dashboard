import { useState } from 'react';
import { Link } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatCard } from '@/components/dashboard/StatCard';
import { purchaseAmount, purchaseDay, statSeries } from '@/lib/stat-series';
import { isMockMode } from '@/lib/mock-mode';
import { usePurchases, useCreatePurchase, useInventory, useSuppliers, useCreateSupplier, useDeletePurchase, useDeleteSupplier } from '@/hooks/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Plus, Search, ShoppingCart, Calendar, TrendingDown, Eye, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface PurchaseItemRow {
  id: string;
  item_id: string;
  quantity: string;
  cost: string;
}

const getTodayString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const initialItemRow = (): PurchaseItemRow => ({
  id: Math.random().toString(36).slice(2, 9),
  item_id: '',
  quantity: '',
  cost: '',
});

export default function PurchasesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isLogPurchaseDialogOpen, setIsLogPurchaseDialogOpen] = useState(false);
  const [isAddSupplierDialogOpen, setIsAddSupplierDialogOpen] = useState(false);
  
  // Multi-item purchase form state
  const [supplierId, setSupplierId] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(getTodayString());
  const [itemsList, setItemsList] = useState<PurchaseItemRow[]>([initialItemRow()]);

  const [supplierFormData, setSupplierFormData] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    city: '',
  });

  // API hooks
  const { data: purchases = [], isLoading, error, refetch } = usePurchases();
  const inventory = useInventory();
  const inventoryItems = inventory.data ?? [];
  const { data: suppliers = [] } = useSuppliers();
  const createPurchase = useCreatePurchase();
  const createSupplier = useCreateSupplier();
  const deletePurchase = useDeletePurchase();
  const deleteSupplier = useDeleteSupplier();

  // Multi-item handlers
  const handleOpenLogPurchaseDialog = () => {
    setSupplierId('');
    setPurchaseDate(getTodayString());
    setItemsList([initialItemRow()]);
    setIsLogPurchaseDialogOpen(true);
  };

  const addItemRow = () => {
    setItemsList((prev) => [...prev, initialItemRow()]);
  };

  const removeItemRow = (id: string) => {
    if (itemsList.length <= 1) return;
    setItemsList((prev) => prev.filter((item) => item.id !== id));
  };

  const updateItemRow = (id: string, field: 'item_id' | 'quantity' | 'cost', value: string) => {
    setItemsList((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        if (field === 'item_id' && value !== row.item_id) {
          const item = inventoryItems.find((entry) => entry.id === value);
          return { ...row, item_id: value, quantity: '', cost: String(item?.cost_per_unit ?? '') };
        }
        return { ...row, [field]: value };
      })
    );
  };

  const totalPurchaseAmount = itemsList.reduce((sum, item) => {
    const q = parseFloat(item.quantity) || 0;
    const c = parseFloat(item.cost) || 0;
    return sum + (q * c);
  }, 0);

  const filteredPurchases = purchases.filter(p =>
    (p.supplier_name?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
    (p.ingredient_name?.toLowerCase().includes(searchTerm.toLowerCase()) || false)
  );

  // Stats
  const currentMonth = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date()).slice(0, 7);
  const purchaseRecords = [...new Map(purchases.map((item) => [item.id, item])).values()];
  const thisMonth = purchases.filter((item) => purchaseDay(item).startsWith(currentMonth));
  const totalSpent = purchases.reduce((total, item) => total + purchaseAmount(item), 0);
  const thisMonthSpent = thisMonth.reduce((total, item) => total + purchaseAmount(item), 0);

  const handleAddSupplier = async () => {
    if (!supplierFormData.name) {
      toast.error('Please fill in supplier name');
      return;
    }

    try {
      await createSupplier.mutateAsync({
        name: supplierFormData.name,
        email: supplierFormData.email,
        phone: supplierFormData.phone,
        address: supplierFormData.address,
        city: supplierFormData.city,
      });
      toast.success('Supplier added successfully!');
      setIsAddSupplierDialogOpen(false);
      setSupplierFormData({
        name: '',
        email: '',
        phone: '',
        address: '',
        city: '',
      });
    } catch (error) {
      toast.error('Failed to add supplier');
    }
  };

  const handleDeletePurchase = async (purchaseId: string) => {
    if (confirm('Are you sure you want to delete this purchase?')) {
      try {
        await deletePurchase.mutateAsync(purchaseId);
        toast.success('Purchase deleted successfully!');
      } catch (error) {
        toast.error('Failed to delete purchase');
      }
    }
  };

  const handleDeleteSupplier = async (supplierId: string) => {
    if (confirm('Are you sure you want to delete this supplier?')) {
      try {
        await deleteSupplier.mutateAsync(supplierId);
        toast.success('Supplier deleted successfully!');
      } catch (error) {
        toast.error('Failed to delete supplier');
      }
    }
  };

  const handleLogPurchase = async () => {
    if (!supplierId) {
      toast.error('Please select a supplier');
      return;
    }
    if (!purchaseDate) {
      toast.error('Please choose a purchase date');
      return;
    }

    if (itemsList.length === 0) {
      toast.error('Please add at least one item');
      return;
    }

    for (let i = 0; i < itemsList.length; i++) {
      const it = itemsList[i];
      if (!it.item_id) {
        toast.error(`Please select an item for Item #${i + 1}`);
        return;
      }
      const q = Number(it.quantity);
      if (!Number.isFinite(q) || q <= 0 || Number(q.toFixed(2)) !== q) {
        toast.error(`Please enter a valid quantity for Item #${i + 1}`);
        return;
      }
      const c = Number(it.cost);
      if (!it.cost || !Number.isFinite(c) || c < 0 || Number(c.toFixed(2)) !== c) {
        toast.error(`Please enter a valid cost per unit for Item #${i + 1}`);
        return;
      }
    }

    // Get the selected supplier name
    const selectedSupplier = suppliers.find((s) => s.id === supplierId);
    if (!selectedSupplier) {
      toast.error('Invalid supplier selected');
      return;
    }

    try {
      await createPurchase.mutateAsync({
        supplier_id: supplierId,
        supplier_name: selectedSupplier.name,
        purchase_date: purchaseDate,
        items: itemsList.map((it) => ({
          inventory_item_id: it.item_id,
          quantity: parseFloat(it.quantity),
          unit_price: parseFloat(it.cost),
        })),
      });
      toast.success(`Purchase logged successfully (${itemsList.length} items)!`);
      setIsLogPurchaseDialogOpen(false);
      setSupplierId('');
      setPurchaseDate(getTodayString());
      setItemsList([initialItemRow()]);
    } catch (error: any) {
      toast.error(error?.response?.data?.error || error?.message || 'Failed to log purchase');
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <DashboardLayout title="Purchases" subtitle="Track grocery and supply purchases">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-gold" />
        </div>
      </DashboardLayout>
    );
  }

  // Error state
  if (error) {
    return (
      <DashboardLayout title="Purchases" subtitle="Track grocery and supply purchases">
        <div className="p-8 text-red-500 text-center">
          Failed to load purchases. Make sure the backend server is running.
          <Button onClick={() => refetch()} className="mt-4">
            Try Again
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Purchases" subtitle="Track grocery and supply purchases">
      {/* Dialog for Log Purchase */}
      <Dialog open={isLogPurchaseDialogOpen} onOpenChange={setIsLogPurchaseDialogOpen}>
        <DialogContent className="flex max-h-[90dvh] max-w-2xl flex-col overflow-hidden p-0 max-md:overflow-hidden max-md:p-0">
          <DialogHeader className="p-5 sm:p-6 pb-3 border-b border-border">
            <DialogTitle>Log New Purchase</DialogTitle>
            <DialogDescription>
              Record items purchased from a supplier to update inventory stock automatically.
            </DialogDescription>
          </DialogHeader>

          <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4 sm:p-6">
            {/* Supplier & Purchase Date Row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label htmlFor="purchase-supplier" className="text-sm font-medium">Supplier *</label>
                  <Button 
                    size="sm" 
                    variant="ghost"
                    type="button"
                    onClick={() => setIsAddSupplierDialogOpen(true)}
                    className="h-6 px-1.5 text-xs text-gold hover:text-gold-light"
                  >
                    <Plus className="w-3.5 h-3.5 mr-1" /> Add New
                  </Button>
                </div>
                <Select value={supplierId} onValueChange={setSupplierId}>
                  <SelectTrigger id="purchase-supplier">
                    <SelectValue placeholder="Select a supplier" />
                  </SelectTrigger>
                  <SelectContent>
                    {suppliers.map((supplier) => (
                      <SelectItem key={supplier.id} value={supplier.id}>
                        {supplier.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label htmlFor="purchase-date" className="text-sm font-medium block mb-1.5">Purchase Date *</label>
                <Input
                  type="date"
                  id="purchase-date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                />
              </div>
            </div>

            {/* Items Section Header */}
            <div className="space-y-3 pt-1">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                    Purchased Items ({itemsList.length})
                  </h4>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={addItemRow}
                  className="h-8 text-xs border-dashed border-gold/60 text-gold hover:bg-gold/10"
                >
                  <Plus className="w-3.5 h-3.5 mr-1" /> Add Item
                </Button>
              </div>

              {/* Items List */}
              <div className="space-y-3">
                {itemsList.map((row, index) => {
                  const selectedInv = inventoryItems.find((it) => it.id === row.item_id);
                  const subtotal = (parseFloat(row.quantity) || 0) * (parseFloat(row.cost) || 0);

                  return (
                    <div
                      key={row.id}
                      className="p-4 rounded-xl border border-border bg-card/60 hover:border-gold/40 transition-colors space-y-3 relative"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">
                          Item #{index + 1}
                        </span>
                        {itemsList.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeItemRow(row.id)}
                            className="h-7 px-2 text-destructive hover:bg-destructive/10 text-xs"
                            title="Remove this item"
                            aria-label={`Remove item ${index + 1}`}
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-1" /> Remove
                          </Button>
                        )}
                      </div>

                      {/* Item selection */}
                      <div>
                        <label htmlFor={`purchase-item-${row.id}`} className="text-xs font-medium text-muted-foreground block mb-1">
                          Item Name *
                        </label>
                        <Select
                          value={row.item_id}
                          onValueChange={(val) => updateItemRow(row.id, 'item_id', val)}
                          disabled={inventory.isPending || inventory.isError || inventoryItems.length === 0}
                        >
                          <SelectTrigger id={`purchase-item-${row.id}`} className="h-9">
                            <SelectValue placeholder={inventory.isPending ? 'Loading inventory…' : 'Select an inventory item'} />
                          </SelectTrigger>
                          <SelectContent>
                            {inventoryItems.map((item) => (
                              <SelectItem key={item.id} value={item.id}>
                                {item.name} ({item.unit})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        {inventory.isError ? (
                          <button type="button" className="mt-1 text-xs font-medium text-primary underline" onClick={() => void inventory.refetch()}>
                            Couldn’t load inventory. Retry
                          </button>
                        ) : !inventory.isPending && inventoryItems.length === 0 && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Add an item in <Link to="/inventory" className="text-gold underline">Inventory</Link> first.
                          </p>
                        )}
                      </div>

                      {/* Quantity, Cost per unit & Subtotal */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                        <div>
                          <label htmlFor={`purchase-quantity-${row.id}`} className="text-xs font-medium text-muted-foreground block mb-1">
                            Quantity *
                          </label>
                          <div className="flex gap-1.5">
                            <Input
                              type="number"
                              id={`purchase-quantity-${row.id}`}
                              step="0.01"
                              min="0.01"
                              placeholder="e.g. 50"
                              value={row.quantity}
                              onChange={(e) => updateItemRow(row.id, 'quantity', e.target.value)}
                              className="h-9 min-w-0 text-sm"
                            />
                            <span className="h-9 min-w-16 px-2 flex items-center justify-center rounded-md border border-input bg-muted/70 text-xs text-muted-foreground font-medium shrink-0">
                              {selectedInv?.unit || 'Unit'}
                            </span>
                          </div>
                        </div>

                        <div>
                          <label htmlFor={`purchase-cost-${row.id}`} className="text-xs font-medium text-muted-foreground block mb-1">
                            Cost per Unit (₹) *
                          </label>
                          <Input
                            type="number"
                            id={`purchase-cost-${row.id}`}
                            step="0.01"
                            min="0"
                            placeholder="e.g. 120"
                            value={row.cost}
                            onChange={(e) => updateItemRow(row.id, 'cost', e.target.value)}
                            className="h-9 text-sm"
                          />
                        </div>

                        <div>
                          <label className="text-xs font-medium text-muted-foreground block mb-1">
                            Subtotal
                          </label>
                          <div className="h-9 px-3 rounded-md bg-muted/60 border border-border flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">Amount:</span>
                            <span className="text-sm font-bold text-foreground tabular-nums">
                              ₹{subtotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add another item button */}
              <Button
                type="button"
                variant="outline"
                onClick={addItemRow}
                className="w-full border-dashed border-2 border-border hover:border-gold hover:text-gold hover:bg-gold/5 py-4 text-xs font-semibold"
              >
                <Plus className="w-4 h-4 mr-1.5" /> Add Another Item
              </Button>
            </div>

            {/* Total purchase amount card */}
            <div className="p-4 rounded-xl bg-muted/50 border border-border flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                  Total Purchase Amount
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {itemsList.length} {itemsList.length === 1 ? 'item' : 'items'} in this purchase
                </p>
              </div>
              <span className="text-xl font-bold text-foreground tabular-nums">
                ₹{totalPurchaseAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          <DialogFooter className="flex-row items-center justify-end gap-2 border-t border-border bg-slate-50/50 p-4 sm:p-6">
            <Button variant="outline" onClick={() => setIsLogPurchaseDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-gold hover:bg-gold-light text-primary-foreground font-semibold"
              onClick={handleLogPurchase}
              disabled={isMockMode() || createPurchase.isPending || inventory.isError || inventoryItems.length === 0}
            >
              {createPurchase.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Logging Purchase...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Log Purchase ({itemsList.length})
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog for Add Supplier */}
      <Dialog open={isAddSupplierDialogOpen} onOpenChange={setIsAddSupplierDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add New Supplier</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Supplier Name *</label>
              <Input
                placeholder="e.g., Fresh Vegetables Ltd"
                value={supplierFormData.name}
                onChange={(e) => setSupplierFormData({ ...supplierFormData, name: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Email</label>
              <Input
                type="email"
                placeholder="supplier@example.com"
                value={supplierFormData.email}
                onChange={(e) => setSupplierFormData({ ...supplierFormData, email: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Phone</label>
              <Input
                placeholder="0300-1234567"
                value={supplierFormData.phone}
                onChange={(e) => setSupplierFormData({ ...supplierFormData, phone: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium">Address</label>
              <Input
                placeholder="Street address"
                value={supplierFormData.address}
                onChange={(e) => setSupplierFormData({ ...supplierFormData, address: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium">City</label>
              <Input
                placeholder="City"
                value={supplierFormData.city}
                onChange={(e) => setSupplierFormData({ ...supplierFormData, city: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddSupplierDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-gold hover:bg-gold-light"
              onClick={handleAddSupplier}
              disabled={isMockMode() || createSupplier.isPending}
            >
              {createSupplier.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Supplier
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="summary-counts mb-6 grid grid-cols-3 gap-2 md:gap-4">
        <StatCard title="Total Purchases" value={purchaseRecords.length} icon={ShoppingCart}
          dataPoints={statSeries(purchaseRecords, purchaseDay)} chartLabel="Purchases by day" />
        <StatCard title="This Month" value={`₹${(thisMonthSpent / 1000).toFixed(0)}K`} icon={TrendingDown}
          accent="text-warning" dataPoints={statSeries(thisMonth, purchaseDay, purchaseAmount)} chartLabel="This month's spending by day" />
        <StatCard title="Total Spent" value={`₹${(totalSpent / 1000).toFixed(0)}K`} icon={Calendar}
          accent="text-info" dataPoints={statSeries(purchases, purchaseDay, purchaseAmount)} chartLabel="Total spending by day" />
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by supplier or item..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <Button 
          className="bg-gold hover:bg-gold-light text-primary-foreground"
          onClick={handleOpenLogPurchaseDialog}
        >
          <Plus className="w-4 h-4 mr-2" />
          Log Purchase
        </Button>
      </div>

      {/* Purchases Table */}
      <div className="card-premium overflow-hidden">
        {filteredPurchases.length > 0 ? (
          <Table role="table" className="mobile-records">
            <TableHeader role="rowgroup">
              <TableRow role="row" className="hover:bg-transparent border-border">
                <TableHead role="columnheader" scope="col" className="font-display font-semibold">Supplier</TableHead>
                <TableHead role="columnheader" scope="col" className="font-display font-semibold">Item</TableHead>
                <TableHead role="columnheader" scope="col" className="font-display font-semibold">Date</TableHead>
                <TableHead role="columnheader" scope="col" className="font-display font-semibold">Quantity</TableHead>
                <TableHead role="columnheader" scope="col" className="font-display font-semibold">Unit Price</TableHead>
                <TableHead role="columnheader" scope="col" className="font-display font-semibold">Total</TableHead>
                <TableHead role="columnheader" scope="col" className="font-display font-semibold">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody role="rowgroup">
              {filteredPurchases.map((purchase) => (
                <TableRow role="row" key={purchase.purchase_item_id ?? purchase.id} className="border-border hover:bg-secondary/50">
                  <TableCell role="cell" mobileLabel="Supplier" className="text-sm text-muted-foreground">{purchase.supplier_name}</TableCell>
                  <TableCell role="cell" mobileLabel="Item" className="font-medium">{purchase.ingredient_name || 'N/A'}</TableCell>
                  <TableCell role="cell" mobileLabel="Date" className="text-sm">
                    {new Date(purchase.purchase_date).toLocaleDateString()}
                  </TableCell>
                  <TableCell role="cell" mobileLabel="Quantity" className="text-sm font-medium">{purchase.quantity} {purchase.unit}</TableCell>
                  <TableCell role="cell" mobileLabel="Unit Price" className="font-semibold">₹{purchase.unit_price?.toLocaleString()}</TableCell>
                  <TableCell role="cell" mobileLabel="Total" className="font-semibold text-gold">₹{((purchase.quantity || 0) * (purchase.unit_price || 0)).toLocaleString()}</TableCell>
                  <TableCell role="cell" mobileLabel="Action">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeletePurchase(purchase.id)}
                      disabled={isMockMode() || deletePurchase.isPending}
                      className="text-destructive hover:text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="p-8 text-center text-muted-foreground">
            No purchases found. {purchases.length === 0 ? 'Log your first purchase!' : 'Try different filters.'}
          </div>
        )}
      </div>

      {/* Suppliers Section */}
      <div className="card-premium overflow-hidden mt-6">
        <div className="p-6 border-b border-border max-md:p-4">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">Suppliers</h3>
            <Button 
              size="sm"
              className="bg-gold hover:bg-gold-light text-primary-foreground"
              onClick={() => setIsAddSupplierDialogOpen(true)}
            >
              <Plus className="w-4 h-4 mr-1" /> Add New
            </Button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {suppliers.map((supplier) => (
              <div key={supplier.id} className="p-4 border border-border rounded-lg flex items-between justify-between">
                <div className="max-md:min-w-0 max-md:[overflow-wrap:anywhere]">
                  <p className="font-medium">{supplier.name}</p>
                  <p className="text-sm text-muted-foreground">{supplier.email}</p>
                  <p className="text-sm text-muted-foreground">{supplier.phone}</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDeleteSupplier(supplier.id)}
                  disabled={isMockMode() || deleteSupplier.isPending}
                  className="text-destructive hover:text-destructive hover:bg-destructive/10"
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>    </DashboardLayout>
  );
}
