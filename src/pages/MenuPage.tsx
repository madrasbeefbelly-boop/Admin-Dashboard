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
import { Plus, Search, UtensilsCrossed, TrendingUp, Pencil, Trash2, Loader2 } from 'lucide-react';
import { useMenuItems, useCreateMenuItem, useDeleteMenuItem, useUpdateMenuItem } from '@/hooks/api';
import { toast } from 'sonner';
import { isAxiosError } from 'axios';
import type { MenuCatalogItem } from '@/types';
import { menuPosterUrl } from '@/brand';
import { averageMenuMargin } from '@/lib/utils';

const categoryColors: Record<string, string> = {
  'Starters': 'bg-gold/10 text-gold border-gold/20',
  'Gravy': 'bg-gold/10 text-gold border-gold/20',
  'Snacks': 'bg-secondary text-secondary-foreground border-border',
  'Noodles': 'bg-info/10 text-info border-info/20',
  'Shawarma': 'bg-success/10 text-success border-success/20',
  'Main': 'bg-gold/10 text-gold border-gold/20',
  'BBQ': 'bg-destructive/10 text-destructive border-destructive/20',
  'Rice': 'bg-warning/10 text-warning border-warning/20',
  'Dessert': 'bg-info/10 text-info border-info/20',
  'Live Station': 'bg-success/10 text-success border-success/20',
  'Appetizer': 'bg-secondary text-secondary-foreground border-border',
};

const menuCategories = ['Starters', 'Gravy', 'Rice', 'Snacks', 'Noodles', 'Shawarma'];
const emptyDish = { name: '', description: '', category: 'Starters', cost_per_serving: '', selling_price: '' };
const formatPrice = (value: string | number | null) => value == null ? 'Not set' : '₹' + Number(value).toFixed(2);

export default function MenuPage() {
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [editing, setEditing] = useState<MenuCatalogItem | null>(null);
  const [formData, setFormData] = useState(emptyDish);

  // API hooks
  const { data: menuItems = [], isLoading, error, refetch } = useMenuItems();
  const createMenuItem = useCreateMenuItem();
  const updateMenuItem = useUpdateMenuItem();
  const isSaving = createMenuItem.isPending || updateMenuItem.isPending;
  const categories = [...new Set([...menuCategories, ...menuItems.map(item => item.category), formData.category])];
  const deleteMenuItem = useDeleteMenuItem();

  const filteredItems = menuItems.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || item.category === categoryFilter;
    return matchesSearch && matchesCategory;
  }).sort((first, second) => categories.indexOf(first.category) - categories.indexOf(second.category));

  // Calculate summary stats
  const avgMargin = averageMenuMargin(menuItems);
  const totalItems = menuItems.length;
  const activeItems = menuItems.filter(i => i.is_available && i.selling_price != null).length;

  const openDishForm = (item: MenuCatalogItem | null = null) => {
    setEditing(item);
    setFormData(item ? {
      name: item.name,
      description: item.description ?? '',
      category: item.category,
      cost_per_serving: item.cost_per_serving?.toString() ?? '',
      selling_price: item.selling_price?.toString() ?? '',
    } : emptyDish);
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
      toast.error(isAxiosError(error) ? error.response?.data?.error || 'Could not save dish' : 'Could not save dish');
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
          <Loader2 className="w-8 h-8 animate-spin text-gold" />
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
          <Button onClick={() => refetch()} className="mt-4">
            Try Again
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout title="Menu & Costing" subtitle="Manage your dishes and pricing">
      <div className="mb-5 flex justify-end">
        <Button asChild variant="outline"><a href={menuPosterUrl} target="_blank" rel="noreferrer">View menu poster</a></Button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center">
              <UtensilsCrossed className="w-5 h-5 text-gold" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total Dishes</p>
              <p className="font-display text-2xl font-semibold">{totalItems}</p>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Avg Margin</p>
              <p className="font-display text-2xl font-semibold">{avgMargin == null ? '—' : avgMargin.toFixed(0) + '%'}</p>
            </div>
          </div>
        </div>
        <div className="stat-card">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-info/10 flex items-center justify-center">
              <UtensilsCrossed className="w-5 h-5 text-info" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Priced Dishes</p>
              <p className="font-display text-2xl font-semibold">{activeItems}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search dishes..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px] max-md:w-full" aria-label="Filter by category">
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map(category => <SelectItem key={category} value={category}>{category}</SelectItem>)}
          </SelectContent>
        </Select>

        <Button
          className="bg-gold hover:bg-gold-light text-primary-foreground"
          onClick={() => openDishForm()}
        >
          <Plus className="w-4 h-4 mr-2" />
          Add Dish
        </Button>
      </div>

      {/* Add Dish Dialog */}
      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit dish' : 'Add dish'}</DialogTitle>
            <DialogDescription>Set your selling price and cost to calculate the dish margin.</DialogDescription>
          </DialogHeader>
          <form id="dish-form" onSubmit={saveDish} className="space-y-4">
            <div>
              <label htmlFor="dish-name" className="text-sm font-medium">Dish name</label>
              <Input
                placeholder="e.g., Tawa Beef"
                id="dish-name"
                required
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="dish-description" className="text-sm font-medium">Description</label>
              <Input
                id="dish-description"
                placeholder="Brief description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div>
              <label htmlFor="dish-category" className="text-sm font-medium">Category</label>
              <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                <SelectTrigger id="dish-category">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {categories.map(category => <SelectItem key={category} value={category}>{category}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label htmlFor="dish-cost" className="text-sm font-medium">Cost per serving (₹)</label>
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
              <label htmlFor="dish-price" className="text-sm font-medium">Selling price (₹)</label>
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
              className="bg-gold hover:bg-gold-light"
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

      {/* Menu Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredItems.map((item) => (
          <div key={item.id} className="card-premium p-4 group hover:border-gold/30 transition-all duration-300 flex flex-col justify-between">
            <div>
              {/* Dish Image Banner */}
              <div className="relative mb-3 h-44 w-full overflow-hidden rounded-lg bg-secondary/40">
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
                  <Badge className={cn("border backdrop-blur-md shadow-sm", categoryColors[item.category])}>
                    {item.category}
                  </Badge>
                </div>
                <div className="absolute top-2.5 right-2.5 flex items-center gap-1 bg-background/90 backdrop-blur-md rounded-md p-0.5 shadow-sm">
                  <Button variant="ghost" size="icon" className="h-7 w-7" aria-label={"Edit " + item.name} onClick={() => openDishForm(item)}>
                    <Pencil className="size-3.5" />
                  </Button>
                  <Button
                    aria-label={"Delete " + item.name}
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7"
                    onClick={() => handleDeleteDish(item.id)}
                  >
                    <Trash2 className="w-3.5 h-3.5 text-destructive" />
                  </Button>
                </div>
              </div>

              <h3 className="font-display text-lg font-semibold text-foreground mb-1.5 max-md:[overflow-wrap:anywhere]">
                {item.name}
              </h3>

              {item.description && (
                <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{item.description}</p>
              )}
            </div>

            <div className="grid grid-cols-3 gap-2 pt-3 border-t border-border mt-3">
              <div>
                <p className="text-xs text-muted-foreground">Cost</p>
                <p className="font-semibold text-foreground">{formatPrice(item.cost_per_serving)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Price</p>
                <p className="font-semibold text-gold">{formatPrice(item.selling_price)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Margin</p>
                <p className={cn(
                  "font-semibold",
                  (Number(item.margin_percent) || 0) >= 50 ? "text-success" : "text-warning"
                )}>
                  {item.margin_percent == null ? '—' : Number(item.margin_percent).toFixed(0) + '%'}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredItems.length === 0 && (
        <div className="py-12 text-center card-premium">
          <p className="text-muted-foreground mb-4">No dishes found. {menuItems.length === 0 ? 'Start by adding your first dish!' : 'Try different filters.'}</p>
          {menuItems.length === 0 && (
            <Button
              className="bg-gold hover:bg-gold-light"
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
