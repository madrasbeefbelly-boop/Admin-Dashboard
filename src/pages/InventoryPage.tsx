import { useState, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link } from 'react-router-dom';
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
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  Plus,
  Search,
  Package,
  AlertTriangle,
  TrendingUp,
  Trash2,
  Loader2,
  History,
  ArrowUpDown,
  UtensilsCrossed,
  CheckCircle2,
  Clock,
  Layers,
} from 'lucide-react';
import {
  useInventory,
  useLowStockItems,
  useCreateInventoryItem,
  useDeleteInventoryItem,
  useSuppliers,
  useAdjustStock,
  useInventoryMovements,
  useMenuItems,
} from '@/hooks/api';
import { toast } from 'sonner';
import { MEASUREMENT_UNITS } from '@/lib/units';

const INVENTORY_CATEGORIES = [
  'Meat',
  'Rice',
  'Spices',
  'Vegetables',
  'Oil',
  'Dairy',
  'Bakery',
  'Beverages',
  'Packaging',
  'Other',
];

export default function InventoryPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState<'inventory' | 'movements'>('inventory');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    category: 'Vegetables',
    unit: 'kg',
    current_stock: '10',
    cost_per_unit: '',
    supplier_id: '',
    minimum_stock: '2',
  });

  // Adjust / Restock Modal State
  const [adjustModal, setAdjustModal] = useState<{
    open: boolean;
    item: any | null;
    quantityChange: string;
    movementType: 'purchase' | 'adjustment' | 'waste';
    notes: string;
  }>({
    open: false,
    item: null,
    quantityChange: '',
    movementType: 'purchase',
    notes: '',
  });

  // API hooks
  const { data: inventory = [], isLoading, error, refetch } = useInventory();
  const { data: lowStockItems = [] } = useLowStockItems();
  const { data: suppliers = [], isPending: suppliersLoading, isError: suppliersError, refetch: refetchSuppliers } = useSuppliers();
  const { data: movements = [], isLoading: movementsLoading } = useInventoryMovements();
  const { data: menuItems = [] } = useMenuItems();

  const createItem = useCreateInventoryItem();
  const deleteItem = useDeleteInventoryItem();
  const adjustStock = useAdjustStock();

  const filteredItems = inventory.filter(item =>
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.category?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.supplier_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Map low-stock items to affected menu items
  const affectedMenuItemsMap = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const inv of inventory) {
      const dishes: string[] = [];
      for (const dish of menuItems) {
        if (dish.ingredients?.some((ing: any) => ing.inventory_item_id === inv.id)) {
          dishes.push(dish.name);
        }
      }
      if (dishes.length > 0) {
        map.set(inv.id, dishes);
      }
    }
    return map;
  }, [inventory, menuItems]);

  // Stats
  const totalValue = inventory.reduce((acc, item) => acc + (Number(item.current_stock || 0) * Number(item.cost_per_unit || 0)), 0);
  const lowStockCount = lowStockItems.length;
  const totalItems = inventory.length;

  const handleAddItem = async () => {
    if (!formData.name.trim()) {
      toast.error('Enter an ingredient name');
      return;
    }
    if (!formData.cost_per_unit || isNaN(Number(formData.cost_per_unit))) {
      toast.error('Enter a valid cost per unit');
      return;
    }

    try {
      await createItem.mutateAsync({
        name: formData.name.trim(),
        category: formData.category,
        unit: formData.unit,
        current_stock: formData.current_stock ? parseFloat(formData.current_stock) : 0,
        cost_per_unit: parseFloat(formData.cost_per_unit),
        supplier_id: formData.supplier_id || null,
        minimum_stock: formData.minimum_stock ? parseFloat(formData.minimum_stock) : 2,
      });
      toast.success('Ingredient created in inventory!');
      setIsAddDialogOpen(false);
      setFormData({
        name: '',
        category: 'Vegetables',
        unit: 'kg',
        current_stock: '10',
        cost_per_unit: '',
        supplier_id: '',
        minimum_stock: '2',
      });
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to add item');
    }
  };

  const openAdjustDialog = (item: any) => {
    setAdjustModal({
      open: true,
      item,
      quantityChange: '',
      movementType: 'purchase',
      notes: '',
    });
  };

  const handleApplyAdjustment = async () => {
    if (!adjustModal.item) return;
    const qty = parseFloat(adjustModal.quantityChange);
    if (isNaN(qty) || qty === 0) {
      toast.error('Enter a valid non-zero quantity change');
      return;
    }

    // If waste, ensure quantity is negative
    const finalChange = adjustModal.movementType === 'waste' ? -Math.abs(qty) : qty;

    try {
      await adjustStock.mutateAsync({
        id: adjustModal.item.id,
        quantity_change: finalChange,
        movement_type: adjustModal.movementType,
        notes: adjustModal.notes.trim() || undefined,
      });
      toast.success(`Stock adjusted for ${adjustModal.item.name}!`);
      setAdjustModal({ open: false, item: null, quantityChange: '', movementType: 'purchase', notes: '' });
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to adjust stock');
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (confirm('Are you sure you want to delete this ingredient?')) {
      try {
        await deleteItem.mutateAsync(itemId);
        toast.success('Item deleted successfully!');
      } catch (error) {
        toast.error('Failed to delete item');
      }
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <DashboardLayout title="Inventory" subtitle="Track your stock levels and supplies">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-gold" />
        </div>
      </DashboardLayout>
    );
  }

  // Error state
  if (error) {
    return (
      <DashboardLayout title="Inventory" subtitle="Track your stock levels and supplies">
        <div className="p-8 text-red-500 text-center">
          Failed to load inventory. Make sure the backend server is running.
          <Button onClick={() => refetch()} className="mt-4">
            Try Again
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Inventory" subtitle="Track your stock levels and supplies">
      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center">
              <Package className="w-5 h-5 text-gold" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Stock Value</p>
              <p className="font-display text-2xl font-semibold">₹{(totalValue / 1000).toFixed(0)}K</p>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-warning" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Low Stock Items</p>
              <p className="font-display text-2xl font-semibold">{lowStockCount}</p>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Items</p>
              <p className="font-display text-2xl font-semibold">{totalItems}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs and Filters Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 mb-6">
        {/* Segmented View Switcher */}
        <div className="flex items-center rounded-xl border border-slate-200 bg-slate-100/90 p-1 shadow-xs">
          <button
            type="button"
            onClick={() => setActiveTab('inventory')}
            className={cn(
              'flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all',
              activeTab === 'inventory'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            )}
          >
            <Package className="size-4 text-[#e11d48]" />
            Live Ingredients ({totalItems})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('movements')}
            className={cn(
              'flex items-center gap-2 px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all',
              activeTab === 'movements'
                ? 'bg-white text-slate-900 shadow-xs'
                : 'text-slate-500 hover:text-slate-900'
            )}
          >
            <History className="size-4 text-purple-600" />
            Stock Movements History ({movements.length})
          </button>
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-3">
          {activeTab === 'inventory' && (
            <div className="relative flex-1 sm:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <Input
                placeholder="Search ingredients..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9 bg-white"
              />
            </div>
          )}

          <Button
            className="bg-[#e11d48] hover:bg-[#be123c] text-white shrink-0 shadow-xs"
            onClick={() => setIsAddDialogOpen(true)}
          >
            <Plus className="size-4 mr-1.5" />
            Add Ingredient
          </Button>
        </div>
      </div>

      {/* Add Item Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Inventory Ingredient</DialogTitle>
            <DialogDescription>
              Register a raw ingredient with its unit, cost, and starting stock.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-sm font-medium">Ingredient Name *</label>
              <Input
                placeholder="e.g., Beef, Basmati Rice, Onion"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Category</label>
                <Select
                  value={formData.category}
                  onValueChange={(val) => setFormData({ ...formData, category: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {INVENTORY_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-sm font-medium">Unit *</label>
                <Select
                  value={formData.unit}
                  onValueChange={(val) => setFormData({ ...formData, unit: val })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {MEASUREMENT_UNITS.map((u) => (
                      <SelectItem key={u.value} value={u.value}>
                        {u.label} ({u.value})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Initial Stock Quantity *</label>
                <Input
                  placeholder="e.g., 10"
                  type="number"
                  step="any"
                  value={formData.current_stock}
                  onChange={(e) => setFormData({ ...formData, current_stock: e.target.value })}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Minimum Alert Stock</label>
                <Input
                  placeholder="e.g., 2"
                  type="number"
                  step="any"
                  value={formData.minimum_stock}
                  onChange={(e) => setFormData({ ...formData, minimum_stock: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-sm font-medium">Cost per Unit (₹) *</label>
                <Input
                  placeholder="e.g., 350"
                  type="number"
                  step="0.01"
                  value={formData.cost_per_unit}
                  onChange={(e) => setFormData({ ...formData, cost_per_unit: e.target.value })}
                />
              </div>

              <div>
                <label className="text-sm font-medium">Supplier (Optional)</label>
                <Select
                  value={formData.supplier_id}
                  onValueChange={(val) => setFormData({ ...formData, supplier_id: val === '__none' ? '' : val })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Local / None" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">None / Local Market</SelectItem>
                    {suppliers.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-[#e11d48] hover:bg-[#be123c] text-white"
              onClick={handleAddItem}
              disabled={createItem.isPending}
            >
              {createItem.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Adding...
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  Add Ingredient
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjust / Restock Dialog */}
      <Dialog
        open={adjustModal.open}
        onOpenChange={(open) => setAdjustModal((prev) => ({ ...prev, open }))}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ArrowUpDown className="size-5 text-[#e11d48]" />
              Adjust Stock: {adjustModal.item?.name}
            </DialogTitle>
            <DialogDescription>
              Current stock: <strong>{adjustModal.item?.current_stock} {adjustModal.item?.unit}</strong>
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div>
              <label className="text-sm font-medium">Adjustment Type</label>
              <Select
                value={adjustModal.movementType}
                onValueChange={(val: any) => setAdjustModal((prev) => ({ ...prev, movementType: val }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="purchase">Restock / Received Shipment (+)</SelectItem>
                  <SelectItem value="adjustment">Inventory Count Adjustment (+/-)</SelectItem>
                  <SelectItem value="waste">Wastage / Spoilage Deduction (-)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">
                {adjustModal.movementType === 'purchase'
                  ? 'Quantity Received (+)'
                  : adjustModal.movementType === 'waste'
                  ? 'Quantity Wasted (-)'
                  : 'Quantity Difference (+ or -)'} ({adjustModal.item?.unit})
              </label>
              <Input
                placeholder={`e.g., 5`}
                type="number"
                step="any"
                value={adjustModal.quantityChange}
                onChange={(e) => setAdjustModal((prev) => ({ ...prev, quantityChange: e.target.value }))}
              />
            </div>

            <div>
              <label className="text-sm font-medium">Reason / Notes</label>
              <Input
                placeholder="e.g., Fresh delivery from market, Spoilage check"
                value={adjustModal.notes}
                onChange={(e) => setAdjustModal((prev) => ({ ...prev, notes: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustModal((prev) => ({ ...prev, open: false }))}>
              Cancel
            </Button>
            <Button
              className="bg-[#e11d48] hover:bg-[#be123c] text-white"
              onClick={handleApplyAdjustment}
              disabled={adjustStock.isPending}
            >
              {adjustStock.isPending ? (
                <>
                  <Loader2 className="size-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                'Save Adjustment'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── TAB 1: LIVE INGREDIENTS TABLE ── */}
      {activeTab === 'inventory' && (
        <div className="card-premium overflow-hidden">
          {filteredItems.length > 0 ? (
            <Table role="table" className="mobile-records">
              <TableHeader role="rowgroup">
                <TableRow role="row" className="hover:bg-transparent border-border">
                  <TableHead role="columnheader" scope="col" className="font-display font-semibold">Ingredient</TableHead>
                  <TableHead role="columnheader" scope="col" className="font-display font-semibold">Category</TableHead>
                  <TableHead role="columnheader" scope="col" className="font-display font-semibold">Stock Level</TableHead>
                  <TableHead role="columnheader" scope="col" className="font-display font-semibold">Cost/Unit</TableHead>
                  <TableHead role="columnheader" scope="col" className="font-display font-semibold">Status</TableHead>
                  <TableHead role="columnheader" scope="col" className="font-display font-semibold">Affected Dishes</TableHead>
                  <TableHead role="columnheader" scope="col" className="font-display font-semibold text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody role="rowgroup">
                {filteredItems.map((item) => {
                  const currentStock = Number(item.current_stock || 0);
                  const minStock = Number(item.minimum_stock || 1);
                  const stockPercentage = Math.min((currentStock / (minStock || 1)) * 100, 100);
                  const isLowStock = currentStock <= minStock;
                  const affectedDishes = affectedMenuItemsMap.get(item.id) || [];

                  return (
                    <TableRow role="row" key={item.id} className="border-border hover:bg-secondary/40 transition-colors">
                      <TableCell role="cell" mobileLabel="Ingredient" className="font-semibold text-slate-900">
                        {item.name}
                      </TableCell>
                      <TableCell role="cell" mobileLabel="Category">
                        <Badge variant="outline" className="text-xs font-medium bg-slate-50 border-slate-200">
                          {item.category || 'General'}
                        </Badge>
                      </TableCell>
                      <TableCell role="cell" mobileLabel="Stock Level">
                        <div className="flex items-center gap-2.5">
                          <span className="font-bold tabular-nums min-w-[50px]">
                            {currentStock} <span className="text-xs font-normal text-muted-foreground">{item.unit}</span>
                          </span>
                          <Progress
                            value={stockPercentage}
                            className={cn('w-20 h-2 max-md:max-w-[50%]', isLowStock && '[&>div]:bg-amber-500')}
                          />
                        </div>
                      </TableCell>
                      <TableCell role="cell" mobileLabel="Cost/Unit" className="font-semibold tabular-nums">
                        ₹{item.cost_per_unit} <span className="text-xs font-normal text-muted-foreground">/{item.unit}</span>
                      </TableCell>
                      <TableCell role="cell" mobileLabel="Status">
                        {isLowStock ? (
                          <Badge className="bg-amber-50 text-amber-800 border-amber-200 border text-xs font-bold">
                            Low Stock (≤{minStock} {item.unit})
                          </Badge>
                        ) : (
                          <Badge className="bg-emerald-50 text-emerald-800 border-emerald-200 border text-xs font-bold">
                            In Stock
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell role="cell" mobileLabel="Affected Dishes">
                        {affectedDishes.length > 0 ? (
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className="text-xs text-slate-600 font-medium">
                              Used in {affectedDishes.length} dish{affectedDishes.length > 1 ? 'es' : ''}
                            </span>
                            {isLowStock && (
                              <Badge variant="outline" className="text-[10px] bg-rose-50 text-rose-700 border-rose-200">
                                Low stock warning
                              </Badge>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground italic">No recipe linked</span>
                        )}
                      </TableCell>
                      <TableCell role="cell" mobileLabel="Actions" className="text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs font-semibold border-slate-200 hover:bg-slate-100 shadow-xs"
                            onClick={() => openAdjustDialog(item)}
                          >
                            <ArrowUpDown className="size-3.5 mr-1 text-[#e11d48]" />
                            Adjust / Restock
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            aria-label={`Delete inventory item ${item.name}`}
                            onClick={() => handleDeleteItem(item.id)}
                            disabled={deleteItem.isPending}
                            className="size-8 p-0 text-slate-400 hover:text-rose-600 hover:bg-rose-50"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          ) : (
            <div className="p-12 text-center text-muted-foreground">
              No items found. {inventory.length === 0 ? 'Add your first inventory ingredient above!' : 'Try a different search.'}
            </div>
          )}
        </div>
      )}

      {/* ── TAB 2: STOCK MOVEMENT HISTORY TABLE ── */}
      {activeTab === 'movements' && (
        <div className="card-premium overflow-hidden">
          {movementsLoading ? (
            <div className="py-16 text-center text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="size-5 animate-spin text-[#e11d48]" /> Loading stock movements…
            </div>
          ) : movements.length === 0 ? (
            <div className="py-16 text-center">
              <History className="mx-auto mb-2 size-8 text-muted-foreground/30" />
              <p className="text-muted-foreground text-sm font-medium">No stock movements recorded yet</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Movements will appear here automatically when orders are prepared or manual adjustments are made.
              </p>
            </div>
          ) : (
            <Table role="table" className="mobile-records">
              <TableHeader role="rowgroup">
                <TableRow role="row" className="hover:bg-transparent border-border">
                  <TableHead role="columnheader" scope="col" className="font-display font-semibold">Date &amp; Time</TableHead>
                  <TableHead role="columnheader" scope="col" className="font-display font-semibold">Ingredient</TableHead>
                  <TableHead role="columnheader" scope="col" className="font-display font-semibold">Movement Type</TableHead>
                  <TableHead role="columnheader" scope="col" className="font-display font-semibold">Quantity Change</TableHead>
                  <TableHead role="columnheader" scope="col" className="font-display font-semibold">Stock (Before → After)</TableHead>
                  <TableHead role="columnheader" scope="col" className="font-display font-semibold">Linked Order / Reason</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody role="rowgroup">
                {movements.map((m: any) => {
                  const qtyChange = Number(m.quantity_change);
                  const isDeduction = qtyChange < 0;

                  return (
                    <TableRow role="row" key={m.id} className="border-border hover:bg-secondary/40 transition-colors">
                      <TableCell role="cell" mobileLabel="Date & Time" className="text-xs text-slate-500 font-medium">
                        {m.created_at ? new Date(m.created_at).toLocaleString('en-IN', {
                          day: '2-digit',
                          month: 'short',
                          hour: '2-digit',
                          minute: '2-digit',
                          hour12: true,
                        }) : '—'}
                      </TableCell>
                      <TableCell role="cell" mobileLabel="Ingredient" className="font-semibold text-slate-900">
                        {m.ingredient_name || 'Ingredient'}
                      </TableCell>
                      <TableCell role="cell" mobileLabel="Movement Type">
                        {m.movement_type === 'order_deduction' ? (
                          <Badge variant="outline" className="text-xs font-bold bg-blue-50 text-blue-700 border-blue-200">
                            Order Preparation
                          </Badge>
                        ) : m.movement_type === 'purchase' ? (
                          <Badge variant="outline" className="text-xs font-bold bg-emerald-50 text-emerald-700 border-emerald-200">
                            Restock / Purchase
                          </Badge>
                        ) : m.movement_type === 'waste' ? (
                          <Badge variant="outline" className="text-xs font-bold bg-rose-50 text-rose-700 border-rose-200">
                            Wastage / Spoilage
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs font-bold bg-amber-50 text-amber-700 border-amber-200">
                            Adjustment
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell role="cell" mobileLabel="Quantity Change">
                        <span className={cn(
                          'font-bold text-sm tabular-nums',
                          isDeduction ? 'text-rose-600' : 'text-emerald-600'
                        )}>
                          {isDeduction ? '' : '+'}{qtyChange} {m.unit}
                        </span>
                      </TableCell>
                      <TableCell role="cell" mobileLabel="Stock (Before → After)" className="tabular-nums text-xs">
                        <span className="text-slate-500">{m.previous_stock}</span>
                        <span className="mx-1 text-slate-400">→</span>
                        <strong className="text-slate-900">{m.new_stock}</strong> {m.unit}
                      </TableCell>
                      <TableCell role="cell" mobileLabel="Linked Order / Reason" className="text-xs">
                        {m.order_ref ? (
                          <Badge variant="outline" className="font-mono text-xs bg-slate-50 text-slate-700 border-slate-300">
                            Order #{m.order_ref}
                          </Badge>
                        ) : (
                          <span className="text-slate-600">{m.notes || '—'}</span>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
