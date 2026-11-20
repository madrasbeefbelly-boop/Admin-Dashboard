BEGIN;

ALTER TABLE order_ingredient_consumptions
  ADD COLUMN IF NOT EXISTS cost_unit VARCHAR(50);

-- Recover the original stock unit for orders recorded before it was captured on each consumption.
DO $$
BEGIN
  IF to_regclass('public.inventory_movements') IS NOT NULL THEN
    UPDATE order_ingredient_consumptions AS consumption
    SET cost_unit = legacy.unit
    FROM (
      SELECT order_id, inventory_item_id, MIN(unit) AS unit
      FROM inventory_movements
      WHERE movement_type = 'order_deduction'
      GROUP BY order_id, inventory_item_id
      HAVING COUNT(DISTINCT unit) = 1
    ) AS legacy
    WHERE consumption.order_id = legacy.order_id
      AND consumption.inventory_item_id = legacy.inventory_item_id
      AND consumption.cost_unit IS NULL;
  END IF;
END $$;

COMMIT;
