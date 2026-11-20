BEGIN;

ALTER TABLE inventory_items
  ALTER COLUMN current_stock TYPE NUMERIC(12, 4);

ALTER TABLE IF EXISTS stock_movements
  ALTER COLUMN quantity_change TYPE NUMERIC(12, 4),
  ALTER COLUMN previous_stock TYPE NUMERIC(12, 4),
  ALTER COLUMN new_stock TYPE NUMERIC(12, 4);

COMMIT;
