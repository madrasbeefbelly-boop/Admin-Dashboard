BEGIN;

ALTER TABLE menu_items
  ALTER COLUMN cost_per_serving DROP NOT NULL,
  ALTER COLUMN selling_price DROP NOT NULL;

ALTER TABLE businesses ALTER COLUMN currency SET DEFAULT 'INR';

UPDATE businesses
SET name = 'Madras Beef Belly',
    tagline = 'Taste · Tradition · Madras Style',
    email = NULLIF(email, 'hello@mommyskitchen.pk'),
    phone = NULLIF(phone, '0332-5172782'),
    city = NULLIF(city, 'Karachi'),
    country = NULLIF(country, 'Pakistan'),
    currency = 'INR'
WHERE id = '550e8400-e29b-41d4-a716-446655440000'
  AND name = 'Mommy''s Kitchen';

UPDATE menu_items
SET deleted_at = CURRENT_TIMESTAMP
WHERE business_id = '550e8400-e29b-41d4-a716-446655440000'
  AND deleted_at IS NULL
  AND (id, name, cost_per_serving, selling_price) IN (
    ('850e8400-e29b-41d4-a716-446655440001'::uuid, 'Chicken Biryani', 280, 550),
    ('850e8400-e29b-41d4-a716-446655440002'::uuid, 'Seekh Kebab', 200, 450),
    ('850e8400-e29b-41d4-a716-446655440003'::uuid, 'Mutton Korma', 420, 850)
  )
  AND NOT EXISTS (SELECT 1 FROM order_items WHERE menu_item_id = menu_items.id);

WITH poster_menu(category, name) AS (
  VALUES
    ('Starters', 'Tawa Beef'),
    ('Starters', 'Pepper Beef'),
    ('Starters', 'Chilli Beef'),
    ('Starters', 'Garlic Beef'),
    ('Starters', 'Ginger Beef'),
    ('Starters', 'Beef Pepper Fry'),
    ('Starters', 'Dragon Beef'),
    ('Starters', 'Beef Fry'),
    ('Gravy', 'Chilli Beef Gravy'),
    ('Gravy', 'Pepper Beef Gravy'),
    ('Gravy', 'Green Chilli Beef Gravy'),
    ('Rice', 'Khushka'),
    ('Rice', 'Khushka with Egg'),
    ('Rice', 'Beef Thooku Biryani Half Plate'),
    ('Rice', 'Beef Thooku Biryani Full Plate'),
    ('Rice', 'Beef Fried Rice'),
    ('Snacks', 'Beef Pakoda'),
    ('Noodles', 'Beef Noodles'),
    ('Noodles', 'Schezwan Beef Noodles'),
    ('Shawarma', 'Shawarma'),
    ('Shawarma', 'Plate Shawarma')
)
INSERT INTO menu_items (id, business_id, name, category)
SELECT md5(b.id::text || ':' || p.category || ':' || p.name)::uuid, b.id, p.name, p.category
FROM businesses b
CROSS JOIN poster_menu p
WHERE b.id = '550e8400-e29b-41d4-a716-446655440000'
  AND NOT EXISTS (
    SELECT 1 FROM menu_items existing
    WHERE existing.business_id = b.id
      AND lower(existing.name) = lower(p.name)
  )
ON CONFLICT (id) DO NOTHING;

COMMIT;
