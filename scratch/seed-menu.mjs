/**
 * Seed Supabase with all menu items from the Madras Beef Belly poster
 * Run: node scratch/seed-menu.mjs
 */

import pg from 'pg';
const { Pool } = pg;

// Try the exact connection string from .env (last line wins)
const pool = new Pool({
  connectionString:
    'postgresql://postgres.huatcupjqyeovqsorfhf:madrasbeefbelly@aws-1-ap-south-1.pooler.supabase.com:6543/postgres',
  ssl: { rejectUnauthorized: false },
});

const MENU_ITEMS = [
  // ── STARTERS ──
  { name: 'Tawa Beef',        category: 'Starters' },
  { name: 'Pepper Beef',      category: 'Starters' },
  { name: 'Chilli Beef',      category: 'Starters' },
  { name: 'Garlic Beef',      category: 'Starters' },
  { name: 'Ginger Beef',      category: 'Starters' },
  { name: 'Beef Pepper Fry',  category: 'Starters' },
  { name: 'Dragon Beef',      category: 'Starters' },
  { name: 'Beef Fry',         category: 'Starters' },

  // ── GRAVY ──
  { name: 'Chilli Beef Gravy',       category: 'Gravy' },
  { name: 'Pepper Beef Gravy',       category: 'Gravy' },
  { name: 'Green Chilli Beef Gravy', category: 'Gravy' },

  // ── RICE ──
  { name: 'Khushka',                       category: 'Rice' },
  { name: 'Khushka with Egg',              category: 'Rice' },
  { name: 'Beef Thooku Biryani Half Plate', category: 'Rice' },
  { name: 'Beef Thooku Biryani Full Plate', category: 'Rice' },
  { name: 'Beef Fried Rice',               category: 'Rice' },

  // ── SNACKS ──
  { name: 'Beef Pakoda', category: 'Snacks' },

  // ── NOODLES ──
  { name: 'Beef Noodles',          category: 'Noodles' },
  { name: 'Schezwan Beef Noodles', category: 'Noodles' },

  // ── SHAWARMA ──
  { name: 'Shawarma',       category: 'Shawarma' },
  { name: 'Plate Shawarma', category: 'Shawarma' },
];

async function run() {
  const client = await pool.connect();
  try {
    // Get the business id
    const bizResult = await client.query('SELECT id FROM businesses LIMIT 1');
    if (bizResult.rows.length === 0) {
      console.error('❌ No business found in the database!');
      return;
    }
    const businessId = bizResult.rows[0].id;
    console.log(`✅ Business ID: ${businessId}`);

    let inserted = 0;
    let skipped = 0;

    for (const item of MENU_ITEMS) {
      // Skip if a dish with that name already exists for this business
      const exists = await client.query(
        `SELECT id FROM menu_items WHERE business_id = $1 AND name = $2 AND deleted_at IS NULL`,
        [businessId, item.name],
      );
      if (exists.rows.length > 0) {
        console.log(`  ⏭  Skipped (already exists): ${item.name}`);
        skipped++;
        continue;
      }

      await client.query(
        `INSERT INTO menu_items
           (business_id, name, category, is_available, is_vegetarian)
         VALUES ($1, $2, $3, true, false)`,
        [businessId, item.name, item.category],
      );
      console.log(`  ✅ Inserted: ${item.name}  [${item.category}]`);
      inserted++;
    }

    console.log(`\n🎉 Done — ${inserted} inserted, ${skipped} skipped.`);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
