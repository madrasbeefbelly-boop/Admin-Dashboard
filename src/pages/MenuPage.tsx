import { useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
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
} from 'lucide-react';
import { useMenuItems, useCreateMenuItem, useDeleteMenuItem, useUpdateMenuItem } from '@/hooks/api';
import { toast } from 'sonner';
import { isAxiosError } from 'axios';
import type { MenuCatalogItem } from '@/types';
import { menuPosterUrl } from '@/brand';
import { averageMenuMargin } from '@/lib/utils';

const categoryColors: Record<string, string> = {
  Starters: 'bg-rose-50 text-[#e11d48] border-rose-200',
  Gravy: 'bg-amber-50 text-amber-700 border-amber-200',
  Snacks: 'bg-slate-100 text-slate-700 border-slate-200',
  Noodles: 'bg-sky-50 text-sky-700 border-sky-200',
  Shawarma: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Main: 'bg-rose-50 text-[#e11d48] border-rose-200',
  BBQ: 'bg-red-50 text-red-700 border-red-200',
  Rice: 'bg-orange-50 text-orange-700 border-orange-200',
  Dessert: 'bg-purple-50 text-purple-700 border-purple-200',
  'Live Station': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Appetizer: 'bg-slate-100 text-slate-700 border-slate-200',
};

const menuCategories = ['Starters', 'Gravy', 'Rice', 'Snacks', 'Noodles', 'Shawarma'];
const emptyDish = { name: '', description: '', category: 'Starters', cost_per_serving: '', selling_price: '' };
const formatPrice = (value: string | number | null) =>
  value == null ? 'Not set' : '₹' + Number(value).toFixed(2);

export default function MenuPage() {
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
  const activeItems = menuItems.filter((i) => i.is_available && i.selling_price != null).length;

  const openDishForm = (item: MenuCatalogItem | null = null) => {
    setEditing(item);
    setFormData(
      item
        ? {
            name: item.name,
            description: item.description ?? '',
            category: item.category,
            cost_per_serving: item.cost_per_serving?.toString() ?? '',
            selling_price: item.selling_price?.toString() ?? '',
          }
        : emptyDish
    );
    setIsAddDialogOpen(true);
  };

  const saveDish = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
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
    };
    try {
      if (editing) {
        await updateMenuItem.mutateAsync({ id: editing.id, data: dish });
      } else {
        await createMenuItem.mutateAsync(dish);
      }
      toast.success(editing ? 'Dish updated' : 'Dish added');
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
          <Loader2 className="w-8 h-8 animate-spin text-[#e11d48]" />
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
          <Button onClick={() => refetch()} className="mt-4 bg-[#e11d48] text-white">
            Try Again
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Menu & Costing" subtitle="Manage your dishes and pricing">
      <div className="mb-5 flex justify-end">
        <Button asChild variant="outline">
          <a href={menuPosterUrl} target="_blank" rel="noreferrer">
            View menu poster
          </a>
        </Button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-rose-50 flex items-center justify-center">
              <UtensilsCrossed className="size-5 text-[#e11d48]" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Total Dishes</p>
              <p className="font-display text-2xl font-bold text-slate-900">{totalItems}</p>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-emerald-50 flex items-center justify-center">
              <TrendingUp className="size-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Avg Margin</p>
              <p className="font-display text-2xl font-bold text-slate-900">
                {avgMargin == null ? '—' : avgMargin.toFixed(0) + '%'}
              </p>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-sky-50 flex items-center justify-center">
              <UtensilsCrossed className="size-5 text-sky-600" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-medium">Priced Dishes</p>
              <p className="font-display text-2xl font-bold text-slate-900">{activeItems}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters & View Toggle Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search dishes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10 bg-white"
          />
        </div>

        <div className="flex items-center gap-2.5 flex-wrap sm:flex-nowrap">
          <Select value={categoryFilter} onValueChange={setCategoryFilter}>
            <SelectTrigger className="w-[160px] bg-white" aria-label="Filter by category">
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

          {/* List View / Grid View Segmented Button */}
          <div className="flex items-center rounded-xl border border-slate-200 bg-slate-100/90 p-1 shadow-xs">
            <button
              type="button"
              onClick={() => handleViewModeChange('grid')}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all',
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
                'flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition-all',
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
            className="bg-[#e11d48] hover:bg-[#be123c] text-white shrink-0 shadow-xs"
            onClick={() => openDishForm()}
          >
            <Plus className="size-4 mr-1.5" />
            Add Dish
          </Button>
        </div>
      </div>

      {/* Add / Edit Dish Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit dish' : 'Add dish'}</DialogTitle>
            <DialogDescription>
              Set your selling price and cost to calculate the dish margin.
            </DialogDescription>
          </DialogHeader>
          <form id="dish-form" onSubmit={saveDish} className="space-y-4">
            <div>
              <label htmlFor="dish-name" className="text-sm font-medium">
                Dish name
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
                value={formData.cost_per_serving}
                onChange={(e) => setFormData({ ...formData, cost_per_serving: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="dish-price" className="text-sm font-medium">
                Selling price (₹)
              </label>
              <Input
                id="dish-price"
                min="0"
                max="99999999.99"
                step="0.01"
                type="number"
                value={formData.selling_price}
                onChange={(e) => setFormData({ ...formData, selling_price: e.target.value })}
              />
            </div>
          </form>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
              Cancel
            </Button>
            <Button
              className="bg-[#e11d48] hover:bg-[#be123c] text-white"
              form="dish-form"
              type="submit"
              disabled={isSaving}
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
              className="card-premium p-4 group hover:border-[#e11d48]/30 transition-all duration-300 flex flex-col justify-between"
            >
              <div>
                {/* Dish Image Banner */}
                <div className="relative mb-3 h-44 w-full overflow-hidden rounded-xl bg-slate-100">
                  <img
                    src={item.image_url || `/MBB - Images/${item.name}.jpg`}
                    alt={item.name}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    onError={(e) => {
                      (e.target as HTMLElement).style.display = 'none';
                    }}
                  />
                  <div className="absolute top-2.5 left-2.5">
                    <Badge className={cn('border backdrop-blur-md shadow-xs', categoryColors[item.category])}>
                      {item.category}
                    </Badge>
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
                      className="size-7 rounded-md hover:bg-rose-50"
                      onClick={() => handleDeleteDish(item.id)}
                    >
                      <Trash2 className="size-3.5 text-rose-500" />
                    </Button>
                  </div>
                </div>

                <h3 className="font-display text-lg font-bold text-slate-900 mb-1 truncate">
                  {item.name}
                </h3>

                {item.description && (
                  <p className="text-xs text-slate-400 mb-3 line-clamp-2">{item.description}</p>
                )}
              </div>

              <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-100 mt-3">
                <div>
                  <p className="text-[11px] text-slate-400 font-medium">Cost</p>
                  <p className="font-semibold text-xs text-slate-700">{formatPrice(item.cost_per_serving)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-400 font-medium">Price</p>
                  <p className="font-bold text-xs text-[#e11d48]">{formatPrice(item.selling_price)}</p>
                </div>
                <div>
                  <p className="text-[11px] text-slate-400 font-medium">Margin</p>
                  <p
                    className={cn(
                      'font-semibold text-xs',
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
        /* ── LIST VIEW ── */
        <div className="card-premium overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50/80 border-b border-slate-100 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                <tr>
                  <th className="py-3.5 px-4">Dish</th>
                  <th className="py-3.5 px-4">Category</th>
                  <th className="py-3.5 px-4">Cost</th>
                  <th className="py-3.5 px-4">Selling Price</th>
                  <th className="py-3.5 px-4">Margin</th>
                  <th className="py-3.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredItems.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/60 transition-colors group">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={item.image_url || `/MBB - Images/${item.name}.jpg`}
                          alt={item.name}
                          loading="lazy"
                          className="size-12 rounded-xl object-cover border border-slate-200 shrink-0 shadow-xs"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-slate-900 group-hover:text-[#e11d48] transition-colors truncate">
                            {item.name}
                          </p>
                          {item.description && (
                            <p className="text-xs text-slate-400 truncate max-w-xs">
                              {item.description}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <Badge className={cn('border text-xs font-semibold px-2 py-0.5 shadow-xs', categoryColors[item.category])}>
                        {item.category}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-xs font-semibold text-slate-600">
                      {formatPrice(item.cost_per_serving)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-xs font-bold text-[#e11d48]">
                      {formatPrice(item.selling_price)}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span
                        className={cn(
                          'text-xs font-bold px-2 py-1 rounded-md inline-block',
                          item.margin_percent == null
                            ? 'text-slate-400 bg-slate-100'
                            : Number(item.margin_percent) >= 50
                            ? 'text-emerald-700 bg-emerald-50'
                            : 'text-amber-700 bg-amber-50'
                        )}
                      >
                        {item.margin_percent == null ? '—' : Number(item.margin_percent).toFixed(0) + '%'}
                      </span>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100"
                          aria-label={'Edit ' + item.name}
                          onClick={() => openDishForm(item)}
                        >
                          <Pencil className="size-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 rounded-lg text-slate-400 hover:text-destructive hover:bg-rose-50"
                          aria-label={'Delete ' + item.name}
                          onClick={() => handleDeleteDish(item.id)}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
              className="bg-[#e11d48] hover:bg-[#be123c] text-white"
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
