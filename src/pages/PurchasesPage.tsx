import { useState } from 'react';
import { Link } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatCard } from '@/components/dashboard/StatCard';
import { purchaseAmount, purchaseDay, statSeries } from '@/lib/stat-series';
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

export default function PurchasesPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [isLogPurchaseDialogOpen, setIsLogPurchaseDialogOpen] = useState(false);
  const [isAddSupplierDialogOpen, setIsAddSupplierDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    item_id: '',
    supplier_id: '',
    purchase_date: '',
    quantity: '',
    cost: '',
  });
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
  const selectedItem = inventoryItems.find(item => item.id === formData.item_id);
  const { data: suppliers = [] } = useSuppliers();
  const createPurchase = useCreatePurchase();
  const createSupplier = useCreateSupplier();
  const deletePurchase = useDeletePurchase();
  const deleteSupplier = useDeleteSupplier();

  const filteredPurchases = purchases.filter(p =>
    (p.supplier_name?.toLowerCase().includes(searchTerm.toLowerCase()) || false) ||
    (p.ingredient_name?.toLowerCase().includes(searchTerm.toLowerCase()) || false)
  );

  // Stats
  const currentMonth = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date()).slice(0, 7);
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
    if (!formData.supplier_id || !formData.purchase_date || !formData.quantity || !formData.cost || !selectedItem) {
      toast.error('Please fill in all required fields');
      return;
    }

    // Get the selected supplier name
    const selectedSupplier = suppliers.find(s => s.id === formData.supplier_id);
    if (!selectedSupplier) {
      toast.error('Invalid supplier selected');
      return;
    }

    try {
      await createPurchase.mutateAsync({
        supplier_id: formData.supplier_id,
        supplier_name: selectedSupplier.name,
        purchase_date: formData.purchase_date,
        items: [{
          inventory_item_id: selectedItem.id,
          quantity: parseFloat(formData.quantity),
          unit_price: parseFloat(formData.cost),
        }],
      });
      toast.success('Purchase logged successfully!');
      setIsLogPurchaseDialogOpen(false);
      setFormData({
        item_id: '',
        supplier_id: '',
        purchase_date: '',
        quantity: '',
        cost: '',
      });
    } catch (error) {
      toast.error(error.response?.data?.error || 'Failed to log purchase');
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Log New Purchase</DialogTitle>
            <DialogDescription>Choose an inventory item to update its stock when the purchase is saved.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">Supplier *</label>
                <Button 
                  size="sm" 
                  variant="ghost"
                  onClick={() => setIsAddSupplierDialogOpen(true)}
                >
                  <Plus className="w-4 h-4 mr-1" /> Add New
                </Button>
              </div>
              <Select value={formData.supplier_id} onValueChange={(value) => setFormData({ ...formData, supplier_id: value })}>
                <SelectTrigger>
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
              <label className="text-sm font-medium">Purchase Date *</label>
              <Input
                type="date"
                value={formData.purchase_date}
                onChange={(e) => setFormData({ ...formData, purchase_date: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="purchase-item" className="text-sm font-medium">Item Name *</label>
              <Select
                value={selectedItem?.id ?? ''}
                onValueChange={(item_id) => setFormData(previous => ({ ...previous, item_id, quantity: '' }))}
                disabled={inventory.isPending || inventory.isError || inventoryItems.length === 0}
              >
                <SelectTrigger id="purchase-item" aria-required="true">
                  <SelectValue placeholder={inventory.isPending ? 'Loading inventory…' : 'Select an inventory item'} />
                </SelectTrigger>
                <SelectContent>
                  {inventoryItems.map(item => (
                    <SelectItem key={item.id} value={item.id}>{item.name} ({item.unit})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {inventory.isError ? (
                <Button variant="link" className="h-auto px-0 py-1" onClick={() => inventory.refetch()}>
                  Could not load inventory. Try again.
                </Button>
              ) : !inventory.isPending && inventoryItems.length === 0 && (
                <p className="mt-1 text-sm text-muted-foreground">
                  Add an item in <Link to="/inventory" className="text-gold underline">Inventory</Link> first.
                </p>
              )}
            </div>
            <div>
              <label htmlFor="purchase-quantity" className="text-sm font-medium">Quantity *</label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  id="purchase-quantity"
                  placeholder="e.g., 10"
                  value={formData.quantity}
                  onChange={(e) => setFormData({ ...formData, quantity: e.target.value })}
                  className="flex-1 max-md:min-w-0"
                />
                <span className="flex min-w-20 items-center justify-center rounded-md border border-input px-3 text-sm text-muted-foreground">
                  {selectedItem?.unit ?? 'Unit'}
                </span>
              </div>
            </div>
            <div>
              <label className="text-sm font-medium">Cost per Unit (₹) *</label>
              <Input
                type="number"
                placeholder="e.g., 120"
                value={formData.cost}
                onChange={(e) => setFormData({ ...formData, cost: e.target.value })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsLogPurchaseDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-gold hover:bg-gold-light"
              onClick={handleLogPurchase}
              disabled={createPurchase.isPending || !selectedItem || inventory.isError}
            >
              {createPurchase.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Logging...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Log Purchase
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
              disabled={createSupplier.isPending}
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
        <StatCard title="Total Purchases" value={purchases.length} icon={ShoppingCart}
          dataPoints={statSeries(purchases, purchaseDay)} chartLabel="Purchases by day" />
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
          onClick={() => setIsLogPurchaseDialogOpen(true)}
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
                <TableRow role="row" key={`${purchase.id}-${purchase.ingredient_name}`} className="border-border hover:bg-secondary/50">
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
                      disabled={deletePurchase.isPending}
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
                  disabled={deleteSupplier.isPending}
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
