BEGIN;

CREATE TABLE IF NOT EXISTS catalog_photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  menu_item_id UUID UNIQUE REFERENCES menu_items(id) ON DELETE CASCADE,
  inventory_item_id UUID UNIQUE REFERENCES inventory_items(id) ON DELETE CASCADE,
  jpeg BYTEA NOT NULL CHECK (octet_length(jpeg) BETWEEN 4 AND 256000),
  CHECK (num_nonnulls(menu_item_id, inventory_item_id) = 1)
);

ALTER TABLE catalog_photos ENABLE ROW LEVEL SECURITY;

COMMIT;
