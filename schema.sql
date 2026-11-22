-- Madras Beef Belly Database Schema
-- PostgreSQL 12+
-- All features for v1.0 + v1.1 + v2.0

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- ============================================================================
-- USERS TABLE (v1.1 - Multi-user support)
-- ============================================================================
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  phone VARCHAR(20),
  role VARCHAR(50) NOT NULL DEFAULT 'user',
  business_id UUID,
  is_active BOOLEAN DEFAULT true,
  last_login TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_business_id ON users(business_id);

-- ============================================================================
-- BUSINESSES TABLE (Multi-location support)
-- ============================================================================
CREATE TABLE businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  tagline VARCHAR(500),
  email VARCHAR(255),
  phone VARCHAR(20),
  address TEXT,
  city VARCHAR(100),
  country VARCHAR(100),
  currency VARCHAR(3) DEFAULT 'INR',
  logo_url VARCHAR(500),
  owner_id UUID REFERENCES users(id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_businesses_owner_id ON businesses(owner_id);
ALTER TABLE users ADD CONSTRAINT fk_users_business_id 
  FOREIGN KEY (business_id) REFERENCES businesses(id);

-- ============================================================================
-- CLIENTS TABLE (Customer information)
-- ============================================================================
CREATE TABLE clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  client_type VARCHAR(50) NOT NULL,
  address TEXT,
  city VARCHAR(100),
  preferred_cuisine VARCHAR(100),
  total_spent DECIMAL(12, 2) DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_clients_business_id ON clients(business_id);
CREATE INDEX idx_clients_client_type ON clients(client_type);

-- ============================================================================
-- SUPPLIERS TABLE (Vendor information)
-- ============================================================================
CREATE TABLE suppliers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  address TEXT,
  city VARCHAR(100),
  payment_terms VARCHAR(100),
  bank_details JSONB,
  contact_person VARCHAR(255),
  is_active BOOLEAN DEFAULT true,
  total_purchases DECIMAL(12, 2) DEFAULT 0,
  average_delivery_days INT,
  rating DECIMAL(3, 1),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_suppliers_business_id ON suppliers(business_id);
CREATE INDEX idx_suppliers_name ON suppliers(name);

-- ============================================================================
-- MENU_ITEMS TABLE (Dishes and recipes)
-- ============================================================================
CREATE TABLE menu_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  category VARCHAR(100) NOT NULL,
  cost_per_serving DECIMAL(10, 2),
  selling_price DECIMAL(10, 2),
  margin_percent DECIMAL(5, 2),
  ingredients JSONB,
  allergens JSONB,
  is_available BOOLEAN DEFAULT true,
  is_vegetarian BOOLEAN DEFAULT false,
  prep_time_minutes INT,
  image_url VARCHAR(500),
  seasonal BOOLEAN DEFAULT false,
  season VARCHAR(50),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE INDEX idx_menu_items_business_id ON menu_items(business_id);
CREATE INDEX idx_menu_items_category ON menu_items(category);
CREATE INDEX idx_menu_items_is_available ON menu_items(is_available);

-- ============================================================================
-- INVENTORY_ITEMS TABLE (Stock and ingredients)
-- ============================================================================
CREATE TABLE inventory_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  category VARCHAR(100),
  unit VARCHAR(50) NOT NULL,
  current_stock DECIMAL(12, 4) NOT NULL,
  minimum_stock DECIMAL(10, 2),
  maximum_stock DECIMAL(10, 2),
  cost_per_unit DECIMAL(10, 2) NOT NULL,
  selling_price DECIMAL(10, 2),
  supplier_id UUID REFERENCES suppliers(id),
  supplier_name VARCHAR(255),
  barcode VARCHAR(100),
  expiry_date DATE,
  storage_location VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  reorder_quantity INT,
  reorder_point DECIMAL(10, 2),
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_updated_by UUID REFERENCES users(id)
);

CREATE INDEX idx_inventory_items_business_id ON inventory_items(business_id);
CREATE INDEX idx_inventory_items_supplier_id ON inventory_items(supplier_id);
CREATE INDEX idx_inventory_items_stock_check ON inventory_items(current_stock, minimum_stock);
CREATE INDEX idx_inventory_items_expiry_date ON inventory_items(expiry_date);

CREATE TABLE catalog_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id UUID UNIQUE REFERENCES menu_items(id) ON DELETE CASCADE,
  inventory_item_id UUID UNIQUE REFERENCES inventory_items(id) ON DELETE CASCADE,
  jpeg BYTEA NOT NULL CHECK (octet_length(jpeg) BETWEEN 4 AND 256000),
  CHECK (num_nonnulls(menu_item_id, inventory_item_id) = 1)
);

ALTER TABLE catalog_photos ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- MENU_ITEM_INGREDIENTS TABLE (Ingredient mapping)
-- ============================================================================
CREATE TABLE menu_item_ingredients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id UUID NOT NULL REFERENCES menu_items(id) ON DELETE CASCADE,
  inventory_item_id UUID REFERENCES inventory_items(id),
  ingredient_name VARCHAR(255) NOT NULL,
  quantity_required DECIMAL(10, 2) NOT NULL,
  unit VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_menu_item_ingredients_menu_item_id ON menu_item_ingredients(menu_item_id);
CREATE INDEX idx_menu_item_ingredients_inventory_item_id ON menu_item_ingredients(inventory_item_id);

CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  order_number VARCHAR(50) UNIQUE,
  order_ref VARCHAR(50) UNIQUE,
  client_name VARCHAR(255),
  customer_name VARCHAR(255),
  table_no VARCHAR(50),
  payment_method VARCHAR(50),
  total_value NUMERIC(12, 2),
  total_amount NUMERIC(12, 2),
  status VARCHAR(50) DEFAULT 'New',
  inventory_deducted BOOLEAN NOT NULL DEFAULT FALSE,
  inventory_deducted_at TIMESTAMP,
  cancellation_reason TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE order_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES menu_items(id) ON DELETE SET NULL,
  item_name VARCHAR(255),
  name VARCHAR(255),
  category VARCHAR(100),
  quantity INTEGER NOT NULL CHECK (quantity > 0),
  unit_price NUMERIC(10, 2),
  total_price NUMERIC(12, 2),
  line_total NUMERIC(12, 2),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_order_items_order_id ON order_items(order_id);

CREATE TABLE order_ingredient_consumptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id UUID NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  order_item_id UUID REFERENCES order_items(id) ON DELETE CASCADE,
  menu_item_id UUID REFERENCES menu_items(id) ON DELETE SET NULL,
  inventory_item_id UUID NOT NULL REFERENCES inventory_items(id),
  ingredient_name VARCHAR(255) NOT NULL,
  quantity_deducted NUMERIC(12, 4) NOT NULL,
  unit VARCHAR(50) NOT NULL,
  cost_at_deduction NUMERIC(12, 4),
  cost_unit VARCHAR(50),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_order_ingredient_consumptions_order_id ON order_ingredient_consumptions(order_id);

-- ============================================================================
-- PURCHASES TABLE (Purchase orders)
-- ============================================================================
CREATE TABLE purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  purchase_order_number VARCHAR(50) UNIQUE NOT NULL,
  supplier_id UUID NOT NULL REFERENCES suppliers(id),
  supplier_name VARCHAR(255),
  purchase_date DATE NOT NULL,
  expected_delivery_date DATE,
  actual_delivery_date DATE,
  total_amount DECIMAL(12, 2) NOT NULL,
  tax_amount DECIMAL(10, 2) DEFAULT 0,
  discount DECIMAL(10, 2) DEFAULT 0,
  final_amount DECIMAL(12, 2) NOT NULL,
  payment_status VARCHAR(50) DEFAULT 'Pending',
  amount_paid DECIMAL(12, 2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'Ordered',
  notes TEXT,
  created_by UUID REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  paid_at TIMESTAMP
);

CREATE INDEX idx_purchases_business_id ON purchases(business_id);
CREATE INDEX idx_purchases_supplier_id ON purchases(supplier_id);
CREATE INDEX idx_purchases_status ON purchases(status);
CREATE INDEX idx_purchases_purchase_date ON purchases(purchase_date);

-- ============================================================================
-- PURCHASE_ITEMS TABLE (Items per purchase)
-- ============================================================================
CREATE TABLE purchase_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  purchase_id UUID NOT NULL REFERENCES purchases(id) ON DELETE CASCADE,
  inventory_item_id UUID REFERENCES inventory_items(id),
  ingredient_name VARCHAR(255) NOT NULL,
  quantity DECIMAL(10, 2) NOT NULL,
  unit VARCHAR(50) NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL,
  total_price DECIMAL(12, 2) NOT NULL,
  quantity_received DECIMAL(10, 2),
  received_at TIMESTAMP,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_purchase_items_purchase_id ON purchase_items(purchase_id);
CREATE INDEX idx_purchase_items_inventory_item_id ON purchase_items(inventory_item_id);

-- ============================================================================
-- ROLES TABLE (v2.1 - Role-based access control)
-- ============================================================================
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_system_role BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(business_id, name)
);

CREATE INDEX idx_roles_business_id ON roles(business_id);

-- ============================================================================
-- STAFF TABLE (v2.1 - Team members)
-- ============================================================================
CREATE TABLE staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  name VARCHAR(255) NOT NULL,
  email VARCHAR(255),
  phone VARCHAR(20),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  position VARCHAR(100),
  salary DECIMAL(12, 2),
  hire_date DATE,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP
);

CREATE INDEX idx_staff_business_id ON staff(business_id);
CREATE INDEX idx_staff_role_id ON staff(role_id);
CREATE INDEX idx_staff_user_id ON staff(user_id);
CREATE INDEX idx_staff_is_active ON staff(is_active);

-- ============================================================================
-- ROLE_PERMISSIONS TABLE (v2.1 - Permission mapping)
-- ============================================================================
CREATE TABLE role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(role_id, permission)
);

CREATE INDEX idx_role_permissions_role_id ON role_permissions(role_id);
CREATE INDEX idx_role_permissions_permission ON role_permissions(permission);

-- ============================================================================
-- Update users table to include role_id
-- ============================================================================
ALTER TABLE users ADD COLUMN role_id UUID REFERENCES roles(id) ON DELETE SET NULL;
CREATE INDEX idx_users_role_id ON users(role_id);

-- ============================================================================
-- NOTIFICATIONS TABLE (v1.1 - Alert system)
-- ============================================================================
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(100) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  reference_id VARCHAR(100),
  reference_type VARCHAR(50),
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_notifications_business_id ON notifications(business_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_type ON notifications(type);

-- ============================================================================
-- AUDIT_LOGS TABLE (v1.1 - Compliance & debugging)
-- ============================================================================
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100),
  entity_id VARCHAR(100),
  old_values JSONB,
  new_values JSONB,
  ip_address VARCHAR(50),
  user_agent VARCHAR(500),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_audit_logs_business_id ON audit_logs(business_id);
CREATE INDEX idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX idx_audit_logs_entity_type ON audit_logs(entity_type);
CREATE INDEX idx_audit_logs_created_at ON audit_logs(created_at);

-- ============================================================================
-- FUNCTIONS FOR CALCULATIONS
-- ============================================================================

-- Auto-calculate margin percent for menu items
CREATE OR REPLACE FUNCTION calculate_margin_percent()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.selling_price > 0 THEN
    NEW.margin_percent := ROUND(((NEW.selling_price - NEW.cost_per_serving) / NEW.selling_price * 100)::numeric, 2);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_margin_percent
BEFORE INSERT OR UPDATE ON menu_items
FOR EACH ROW
EXECUTE FUNCTION calculate_margin_percent();

-- Update purchase final amount
CREATE OR REPLACE FUNCTION update_purchase_final_amount()
RETURNS TRIGGER AS $$
BEGIN
  NEW.final_amount := NEW.total_amount + NEW.tax_amount - NEW.discount;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_purchase_final_amount
BEFORE INSERT OR UPDATE ON purchases
FOR EACH ROW
EXECUTE FUNCTION update_purchase_final_amount();

-- ============================================================================
-- SEED DATA (Optional - for testing)
-- ============================================================================

-- Insert sample business
INSERT INTO businesses (id, name, tagline, email, phone, city, country) VALUES
('550e8400-e29b-41d4-a716-446655440000', 'Madras Beef Belly', 'Taste · Tradition · Madras Style', NULL, NULL, NULL, NULL);

-- Insert test users
-- Passwords: admin123, manager123, user123, staff123
INSERT INTO users (id, email, password_hash, first_name, last_name, phone, role, business_id, is_active) VALUES
('150e8400-e29b-41d4-a716-446655440000', 'admin@restaurant.com', '$2a$10$EY/QzQ0MBtDkO8.6tJ0NKOl0wc5aNMoUQY5PdHUy0O14UDGJ3nGmS', 'Admin', 'User', '0300-1000000', 'admin', '550e8400-e29b-41d4-a716-446655440000', true),
('250e8400-e29b-41d4-a716-446655440000', 'manager@restaurant.com', '$2a$10$IvRzr.bYSHIhtfpqzygq.egMkAMA0xY9IAF7J9CuQ9FJNkfwxxSX6', 'Manager', 'User', '0300-1000001', 'user', '550e8400-e29b-41d4-a716-446655440000', true),
('350e8400-e29b-41d4-a716-446655440000', 'user@restaurant.com', '$2a$10$l34mIvYD5XSwPZfJKd2nDO8s3mryUHRA466pKnm.TuAMuKXUveO2K', 'John', 'Doe', '0300-1000002', 'user', '550e8400-e29b-41d4-a716-446655440000', true),
('450e8400-e29b-41d4-a716-446655440000', 'staff@restaurant.com', '$2a$10$qEtp5ekZAkyU98t.5wrnvunvmV.QlSFaLHm2/hNOgHPqLS9TT9SKS', 'Jane', 'Smith', '0300-1000003', 'user', '550e8400-e29b-41d4-a716-446655440000', true);

-- Insert roles for business
INSERT INTO roles (id, business_id, name, description, is_system_role) VALUES
('560e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440000', 'Super Admin', 'Full system access and business configuration', true),
('560e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440000', 'Manager', 'Can manage menu and inventory', true),
('560e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440000', 'Staff', 'Can view and update menu and inventory', true),
('560e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440000', 'Viewer', 'Read-only access to reports and analytics', true);

-- Insert permissions for Super Admin role
INSERT INTO role_permissions (role_id, permission) VALUES
('560e8400-e29b-41d4-a716-446655440001', 'manage_staff'),
('560e8400-e29b-41d4-a716-446655440001', 'manage_roles'),
('560e8400-e29b-41d4-a716-446655440001', 'manage_menu'),
('560e8400-e29b-41d4-a716-446655440001', 'manage_inventory'),
('560e8400-e29b-41d4-a716-446655440001', 'manage_purchases'),
('560e8400-e29b-41d4-a716-446655440001', 'view_reports'),
('560e8400-e29b-41d4-a716-446655440001', 'manage_settings'),
('560e8400-e29b-41d4-a716-446655440001', 'manage_clients'),
('560e8400-e29b-41d4-a716-446655440001', 'manage_suppliers');

-- Insert permissions for Manager role
INSERT INTO role_permissions (role_id, permission) VALUES
('560e8400-e29b-41d4-a716-446655440002', 'manage_menu'),
('560e8400-e29b-41d4-a716-446655440002', 'manage_inventory'),
('560e8400-e29b-41d4-a716-446655440002', 'manage_purchases'),
('560e8400-e29b-41d4-a716-446655440002', 'view_reports'),
('560e8400-e29b-41d4-a716-446655440002', 'manage_clients'),
('560e8400-e29b-41d4-a716-446655440002', 'manage_suppliers');

-- Insert permissions for Staff role
INSERT INTO role_permissions (role_id, permission) VALUES
('560e8400-e29b-41d4-a716-446655440003', 'manage_menu'),
('560e8400-e29b-41d4-a716-446655440003', 'manage_inventory'),
('560e8400-e29b-41d4-a716-446655440003', 'view_reports');

-- Insert permissions for Viewer role
INSERT INTO role_permissions (role_id, permission) VALUES
('560e8400-e29b-41d4-a716-446655440004', 'view_reports');

-- Insert sample suppliers
INSERT INTO suppliers (id, business_id, name, email, phone, contact_person, is_active) VALUES
('650e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440000', 'Grain Masters', 'info@grainmasters.pk', '021-1234567', 'Ahmed Khan', true),
('650e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440000', 'Fresh Farms', 'contact@freshfarms.pk', '021-2345678', 'Fatima Ahmed', true),
('650e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440000', 'Oil Corp', 'sales@oilcorp.pk', '021-3456789', 'Hassan Ali', true);

-- Insert sample inventory items
INSERT INTO inventory_items (id, business_id, name, unit, current_stock, minimum_stock, cost_per_unit, supplier_id, supplier_name) VALUES
('750e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440000', 'Basmati Rice', 'kg', 150, 50, 280, '650e8400-e29b-41d4-a716-446655440001', 'Grain Masters'),
('750e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440000', 'Chicken', 'kg', 45, 30, 520, '650e8400-e29b-41d4-a716-446655440002', 'Fresh Farms'),
('750e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440000', 'Cooking Oil', 'liter', 25, 20, 450, '650e8400-e29b-41d4-a716-446655440003', 'Oil Corp');

-- Insert sample clients
INSERT INTO clients (id, business_id, name, email, phone, client_type) VALUES
('950e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440000', 'Ahmed & Fatima', 'ahmed.fatima@email.com', '0300-1234567', 'Wedding'),
('950e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440000', 'Tech Solutions Pvt Ltd', 'hr@techsolutions.pk', '021-5678901', 'Corporate'),
('950e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440000', 'Malik Family', 'malik.family@email.com', '0321-9876543', 'Family');

-- ============================================================================
-- GRANTS (Security)
-- ============================================================================
-- Revoke all privileges
REVOKE ALL PRIVILEGES ON ALL TABLES IN SCHEMA public FROM PUBLIC;

-- Grant specific privileges to application user (create this user separately)
-- ALTER ROLE rim_user SET search_path TO public;

-- ============================================================================
-- END OF SCHEMA
-- ============================================================================

-- WhatsApp settings and alert queue
CREATE TABLE IF NOT EXISTS whatsapp_settings (
  id integer PRIMARY KEY DEFAULT 1,
  target_phone varchar(50) DEFAULT '',
  target_group_id varchar(100) DEFAULT '',
  alert_low_stock boolean DEFAULT true,
  alert_new_orders boolean DEFAULT true,
  updated_at timestamp DEFAULT CURRENT_TIMESTAMP,
  bot_status text DEFAULT 'disconnected',
  qr_code text,
  bot_phone text,
  last_error text,
  command text DEFAULT 'idle'
);
INSERT INTO whatsapp_settings (id) VALUES (1) ON CONFLICT (id) DO NOTHING;
ALTER TABLE whatsapp_settings
  ADD COLUMN IF NOT EXISTS worker_id uuid,
  ADD COLUMN IF NOT EXISTS worker_seen_at timestamptz,
  ADD COLUMN IF NOT EXISTS qr_expires_at timestamptz;
ALTER TABLE whatsapp_settings ENABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS whatsapp_outbox (
  id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  event_key text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('order', 'low_stock', 'test')),
  target text NOT NULL,
  message text NOT NULL,
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  failed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (event_key, target)
);
CREATE INDEX IF NOT EXISTS whatsapp_outbox_pending ON whatsapp_outbox (next_attempt_at, id)
  WHERE sent_at IS NULL AND failed_at IS NULL;
ALTER TABLE whatsapp_outbox ENABLE ROW LEVEL SECURITY;
