/**
 * Custom React Hooks for API Data Fetching
 * Uses React Query for caching and state management
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import type { DashboardStats, LowStockItem, MenuCatalogItem, Order } from '@/types';
import {
  menuAPI,
  inventoryAPI,
  purchaseAPI,
  searchAPI,
  userAPI,
  dashboardAPI,
  suppliersAPI,
  ordersAPI,
} from '@/lib/api';

// ============================================================================
// MENU ITEMS HOOKS
// ============================================================================

export const useMenuItems = () => {
  return useQuery<MenuCatalogItem[]>({
    queryKey: ['menuItems'],
    queryFn: async () => {
      const response = await menuAPI.getAll();
      return response.data.data;
    },
  });
};

export const useMenuItem = (id) => {
  return useQuery({
    queryKey: ['menuItem', id],
    queryFn: async () => {
      const response = await menuAPI.getById(id);
      return response.data.data;
    },
    enabled: !!id,
  });
};

export const useCreateMenuItem = () => {
  const queryClient = useQueryClient();
  return useMutation<any, Error, any>({
    mutationFn: (data) => menuAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menuItems'] });
    },
  });
};

export const useUpdateMenuItem = () => {
  const queryClient = useQueryClient();
  return useMutation<any, Error, { id: string; data: any }>({
    mutationFn: ({ id, data }) => menuAPI.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['menuItems'] });
      queryClient.invalidateQueries({ queryKey: ['menuItem', id] });
    },
  });
};

export const useDeleteMenuItem = () => {
  const queryClient = useQueryClient();
  return useMutation<any, Error, string>({
    mutationFn: (id: string) => menuAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['menuItems'] });
    },
  });
};

// ============================================================================
// INVENTORY HOOKS
// ============================================================================

export const useInventory = () => {
  return useQuery({
    queryKey: ['inventory'],
    queryFn: async () => {
      const response = await inventoryAPI.getAll();
      return response.data.data;
    },
  });
};

export const useLowStockItems = () => {
  return useQuery<LowStockItem[]>({
    queryKey: ['lowStockItems'],
    queryFn: async () => {
      const response = await inventoryAPI.getLowStock();
      return response.data.data;
    },
  });
};

export const useCreateInventoryItem = () => {
  const queryClient = useQueryClient();
  return useMutation<any, Error, any>({
    mutationFn: (data) => inventoryAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      queryClient.invalidateQueries({ queryKey: ['lowStockItems'] });
    },
  });
};

export const useUpdateInventoryItem = () => {
  const queryClient = useQueryClient();
  return useMutation<any, Error, { id: string; data: any }>({
    mutationFn: ({ id, data }) => inventoryAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
    },
  });
};

export const useUpdateStock = () => {
  const queryClient = useQueryClient();
  return useMutation<any, Error, { id: string; data: any }>({
    mutationFn: ({ id, data }) => inventoryAPI.updateStock(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      queryClient.invalidateQueries({ queryKey: ['lowStockItems'] });
    },
  });
};

export const useDeleteInventoryItem = () => {
  const queryClient = useQueryClient();
  return useMutation<any, Error, string>({
    mutationFn: (id) => inventoryAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      queryClient.invalidateQueries({ queryKey: ['lowStockItems'] });
    },
  });
};

// ============================================================================
// PURCHASE HOOKS
// ============================================================================

export const usePurchases = () => {
  return useQuery({
    queryKey: ['purchases'],
    queryFn: async () => {
      const response = await purchaseAPI.getAll();
      return response.data.data;
    },
  });
};

export const useCreatePurchase = () => {
  const queryClient = useQueryClient();
  return useMutation<any, Error, any>({
    mutationFn: (data) => purchaseAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      queryClient.invalidateQueries({ queryKey: ['lowStockItems'] });
    },
  });
};

export const useUpdatePurchase = () => {
  const queryClient = useQueryClient();
  return useMutation<any, Error, { id: string; data: any }>({
    mutationFn: ({ id, data }) => purchaseAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
    },
  });
};

export const useDeletePurchase = () => {
  const queryClient = useQueryClient();
  return useMutation<any, Error, string>({
    mutationFn: (id) => purchaseAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['purchases'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
    },
  });
};

// ============================================================================
// SEARCH HOOKS
// ============================================================================

export const useSearch = (query) => {
  return useQuery({
    queryKey: ['search', query],
    queryFn: async () => {
      if (!query || query.length < 2) {
        return { menuItems: [], inventory: [] };
      }
      const response = await searchAPI.search(query);
      return response.data.data;
    },
    enabled: !!query && query.length >= 2,
  });
};

// ============================================================================
// USER/PROFILE HOOKS
// ============================================================================

export const useProfile = () => {
  return useQuery({
    queryKey: ['profile'],
    queryFn: async () => {
      const response = await userAPI.getProfile();
      return response.data.data;
    },
  });
};

export const useUpdateProfile = () => {
  const queryClient = useQueryClient();
  return useMutation<any, Error, any>({
    mutationFn: (data) => userAPI.updateProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    },
  });
};

// ============================================================================
// DASHBOARD HOOKS
// ============================================================================

export const useDashboardStats = () => {
  return useQuery<DashboardStats>({
    queryKey: ['dashboardStats'],
    queryFn: async () => {
      const response = await dashboardAPI.getStats();
      return response.data.data;
    },
    refetchInterval: 30000, // Refetch every 30 seconds
  });
};

// ============================================================================
// SUPPLIERS HOOKS
// ============================================================================

export const useSuppliers = () => {
  return useQuery({
    queryKey: ['suppliers'],
    queryFn: async () => {
      const response = await suppliersAPI.getAll();
      return response.data.data;
    },
  });
};

export const useCreateSupplier = () => {
  const queryClient = useQueryClient();
  return useMutation<any, Error, any>({
    mutationFn: (data) => suppliersAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
  });
};
export const useDeleteSupplier = () => {
  const queryClient = useQueryClient();
  return useMutation<any, Error, string>({
    mutationFn: (id) => suppliersAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suppliers'] });
    },
  });
};

// ============================================================================
// ORDERS HOOKS
// ============================================================================

export const useOrders = () => {
  return useQuery<Order[]>({
    queryKey: ['orders'],
    queryFn: async () => {
      const response = await ordersAPI.getAll();
      return response.data.data;
    },
  });
};

export const useCreateOrder = () => {
  const queryClient = useQueryClient();
  return useMutation<any, Error, any>({
    mutationFn: (data) => ordersAPI.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
    },
  });
};

export const useDeleteOrder = () => {
  const queryClient = useQueryClient();
  return useMutation<any, Error, string>({
    mutationFn: (id) => ordersAPI.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
    },
  });
};

export const useUpdateOrderStatus = () => {
  const queryClient = useQueryClient();
  return useMutation<any, Error, { id: string; status: string; cancellation_reason?: string }>({
    mutationFn: ({ id, status, cancellation_reason }) =>
      ordersAPI.updateStatus(id, { status, cancellation_reason }),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['lowStockItems'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      queryClient.invalidateQueries({ queryKey: ['inventoryMovements'] });
      queryClient.invalidateQueries({ queryKey: ['orderRequirements', id] });
      queryClient.invalidateQueries({ queryKey: ['menuItems'] });
    },
  });
};

export const useOrderRequirements = (orderId: string | null | undefined) => {
  return useQuery({
    queryKey: ['orderRequirements', orderId],
    queryFn: async () => {
      if (!orderId) return null;
      const response = await ordersAPI.getRequirements(orderId);
      return response.data;
    },
    enabled: Boolean(orderId),
  });
};

export const useInventoryMovements = () => {
  return useQuery({
    queryKey: ['inventoryMovements'],
    queryFn: async () => {
      const response = await inventoryAPI.getMovements();
      return response.data.data;
    },
  });
};

export const useAdjustStock = () => {
  const queryClient = useQueryClient();
  return useMutation<any, Error, { id: string; quantity_change: number; movement_type?: string; notes?: string }>({
    mutationFn: ({ id, ...data }) => inventoryAPI.adjustStock(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['lowStockItems'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      queryClient.invalidateQueries({ queryKey: ['inventoryMovements'] });
      queryClient.invalidateQueries({ queryKey: ['menuItems'] });
    },
  });
};
