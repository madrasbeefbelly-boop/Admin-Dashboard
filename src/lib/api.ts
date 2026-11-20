/**
 * API Service Module
 * Centralized API calls for all frontend components
 */

import axios from "axios";
import config from "@/config";

const api = axios.create({
  baseURL: `${config.apiUrl}/api`,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

// ============================================================================
// MENU ITEMS API
// ============================================================================

export const menuAPI = {
  // Get all menu items
  getAll: () => api.get("/menu-items"),

  // Get single menu item
  getById: (id) => api.get(`/menu-items/${id}`),

  // Create menu item
  create: (data) => api.post("/menu-items", data),

  // Update menu item
  update: (id, data) => api.put(`/menu-items/${id}`, data),

  // Delete menu item
  delete: (id) => api.delete(`/menu-items/${id}`),
};

// ============================================================================
// INVENTORY API
// ============================================================================

export const inventoryAPI = {
  // Get all inventory items
  getAll: () => api.get("/inventory"),

  // Get low stock items
  getLowStock: () => api.get("/inventory/low-stock"),

  // Create inventory item
  create: (data) => api.post("/inventory", data),

  // Update inventory item
  update: (id, data) => api.put(`/inventory/${id}`, data),

  // Update stock
  updateStock: (id, data) => api.put(`/inventory/${id}/stock`, data),

  // Delete inventory item
  delete: (id) => api.delete(`/inventory/${id}`),
};

// ============================================================================
// PURCHASES API
// ============================================================================

export const purchaseAPI = {
  // Get all purchases
  getAll: () => api.get("/purchases"),

  // Create purchase
  create: (data) => api.post("/purchases", data),

  // Update purchase
  update: (id, data) => api.put(`/purchases/${id}`, data),

  // Delete purchase
  delete: (id) => api.delete(`/purchases/${id}`),
};

// ============================================================================
// SEARCH API
// ============================================================================

export const searchAPI = {
  // Global search
  search: (query) => api.get("/search", { params: { q: query } }),
};

// ============================================================================
// USER API
// ============================================================================
// SUPPLIERS API
// ============================================================================

export const suppliersAPI = {
  // Get all suppliers
  getAll: () => api.get("/suppliers"),

  // Create supplier
  create: (data) => api.post("/suppliers", data),

  // Delete supplier
  delete: (id) => api.delete(`/suppliers/${id}`),
};

// ============================================================================
// USER API
// ============================================================================

export const userAPI = {
  // Get profile
  getProfile: () => api.get("/profile"),

  // Update profile
  updateProfile: (data) => api.put("/profile", data),
};

// ============================================================================
// DASHBOARD API
// ============================================================================

export const dashboardAPI = {
  // Get dashboard stats
  getStats: () => api.get("/dashboard/stats"),
};

// ============================================================================
// NOTIFICATIONS API
// ============================================================================

export const notificationsAPI = {
  // Get all notifications
  getAll: () => api.get("/notifications", { withCredentials: true }),

  // Mark notification as read
  markAsRead: (id) => api.put(`/notifications/${id}/read`, undefined, { withCredentials: true }),

  // Mark all notifications as read
  markAllAsRead: () => api.put("/notifications/read-all", undefined, { withCredentials: true }),
};

export default api;
