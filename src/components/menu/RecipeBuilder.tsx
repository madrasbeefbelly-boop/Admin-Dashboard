import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Plus,
  Trash2,
  AlertCircle,
  Sparkles,
  Calculator,
  PackagePlus,
  CheckCircle2,
} from 'lucide-react';
import { useInventory, useCreateInventoryItem } from '@/hooks/api';
import {
  MEASUREMENT_UNITS,
  MeasurementUnit,
  getCompatibleUnits,
  calculateIngredientCost,
  convertQuantity,
} from '@/lib/units';
import { toast } from 'sonner';
import type { MenuItemIngredient } from '@/types';

interface RecipeBuilderProps {
  ingredients: MenuItemIngredient[];
  onChange: (ingredients: MenuItemIngredient[]) => void;
  onApplyRecipeCost?: (cost: number) => void;
}

export function RecipeBuilder({
  ingredients = [],
  onChange,
  onApplyRecipeCost,
}: RecipeBuilderProps) {
  const { data: inventoryItems = [], isLoading: invLoading, refetch: refetchInventory } = useInventory();
  const createInventoryItem = useCreateInventoryItem();

  // Local state for selecting ingredient to add
  const [selectedInvId, setSelectedInvId] = useState('');
  const [quantity, setQuantity] = useState('');
  const [unit, setUnit] = useState<MeasurementUnit>('g');

  // Quick Add Ingredient Dialog state
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickAddForm, setQuickAddForm] = useState({
    name: '',
    category: 'Vegetables',
    unit: 'kg',
    current_stock: '10',
    minimum_stock: '2',
    cost_per_unit: '100',
  });

  const selectedInventoryItem = useMemo(() => {
    return inventoryItems.find((i: any) => i.id === selectedInvId);
  }, [inventoryItems, selectedInvId]);

  // Set default compatible unit when selecting an inventory item
  const handleSelectIngredient = (invId: string) => {
    setSelectedInvId(invId);
    const item = inventoryItems.find((i: any) => i.id === invId);
    if (item) {
      const compUnits = getCompatibleUnits(item.unit);
      // Default to smaller recipe unit (e.g. g if inventory is kg, ml if inventory is L)
      if (compUnits.includes('g')) setUnit('g');
      else if (compUnits.includes('ml')) setUnit('ml');
      else setUnit(compUnits[0]);
    }
  };

  const compatibleUnits = useMemo(() => {
    if (!selectedInventoryItem) return MEASUREMENT_UNITS.map((u) => u.value);
    return getCompatibleUnits(selectedInventoryItem.unit);
  }, [selectedInventoryItem]);

  // Add ingredient to recipe
  const handleAddIngredient = () => {
    if (!selectedInvId || !selectedInventoryItem) {
      toast.error('Select an inventory ingredient first');
      return;
    }

    const qty = parseFloat(quantity);
    if (isNaN(qty) || qty <= 0) {
      toast.error('Enter a valid required quantity');
      return;
    }

    // Check duplicate
    if (ingredients.some((ing) => ing.inventory_item_id === selectedInvId)) {
      toast.error('This ingredient is already in the recipe');
      return;
    }

    const newIng: MenuItemIngredient = {
      inventory_item_id: selectedInvId,
      ingredient_name: selectedInventoryItem.name,
      quantity_required: qty,
      unit: unit,
      current_stock: Number(selectedInventoryItem.current_stock),
      inventory_unit: selectedInventoryItem.unit,
      cost_per_unit: Number(selectedInventoryItem.cost_per_unit),
    };

    onChange([...ingredients, newIng]);
    setSelectedInvId('');
    setQuantity('');
    toast.success(`Added ${newIng.ingredient_name} to recipe`);
  };

  // Remove ingredient
  const handleRemoveIngredient = (invId: string) => {
    onChange(ingredients.filter((ing) => ing.inventory_item_id !== invId));
  };

  // Quick create inventory item
  const handleQuickAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickAddForm.name || !quickAddForm.cost_per_unit) {
      toast.error('Name and cost per unit are required');
      return;
    }

    try {
      const res = await createInventoryItem.mutateAsync({
        name: quickAddForm.name,
        category: quickAddForm.category,
        unit: quickAddForm.unit,
        current_stock: parseFloat(quickAddForm.current_stock) || 0,
        minimum_stock: parseFloat(quickAddForm.minimum_stock) || 0,
        cost_per_unit: parseFloat(quickAddForm.cost_per_unit) || 0,
      });

      toast.success(`Created ingredient: ${quickAddForm.name}`);
      await refetchInventory();
      setIsQuickAddOpen(false);

      // Auto-select the newly created ingredient
      if (res?.data?.id) {
        handleSelectIngredient(res.data.id);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to create ingredient');
    }
  };

  // Calculate total recipe cost per serving
  const totalRecipeCost = useMemo(() => {
    let sum = 0;
    for (const ing of ingredients) {
      const inv = inventoryItems.find((i: any) => i.id === ing.inventory_item_id);
      if (inv) {
        sum += calculateIngredientCost(
          ing.quantity_required,
          ing.unit,
          Number(inv.cost_per_unit),
          inv.unit
        );
      }
    }
    return Number(sum.toFixed(2));
  }, [ingredients, inventoryItems]);

  return (
    <div className="space-y-4 pt-4 border-t border-slate-200">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="font-semibold text-sm text-slate-900 flex items-center gap-1.5">
            <Sparkles className="size-4 text-[#e11d48]" />
            Recipe &amp; Ingredient Requirements
          </h4>
          <p className="text-xs text-slate-400 mt-0.5">
            Ingredients deducted automatically from stock when this dish is prepared
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setIsQuickAddOpen(true)}
          className="text-xs border-dashed text-[#e11d48] border-rose-200 hover:bg-rose-50"
        >
          <PackagePlus className="size-3.5 mr-1" />
          + New Ingredient
        </Button>
      </div>

      {/* Ingredient Selector Form */}
      <div className="p-3.5 bg-slate-50/80 border border-slate-200 rounded-xl space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-12 gap-2.5 items-end">
          {/* 1. Choose Ingredient */}
          <div className="sm:col-span-5 space-y-1">
            <label className="text-[11px] font-semibold text-slate-600 block">
              Ingredient (from Inventory)
            </label>
            <Select value={selectedInvId} onValueChange={handleSelectIngredient}>
              <SelectTrigger className="w-full bg-white text-xs h-9">
                <SelectValue placeholder="— Select Ingredient —" />
              </SelectTrigger>
              <SelectContent>
                {inventoryItems.length === 0 ? (
                  <SelectItem value="__empty" disabled>
                    No ingredients in Inventory
                  </SelectItem>
                ) : (
                  inventoryItems.map((inv: any) => (
                    <SelectItem key={inv.id} value={inv.id}>
                      <span className="flex items-center justify-between gap-3 w-full">
                        <span className="font-medium text-xs truncate">{inv.name}</span>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          (Stock: {Number(inv.current_stock)} {inv.unit})
                        </span>
                      </span>
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>

          {/* 2. Quantity Required for 1 Serving */}
          <div className="sm:col-span-3 space-y-1">
            <label className="text-[11px] font-semibold text-slate-600 block">
              Qty / Serving
            </label>
            <Input
              type="number"
              step="any"
              min="0"
              placeholder="e.g. 150"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              className="bg-white text-xs h-9"
            />
          </div>

          {/* 3. Measurement Unit */}
          <div className="sm:col-span-2 space-y-1">
            <label className="text-[11px] font-semibold text-slate-600 block">
              Unit
            </label>
            <Select
              value={unit}
              onValueChange={(val: MeasurementUnit) => setUnit(val)}
            >
              <SelectTrigger className="w-full bg-white text-xs h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {compatibleUnits.map((u) => (
                  <SelectItem key={u} value={u} className="text-xs">
                    {u}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 4. Add Button */}
          <div className="sm:col-span-2">
            <Button
              type="button"
              onClick={handleAddIngredient}
              disabled={!selectedInvId || !quantity}
              className="w-full bg-[#e11d48] hover:bg-[#be123c] text-white text-xs h-9 font-semibold"
            >
              <Plus className="size-3.5 mr-1" /> Add
            </Button>
          </div>
        </div>

        {selectedInventoryItem && (
          <div className="flex items-center gap-3 text-[11px] text-slate-500 pt-1">
            <span>
              Available Stock:{' '}
              <strong className="text-slate-800">
                {Number(selectedInventoryItem.current_stock)} {selectedInventoryItem.unit}
              </strong>
            </span>
            <span>·</span>
            <span>
              Cost:{' '}
              <strong className="text-slate-800">
                ₹{Number(selectedInventoryItem.cost_per_unit)} / {selectedInventoryItem.unit}
              </strong>
            </span>
          </div>
        )}
      </div>

      {/* Selected Recipe Ingredients List */}
      {ingredients.length === 0 ? (
        <div className="py-5 text-center border border-dashed border-slate-200 rounded-xl bg-slate-50/50">
          <AlertCircle className="size-6 text-slate-300 mx-auto mb-1.5" />
          <p className="text-xs text-slate-500 font-medium">No recipe ingredients added yet</p>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Add the ingredients needed to prepare 1 serving of this dish.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="border border-slate-200 rounded-xl divide-y divide-slate-100 overflow-hidden bg-white">
            {ingredients.map((ing) => {
              const inv = inventoryItems.find((i: any) => i.id === ing.inventory_item_id);
              const cost = inv
                ? calculateIngredientCost(
                    ing.quantity_required,
                    ing.unit,
                    Number(inv.cost_per_unit),
                    inv.unit
                  )
                : 0;

              let hasStock = true;
              if (inv) {
                try {
                  const stockInRecipeUnit = convertQuantity(
                    Number(inv.current_stock),
                    inv.unit,
                    ing.unit
                  );
                  hasStock = stockInRecipeUnit >= ing.quantity_required;
                } catch {
                  hasStock = false;
                }
              }

              return (
                <div
                  key={ing.inventory_item_id}
                  className="flex items-center justify-between p-3 text-xs hover:bg-slate-50/60 transition-colors"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <CheckCircle2 className="size-4 text-emerald-600 shrink-0" />
                    <div>
                      <span className="font-bold text-slate-900 block truncate">
                        {ing.ingredient_name}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        Stock:{' '}
                        {inv ? `${Number(inv.current_stock)} ${inv.unit}` : 'Not found'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="font-semibold text-slate-800 tabular-nums">
                      {ing.quantity_required} {ing.unit}
                    </span>

                    <span className="text-slate-500 font-medium tabular-nums min-w-[50px] text-right">
                      ₹{cost.toFixed(2)}
                    </span>

                    <button
                      type="button"
                      onClick={() => handleRemoveIngredient(ing.inventory_item_id)}
                      className="text-slate-400 hover:text-rose-600 p-1 rounded-md transition-colors"
                      title="Remove ingredient"
                      aria-label={`Remove ${ing.ingredient_name}`}
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Recipe Cost Calculation Bar */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-rose-50/70 border border-rose-200/60 text-xs">
            <div className="flex items-center gap-2">
              <Calculator className="size-4 text-[#e11d48]" />
              <span className="font-medium text-slate-700">Estimated Recipe Cost:</span>
              <span className="font-extrabold text-sm text-[#e11d48]">
                ₹{totalRecipeCost.toFixed(2)} / serving
              </span>
            </div>

            {onApplyRecipeCost && totalRecipeCost > 0 && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => onApplyRecipeCost(totalRecipeCost)}
                className="h-7 text-[11px] font-semibold bg-white border-rose-300 text-[#e11d48] hover:bg-rose-100"
              >
                Use Recipe Cost (₹{totalRecipeCost.toFixed(2)})
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Quick Add Ingredient to Inventory Dialog */}
      <Dialog open={isQuickAddOpen} onOpenChange={setIsQuickAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Quick Register Ingredient in Inventory</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleQuickAdd} className="space-y-3.5">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">
                Ingredient Name *
              </label>
              <Input
                placeholder="e.g. Beef, Basmati Rice, Ginger Garlic Paste"
                required
                value={quickAddForm.name}
                onChange={(e) => setQuickAddForm({ ...quickAddForm, name: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Category
                </label>
                <Select
                  value={quickAddForm.category}
                  onValueChange={(val) => setQuickAddForm({ ...quickAddForm, category: val })}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {['Meat', 'Rice', 'Spices', 'Vegetables', 'Oil', 'Dairy', 'General'].map(
                      (cat) => (
                        <SelectItem key={cat} value={cat}>
                          {cat}
                        </SelectItem>
                      )
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-700 block mb-1">
                  Base Unit
                </label>
                <Select
                  value={quickAddForm.unit}
                  onValueChange={(val) => setQuickAddForm({ ...quickAddForm, unit: val })}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="kg">kg (Kilogram)</SelectItem>
                    <SelectItem value="g">g (Gram)</SelectItem>
                    <SelectItem value="L">L (Liter)</SelectItem>
                    <SelectItem value="ml">ml (Milliliter)</SelectItem>
                    <SelectItem value="pieces">pieces</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2.5">
              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Stock
                </label>
                <Input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="10"
                  value={quickAddForm.current_stock}
                  onChange={(e) =>
                    setQuickAddForm({ ...quickAddForm, current_stock: e.target.value })
                  }
                  className="h-9 text-xs"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Min Stock
                </label>
                <Input
                  type="number"
                  step="any"
                  min="0"
                  placeholder="2"
                  value={quickAddForm.minimum_stock}
                  onChange={(e) =>
                    setQuickAddForm({ ...quickAddForm, minimum_stock: e.target.value })
                  }
                  className="h-9 text-xs"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-700 block mb-1">
                  Cost (₹) *
                </label>
                <Input
                  type="number"
                  step="any"
                  min="0"
                  required
                  placeholder="₹/unit"
                  value={quickAddForm.cost_per_unit}
                  onChange={(e) =>
                    setQuickAddForm({ ...quickAddForm, cost_per_unit: e.target.value })
                  }
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <DialogFooter className="pt-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsQuickAddOpen(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                className="bg-[#e11d48] text-white hover:bg-[#be123c]"
                disabled={createInventoryItem.isPending}
              >
                {createInventoryItem.isPending ? 'Saving…' : 'Save Ingredient'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
