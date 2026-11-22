import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatCard } from '@/components/dashboard/StatCard';
import { isMockMode } from '@/lib/mock-mode';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PhotoPicker } from '@/components/ui/photo-picker';
import { PhotoPreview } from '@/components/ui/photo-preview';
import { catalogPhotoSource } from '@/lib/catalog-photo';
import { useAuth } from '@/contexts/AuthContext';
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
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import {
  Plus,
  Search,
  UtensilsCrossed,
  TrendingUp,
  Pencil,
  Trash2,
  Loader2,
  LayoutGrid,
  List,
  Layers,
} from 'lucide-react';
import { useMenuItems, useCreateMenuItem, useDeleteMenuItem, useUpdateMenuItem } from '@/hooks/api';
import { RecipeBuilder } from '@/components/menu/RecipeBuilder';
import { toast } from 'sonner';
import { isAxiosError } from 'axios';
import type { MenuCatalogItem, MenuItemIngredient } from '@/types';
import { averageMenuMargin } from '@/lib/utils';

const categoryColors: Record<string, string> = {
  Starters: 'bg-red-50 text-[#dc2626] border-red-200',
  Gravy: 'bg-amber-50 text-amber-700 border-amber-200',
  Snacks: 'bg-slate-100 text-slate-700 border-slate-200',
  Noodles: 'bg-sky-50 text-sky-700 border-sky-200',
  Shawarma: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Main: 'bg-red-50 text-[#dc2626] border-red-200',
  BBQ: 'bg-red-50 text-red-700 border-red-200',
  Rice: 'bg-orange-50 text-orange-700 border-orange-200',
  Dessert: 'bg-purple-50 text-purple-700 border-purple-200',
  Combos: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  Offers: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'Live Station': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Appetizer: 'bg-slate-100 text-slate-700 border-slate-200',
};

const menuCategories = ['Rice', 'Starters', 'Noodles', 'Gravy', 'Combos', 'Offers', 'Shawarma', 'Snacks'];
const emptyDish = {
  name: '',
  description: '',
  category: 'Starters',
  cost_per_serving: '',
  selling_price: '',
  ingredients: [] as MenuItemIngredient[],
};
const formatPrice = (value: string | number | null) =>
  value == null ? 'Not set' : '₹' + Number(value).toFixed(2);

function DishCardImage({
  src,
  name,
  className,
  aspectRatio = 'banner',
}: {
  src?: string | null;
  name: string;
  className?: string;
  aspectRatio?: 'banner' | 'square';
}) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const isPlaceholder = !src || src === '/placeholder.svg' || failedSource === src;

  if (isPlaceholder) {
    return (
      <div
        className={cn(
          'h-full w-full flex flex-col items-center justify-center bg-gradient-to-br from-red-50/70 via-slate-50 to-red-100/40 text-slate-400 select-none border border-dashed border-red-200/50',
          aspectRatio === 'square' ? 'p-2 text-center' : 'p-4',
          className
        )}
      >
        <div
          className={cn(
            'rounded-xl bg-white/95 shadow-xs flex items-center justify-center border border-red-100/80',
            aspectRatio === 'square' ? 'size-9 mb-1' : 'size-12 mb-2'
          )}
        >
          <UtensilsCrossed
            className={cn(
              'text-[#dc2626]/60',
              aspectRatio === 'square' ? 'size-4.5' : 'size-6'
            )}
          />
        </div>
        <span
          className={cn(
            'font-bold text-slate-400 uppercase tracking-wider',
            aspectRatio === 'square' ? 'text-[9px]' : 'text-[11px]'
          )}
        >
          Image Placeholder
        </span>
        {aspectRatio !== 'square' && (
          <span className="text-[10px] text-slate-400/80 mt-0.5">Madras Beef Belly</span>
        )}
      </div>
    );
  }

  return (
    <PhotoPreview name={name} src={catalogPhotoSource(src)} className="size-full" showExpandIcon>
      <img
        src={catalogPhotoSource(src)}
        alt=""
        loading="lazy"
        className={cn(
          'h-full w-full object-cover transition-transform duration-300 group-hover:scale-105',
          className
        )}
        onError={() => setFailedSource(src)}
      />
    </PhotoPreview>
  );
}

export default function MenuPage() {
  const { isAdmin } = useAuth();
  const [photo, setPhoto] = useState<string | null>();
  const [photoPending, setPhotoPending] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MenuCatalogItem | null>(null);
  const [formData, setFormData] = useState(emptyDish);

  // View mode: Grid vs List (persisted in localStorage)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => {
    return (localStorage.getItem('mbb_menu_view_mode') as 'grid' | 'list') || 'grid';
  });

  const handleViewModeChange = (mode: 'grid' | 'list') => {
    setViewMode(mode);
    localStorage.setItem('mbb_menu_view_mode', mode);
  };

  // API hooks
  const { data: menuItems = [], isLoading, error, refetch } = useMenuItems();
  const createMenuItem = useCreateMenuItem();
  const updateMenuItem = useUpdateMenuItem();
  const isSaving = createMenuItem.isPending || updateMenuItem.isPending;
  const existingPhoto = editing?.image_url && editing.image_url !== '/placeholder.svg'
    ? catalogPhotoSource(editing.image_url)
    : null;
  const categories = [
    ...new Set([...menuCategories, ...menuItems.map((item) => item.category), formData.category]),
  ];
  const deleteMenuItem = useDeleteMenuItem();

  const filteredItems = menuItems
    .filter((item) => {
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
      return matchesSearch && matchesCategory;
    })
    .sort(
      (first, second) => categories.indexOf(first.category) - categories.indexOf(second.category)
    );

  // Calculate summary stats
  const avgMargin = averageMenuMargin(menuItems);
  const totalItems = menuItems.length;
  const pricedItems = menuItems.filter((item) => item.is_available && item.selling_price != null);

  const openDishForm = (item: MenuCatalogItem | null = null) => {
    setEditing(item);
    setPhoto(undefined);
    setPhotoPending(false);
    setFormData(
      item
        ? {
            name: item.name,
            description: item.description ?? '',
            category: item.category,
            cost_per_serving: item.cost_per_serving?.toString() ?? '',
            selling_price: item.selling_price?.toString() ?? '',
            ingredients: item.ingredients ? [...item.ingredients] : [],
          }
        : emptyDish
    );
    setIsAddDialogOpen(true);
  };

  const saveDish = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isMockMode() || isSaving || photoPending) return;
    const name = formData.name.trim();
    if (!name) {
      toast.error('Enter a dish name');
      return;
    }
    const dish = {
      ...formData,
      name,
      cost_per_serving: formData.cost_per_serving === '' ? null : Number(formData.cost_per_serving),
      selling_price: formData.selling_price === '' ? null : Number(formData.selling_price),
      is_vegetarian: editing?.is_vegetarian ?? false,
      prep_time_minutes: editing ? editing.prep_time_minutes : 30,
      ingredients: formData.ingredients,
      photo: editing ? photo : photo ?? undefined,
    };
    try {
      if (editing) {
        await updateMenuItem.mutateAsync({ id: editing.id, data: dish });
      } else {
        await createMenuItem.mutateAsync(dish);
      }
      toast.success(editing ? 'Dish and recipe updated' : 'Dish and recipe created');
      setIsAddDialogOpen(false);
    } catch (error) {
      toast.error(
        isAxiosError(error)
          ? error.response?.data?.error || 'Could not save dish'
          : 'Could not save dish'
      );
    }
  };

  const handleDeleteDish = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this dish?')) return;

    try {
      await deleteMenuItem.mutateAsync(id);
      toast.success('Dish deleted successfully!');
    } catch (error) {
      toast.error('Failed to delete dish');
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <DashboardLayout title="Menu & Costing" subtitle="Manage your dishes and pricing">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-[#dc2626]" />
        </div>
      </DashboardLayout>
    );
  }

  // Error state
  if (error) {
    return (
      <DashboardLayout title="Menu & Costing" subtitle="Manage your dishes and pricing">
        <div className="p-8 text-red-500 text-center">
          Failed to load menu items. Make sure the backend server is running.
          <Button onClick={() => refetch()} className="mt-4 bg-[#dc2626] text-white">
            Try Again
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Menu & Costing" subtitle="Manage your dishes and pricing">
      <div className="summary-counts mb-6 grid grid-cols-3 gap-2 md:gap-4">
        <StatCard title="Total Dishes" value={totalItems} icon={UtensilsCrossed} />
        <StatCard title="Avg Margin" value={avgMargin == null ? '—' : avgMargin.toFixed(0) + '%'} icon={TrendingUp}
          accent="text-emerald-600" />
        <StatCard title="Priced Dishes" value={pricedItems.length} icon={UtensilsCrossed}
          accent="text-sky-600" />
      </div>

      {/* Filters & View Toggle Bar */}
      <div className="mb-6 flex flex-col items-stretch gap-3 lg:flex-row lg:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search dishes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-white"
          />
        </div>

        <div className="flex flex-wrap items-center gap-2 sm:flex-nowrap sm:gap-2.5">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-30 bg-white sm:w-[160px]" aria-label="Filter by category">
              <SelectValue placeholder="All Categories" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Categories</SelectItem>
              {categories.map((category) => (
                <SelectItem key={category} value={category}>
                  {category}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="ml-auto flex shrink-0 items-center gap-2 sm:ml-0 sm:gap-2.5">
            {/* List View / Grid View Segmented Button */}
            <div className="flex items-center rounded-xl border border-slate-200 bg-slate-100/90 p-1 shadow-xs">
              <button
                type="button"
                onClick={() => handleViewModeChange('grid')}
                className={cn(
                  'flex items-center gap-1.5 px-2 py-1.5 sm:px-3 text-xs font-semibold rounded-lg transition-all',
                  viewMode === 'grid'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                )}
                aria-label="Grid view"
                title="Grid view"
              >
                <LayoutGrid className="size-4" />
                <span className="hidden sm:inline">Grid</span>
              </button>
              <button
                type="button"
                onClick={() => handleViewModeChange('list')}
                className={cn(
                  'flex items-center gap-1.5 px-2 py-1.5 sm:px-3 text-xs font-semibold rounded-lg transition-all',
                  viewMode === 'list'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-500 hover:text-slate-900'
                )}
                aria-label="List view"
                title="List view"
              >
                <List className="size-4" />
                <span className="hidden sm:inline">List</span>
              </button>
            </div>

            <Button
              className="bg-[#dc2626] hover:bg-[#b91c1c] text-white shrink-0 shadow-xs max-sm:px-2.5"
              onClick={() => openDishForm()}
            >
              <Plus className="size-4 sm:mr-1.5" />
              Add Dish
            </Button>
          </div>
        </div>
      </div>

      {/* Add / Edit Dish Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[calc(100dvh-2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit dish' : 'Add dish'}</DialogTitle>
            <DialogDescription>
              Set selling price, cost, and build the recipe from inventory ingredients.
            </DialogDescription>
          </DialogHeader>
          <form id="dish-form" onSubmit={saveDish} className="space-y-4">
            {isAdmin() && (
              <PhotoPicker
                label="Dish photo"
                source={photo === undefined ? existingPhoto : photo}
                onChange={setPhoto}
                onPendingChange={setPhotoPending}
                disabled={isMockMode() || isSaving}
              />
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="dish-name" className="text-sm font-medium">
                  Dish name *
                </label>
                <Input
                  placeholder="e.g., Tawa Beef"
                  id="dish-name"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="dish-category" className="text-sm font-medium">
                  Category
                </label>
                <Select
                  value={formData.category}
                  onValueChange={(value) => setFormData({ ...formData, category: value })}
                >
                  <SelectTrigger id="dish-category">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((category) => (
                      <SelectItem key={category} value={category}>
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div>
              <label htmlFor="dish-description" className="text-sm font-medium">
                Description
              </label>
              <Input
                id="dish-description"
                placeholder="Brief description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="dish-cost" className="text-sm font-medium">
                  Cost per serving (₹)
                </label>
                <Input
                  id="dish-cost"
                  min="0"
                  max="99999999.99"
                  step="0.01"
                  type="number"
                  placeholder="Auto-calculated from recipe or custom"
                  value={formData.cost_per_serving}
                  onChange={(e) => setFormData({ ...formData, cost_per_serving: e.target.value })}
                />
              </div>
              <div>
                <label htmlFor="dish-price" className="text-sm font-medium">
                  Selling price (₹) *
                </label>
                <Input
                  id="dish-price"
                  min="0"
                  max="99999999.99"
                  step="0.01"
                  type="number"
                  placeholder="e.g., 180"
                  value={formData.selling_price}
                  onChange={(e) => setFormData({ ...formData, selling_price: e.target.value })}
                />
              </div>
            </div>

            {/* Recipe & Ingredient Requirements Section */}
            <div className="border-t border-slate-200 pt-3">
              <RecipeBuilder
                ingredients={formData.ingredients}
                onChange={(ingredients) => setFormData((prev) => ({ ...prev, ingredients }))}
                onApplyRecipeCost={(calculatedCost) => {
                  setFormData((prev) => ({ ...prev, cost_per_serving: calculatedCost.toFixed(2) }));
                  toast.success(`Cost per serving set to ₹${calculatedCost.toFixed(2)} from recipe`);
                }}
              />
            </div>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-[#dc2626] hover:bg-[#b91c1c] text-white"
              form="dish-form"
              type="submit"
              disabled={isMockMode() || isSaving || photoPending}
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" />
                  {editing ? 'Save changes' : 'Add dish'}
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dishes Display: GRID VIEW vs LIST VIEW */}
      {viewMode === 'grid' ? (
        /* ── GRID VIEW ── */
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="card-premium p-3.5 sm:p-4 group hover:border-[#dc2626]/30 transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                {/* Dish Image Banner - increased height for mobile and desktop */}
                <div className="relative mb-2.5 h-60 sm:h-64 md:h-56 lg:h-64 w-full overflow-hidden rounded-xl bg-slate-100 shadow-xs">
                  <DishCardImage src={item.image_url} name={item.name} aspectRatio="banner" />
                  <div className="absolute top-2.5 left-2.5 flex flex-col gap-1 items-start">
                    {item.ingredients && item.ingredients.length > 0 ? (
                      item.is_in_stock === false || item.servings_available === 0 ? (
                        <Badge className="bg-red-600/90 text-white font-bold text-[10px] backdrop-blur-md border-0 shadow-sm">
                          Out of stock (0)
                        </Badge>
                      ) : (
                        <Badge className={cn(
                          'text-white font-bold text-[10px] backdrop-blur-md border-0 shadow-sm',
                          (item.servings_available ?? 0) <= 5 ? 'bg-amber-600/90' : 'bg-emerald-600/90'
                        )}>
                          {item.servings_available} serving{(item.servings_available ?? 0) !== 1 ? 's' : ''}
                        </Badge>
                      )
                    ) : null}
                  </div>
                  <div className="absolute top-2.5 right-2.5 flex items-center gap-1 bg-white/95 backdrop-blur-md rounded-lg p-0.5 shadow-sm">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-7 rounded-md hover:bg-slate-100"
                      aria-label={'Edit ' + item.name}
                      onClick={() => openDishForm(item)}
                    >
                      <Pencil className="size-3.5 text-slate-600" />
                    </Button>
                    <Button
                      aria-label={'Delete ' + item.name}
                      variant="ghost"
                      size="icon"
                      className="size-7 rounded-md hover:bg-red-50"
                      onClick={() => handleDeleteDish(item.id)}
                      disabled={isMockMode()}
                    >
                      <Trash2 className="size-3.5 text-red-500" />
                    </Button>
                  </div>
                </div>

                {/* Compact Content: Category badge + Recipe ingredients on same row, Dish Name below */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline" className={cn('text-[10px] font-bold px-2 py-0.5 rounded-md border', categoryColors[item.category])}>
                      {item.category}
                    </Badge>
                    {item.ingredients && item.ingredients.length > 0 ? (
                      <span className="text-[11px] text-slate-500 flex items-center gap-1 font-medium">
                        <Layers className="size-3 text-[#dc2626]" />
                        {item.ingredients.length} ingredients
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-400 italic">No recipe</span>
                    )}
                  </div>
                  <h3 className="font-display text-base sm:text-lg font-bold text-slate-900 group-hover:text-[#dc2626] transition-colors truncate">
                    {item.name}
                  </h3>
                </div>
              </div>

              {/* Compact Pricing Row: Cost, Price, Margin */}
              <div className="grid grid-cols-3 gap-2 pt-2.5 mt-2.5 border-t border-slate-100">
                <div>
                  <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Cost</p>
                  <p className="font-semibold text-xs text-slate-700 tabular-nums">{formatPrice(item.cost_per_serving)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Price</p>
                  <p className="font-bold text-xs text-[#dc2626] tabular-nums">{formatPrice(item.selling_price)}</p>
                </div>
                <div>
                  <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wider">Margin</p>
                  <p
                    className={cn(
                      'font-semibold text-xs tabular-nums',
                      item.margin_percent == null
                        ? 'text-slate-400'
                        : Number(item.margin_percent) >= 50
                        ? 'text-emerald-600'
                        : 'text-amber-600'
                    )}
                  >
                    {item.margin_percent == null ? '—' : Number(item.margin_percent).toFixed(0) + '%'}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        /* ── EXPANDED LIST CARDS VIEW (LARGE IMAGES & TEXTS) ── */
        <div className="space-y-4">
          {filteredItems.map((item) => (
            <div
              key={item.id}
              className="card-premium p-4 sm:p-5 rounded-2xl flex flex-col lg:flex-row lg:items-center justify-between gap-5 hover:border-[#dc2626]/40 hover:shadow-md transition-all duration-200 group"
            >
              {/* Left: Large Food Image + Big Dish Typography */}
              <div className="flex items-center gap-4 sm:gap-6 min-w-0 flex-1">
                {/* Large Food Image */}
                <div className="flex w-24 shrink-0 flex-col items-start gap-2 sm:w-28 md:w-36">
                  <div className="relative h-24 w-full overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-100 shadow-xs sm:h-28">
                    <DishCardImage src={item.image_url} name={item.name} aspectRatio="square" />
                  </div>
                  <Badge variant="outline" className={cn('max-w-full wrap-anywhere', categoryColors[item.category])}>
                    {item.category}
                  </Badge>
                </div>

                {/* Dish Info */}
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <h3 className="font-display text-xl sm:text-2xl font-bold text-slate-900 group-hover:text-[#dc2626] transition-colors wrap-anywhere">
                      {item.name}
                    </h3>
                    {item.ingredients && item.ingredients.length > 0 ? (
                      item.is_in_stock === false || item.servings_available === 0 ? (
                        <Badge variant="outline" className="text-xs font-bold px-2.5 py-0.5 rounded-lg border-red-200 bg-red-50 text-red-700">
                          Out of Stock (0 servings)
                        </Badge>
                      ) : (
                        <Badge variant="outline" className={cn(
                          'text-xs font-bold px-2.5 py-0.5 rounded-lg border shadow-xs',
                          (item.servings_available ?? 0) <= 5
                            ? 'border-amber-200 bg-amber-50 text-amber-700'
                            : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                        )}>
                          {item.servings_available} servings in stock
                        </Badge>
                      )
                    ) : (
                      <Badge variant="outline" className="text-xs text-slate-400 border-slate-200">
                        No recipe linked
                      </Badge>
                    )}
                    {item.ingredients && item.ingredients.length > 0 && (
                      <span className="text-xs text-slate-500 font-medium flex items-center gap-1 bg-slate-50 px-2 py-0.5 rounded-md border border-slate-200/60">
                        <Layers className="size-3 text-[#dc2626]" />
                        {item.ingredients.length} ingredient{item.ingredients.length > 1 ? 's' : ''}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Right: Metrics (Cost, Selling Price, Margin) + Action Buttons */}
              <div className="grid grid-cols-3 items-center gap-3 border-t border-slate-100 pt-3 lg:flex lg:shrink-0 lg:justify-end lg:gap-8 lg:border-t-0 lg:pt-0">
                <div className="text-left sm:text-center lg:min-w-[70px]">
                  <span className="text-[11px] sm:text-xs text-slate-400 font-semibold block uppercase tracking-wider">
                    Cost
                  </span>
                  <span className="font-bold text-base sm:text-lg text-slate-700">
                    {formatPrice(item.cost_per_serving)}
                  </span>
                </div>

                <div className="text-left sm:text-center lg:min-w-[85px]">
                  <span className="text-[11px] sm:text-xs text-slate-400 font-semibold block uppercase tracking-wider">
                    Price
                  </span>
                  <span className="font-extrabold text-xl sm:text-2xl text-[#dc2626]">
                    {formatPrice(item.selling_price)}
                  </span>
                </div>

                <div className="text-left sm:text-center lg:min-w-[75px]">
                  <span className="text-[11px] sm:text-xs text-slate-400 font-semibold block uppercase tracking-wider">
                    Margin
                  </span>
                  <span
                    className={cn(
                      'font-bold text-xs sm:text-sm px-3 py-1 rounded-lg inline-block shadow-xs',
                      item.margin_percent == null
                        ? 'text-slate-400 bg-slate-100'
                        : Number(item.margin_percent) >= 50
                        ? 'text-emerald-700 bg-emerald-50 border border-emerald-200/60'
                        : 'text-amber-700 bg-amber-50 border border-amber-200/60'
                    )}
                  >
                    {item.margin_percent == null
                      ? '—'
                      : Number(item.margin_percent).toFixed(0) + '%'}
                  </span>
                </div>

                {/* Edit & Delete Action Buttons */}
                <div className="col-span-3 flex items-center justify-end gap-2 lg:border-l lg:border-slate-200/80 lg:pl-5">
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-10 rounded-xl border-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-100 shadow-xs"
                    aria-label={'Edit ' + item.name}
                    onClick={() => openDishForm(item)}
                  >
                    <Pencil className="size-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="size-10 rounded-xl border-red-200 text-red-500 hover:text-red-700 hover:bg-red-50 shadow-xs"
                    aria-label={'Delete ' + item.name}
                    onClick={() => handleDeleteDish(item.id)}
                    disabled={isMockMode()}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Empty Search State */}
      {filteredItems.length === 0 && (
        <div className="py-12 text-center card-premium">
          <p className="text-muted-foreground mb-4">
            No dishes found.{' '}
            {menuItems.length === 0 ? 'Start by adding your first dish!' : 'Try different filters.'}
          </p>
          {menuItems.length === 0 && (
            <Button
              className="bg-[#dc2626] hover:bg-[#b91c1c] text-white"
              onClick={() => openDishForm()}
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Your First Dish
            </Button>
          )}
        </div>
      )}
    </DashboardLayout>
  );
}
