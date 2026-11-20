/**
 * Madras Beef Belly - Backend Server
 * Express.js API Server
 * Connects React frontend to PostgreSQL database
 */

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFileSync } from 'node:fs';

// Load environment variables
const hosted = process.env.VERCEL === '1';
if (!hosted) dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const JWT_SECRET = process.env.JWT_SECRET;
const SESSION_SECRET = process.env.SESSION_SECRET || process.env.JWT_SECRET;
const FRONTEND_URL = process.env.FRONTEND_URL ||
  (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : 'http://localhost:8080');
const googleEnabled = !hosted && Boolean(
  process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_CALLBACK_URL
);

// Middleware - CORS configuration with allowlist
const allowedOrigins = process.env.CORS_ORIGINS 
  ? process.env.CORS_ORIGINS.split(',')
  : hosted ? [FRONTEND_URL] : ['http://localhost:8080', 'http://localhost:3000'];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['set-cookie']
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(cookieParser());

// Session middleware (required for Passport)
if (googleEnabled) {
  app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    }
  }));

  // Initialize Passport
  app.use(passport.initialize());
  app.use(passport.session());

  // Passport serialization
  passport.serializeUser((user, done) => {
    done(null, user.id);
  });

  passport.deserializeUser(async (id, done) => {
    try {
      const result = await pool.query('SELECT * FROM users WHERE id = $1', [id]);
      done(null, result.rows[0]);
    } catch (error) {
      done(error, null);
    }
  });

  // Google OAuth Strategy
  passport.use(new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Check if user exists
        const existingUser = await pool.query(
          'SELECT * FROM users WHERE email = $1',
          [profile.emails[0].value]
        );

        if (existingUser.rows.length > 0) {
          // User exists, return user
          return done(null, existingUser.rows[0]);
        }

        // Create new user
        const newUser = await pool.query(`
          INSERT INTO users (email, first_name, last_name, role, is_active, oauth_provider, oauth_id)
          VALUES ($1, $2, $3, 'user', true, 'google', $4)
          RETURNING *
        `, [
          profile.emails[0].value,
          profile.name.givenName,
          profile.name.familyName,
          profile.id
        ]);

        done(null, newUser.rows[0]);
      } catch (error) {
        done(error, null);
      }
    }
  ));
}

// Database connection
const databaseUrl = process.env.DATABASE_URL ? new URL(process.env.DATABASE_URL) : null;
const isSupabaseDatabase = databaseUrl && (
  databaseUrl.hostname.endsWith('.pooler.supabase.com') ||
  /^db\.[a-z0-9]+\.supabase\.co$/.test(databaseUrl.hostname)
);
if (isSupabaseDatabase) {
  for (const parameter of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert', 'ssl']) {
    databaseUrl.searchParams.delete(parameter);
  }
}
const pool = new Pool({
  connectionString: databaseUrl?.href,
  ...(isSupabaseDatabase && {
    ssl: {
      ca: readFileSync(new URL('./certificates/supabase-root-2021.crt', import.meta.url)),
      rejectUnauthorized: true,
    },
  }),
  ...(hosted && { max: 4, connectionTimeoutMillis: 5000 }),
});
pool.on('error', error => console.error('Idle database connection closed:', error.code ?? error.message));

// Test database connection
if (!hosted) pool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('❌ Database connection failed:', err);
  } else {
    console.log('✅ Database connected:', res.rows[0].now);
  }
});

// ============================================================================
// AUTHENTICATION MIDDLEWARE
// ============================================================================

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const token = req.cookies.token || req.headers['authorization']?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ success: false, error: 'Access denied. No token provided.' });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    res.status(403).json({ success: false, error: 'Invalid or expired token.' });
  }
};

// Middleware to check if user is admin
const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ success: false, error: 'Access denied. Admin privileges required.' });
  }
  next();
};

// ============================================================================
// AUTHENTICATION ENDPOINTS
// ============================================================================

// Register new user
app.post('/api/auth/register', async (req, res) => {
  if (hosted) {
    return res.status(403).json({ success: false, error: 'Ask the dashboard owner for an account.' });
  }
  const { email, password, firstName, lastName, phone } = req.body;

  try {
    // Check if user already exists
    const existingUser = await pool.query('SELECT id FROM users WHERE email = $1', [email]);

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ success: false, error: 'User with this email already exists' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Create user
    const result = await pool.query(`
      INSERT INTO users (email, password_hash, first_name, last_name, phone, role, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, true)
      RETURNING id, email, first_name, last_name, phone, role, created_at
    `, [email, passwordHash, firstName, lastName, phone, 'user']);

    const user = result.rows[0];

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.status(201).json({
      success: true,
      data: { user, token }
    });
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Login user
app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body ?? {};
  if (typeof email !== 'string' || typeof password !== 'string') {
    return res.status(400).json({ success: false, error: 'Email and password are required.' });
  }

  try {
    // Find user
    const result = await pool.query(`
      SELECT id, email, password_hash, first_name, last_name, phone, role, is_active
      FROM users
      WHERE email = $1 AND deleted_at IS NULL
        AND (NOT $2::boolean OR business_id IS NOT NULL)
    `, [email.trim(), hosted]);

    if (result.rows.length === 0) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    const user = result.rows[0];

    // Check if user is active
    if (!user.is_active) {
      return res.status(403).json({ success: false, error: 'Account is deactivated. Please contact administrator.' });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({ success: false, error: 'Invalid email or password' });
    }

    // Update last login
    await pool.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);

    // Generate JWT token
    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    // Set cookie
    res.cookie('token', token, {
      httpOnly: true,
      secure: hosted || process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    // Remove password from response
    delete user.password_hash;

    res.json({
      success: true,
      data: hosted ? { user } : { user, token }
    });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ success: false, error: 'Sign-in is temporarily unavailable.' });
  }
});

// Logout user
app.post('/api/auth/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ success: true, message: 'Logged out successfully' });
});

// Hosted business data is available only to active members of the dashboard.
if (hosted) {
  app.use('/api', authenticateToken, async (req, res, next) => {
    const { rows } = await pool.query(
      'SELECT role FROM users WHERE id = $1 AND is_active AND deleted_at IS NULL AND business_id IS NOT NULL',
      [req.user.id]
    );
    if (!rows.length) return res.status(403).json({ success: false, error: 'Account has no dashboard access.' });
    req.user.role = rows[0].role;
    next();
  });
}

// Get current user
app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, email, first_name, last_name, phone, role, is_active, created_at, last_login
      FROM users
      WHERE id = $1 AND deleted_at IS NULL
    `, [req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'User not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error fetching user:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Google OAuth routes
if (googleEnabled) {
  app.get('/api/auth/google',
    passport.authenticate('google', { scope: ['profile', 'email'] })
  );

  app.get('/api/auth/google/callback',
    passport.authenticate('google', { failureRedirect: `${FRONTEND_URL}/login` }),
    async (req, res) => {
      try {
        // Generate JWT token for the user
        const token = jwt.sign(
          { id: req.user.id, email: req.user.email, role: req.user.role },
          JWT_SECRET,
          { expiresIn: '7d' }
        );

        // Set cookie
        res.cookie('token', token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
        });

        // Redirect to frontend (token is already in HTTP-only cookie)
        // No sensitive data in URL
        res.redirect(`${FRONTEND_URL}/auth/callback`);
      } catch (error) {
        console.error('OAuth callback error:', error);
        res.redirect(`${FRONTEND_URL}/login?error=oauth_failed`);
      }
    }
  );
}

// ============================================================================
// UNIT CONVERSION UTILITIES
// ============================================================================

function normalizeUnit(u) {
  const s = String(u || '').trim().toLowerCase();
  if (['kg', 'kilogram', 'kilograms'].includes(s)) return 'kg';
  if (['g', 'gram', 'grams'].includes(s)) return 'g';
  if (['l', 'liter', 'liters', 'litre', 'litres'].includes(s)) return 'L';
  if (['ml', 'milliliter', 'milliliters'].includes(s)) return 'ml';
  if (['piece', 'pieces', 'pcs', 'pc'].includes(s)) return 'pieces';
  return s;
}

function convertQuantity(quantity, fromUnit, toUnit) {
  const from = normalizeUnit(fromUnit);
  const to = normalizeUnit(toUnit);
  if (from === to) return Number(quantity);

  // Weight
  if (from === 'kg' && to === 'g') return Number(quantity) * 1000;
  if (from === 'g' && to === 'kg') return Number(quantity) / 1000;

  // Volume
  if (from === 'L' && to === 'ml') return Number(quantity) * 1000;
  if (from === 'ml' && to === 'L') return Number(quantity) / 1000;

  throw new Error(`Incompatible measurement units: cannot convert from "${fromUnit}" to "${toUnit}".`);
}

// ============================================================================
// MENU ITEMS ENDPOINTS
// ============================================================================

// GET all menu items (with recipe ingredients & availability calculation)
app.get('/api/menu-items', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        id, name, description, category, cost_per_serving, 
        selling_price, margin_percent, is_available, 
        is_vegetarian, prep_time_minutes, image_url
      FROM menu_items
      WHERE deleted_at IS NULL
      ORDER BY category, name
    `);
    const items = result.rows;

    if (items.length > 0) {
      const ids = items.map(i => i.id);
      const ingredientsResult = await pool.query(`
        SELECT 
          mii.id, mii.menu_item_id, mii.inventory_item_id, mii.ingredient_name, 
          mii.quantity_required, mii.unit,
          ii.name as inventory_name, ii.current_stock, ii.unit as inventory_unit, 
          ii.cost_per_unit
        FROM menu_item_ingredients mii
        LEFT JOIN inventory_items ii ON mii.inventory_item_id = ii.id
        WHERE mii.menu_item_id = ANY($1::uuid[])
        ORDER BY mii.created_at ASC
      `, [ids]);

      const ingredientsByMenu = {};
      for (const ing of ingredientsResult.rows) {
        if (!ingredientsByMenu[ing.menu_item_id]) ingredientsByMenu[ing.menu_item_id] = [];
        ingredientsByMenu[ing.menu_item_id].push(ing);
      }

      for (const item of items) {
        item.ingredients = ingredientsByMenu[item.id] || [];

        // Calculate how many servings can be prepared based on inventory stock
        if (item.ingredients.length > 0) {
          let minServings = Infinity;
          for (const ing of item.ingredients) {
            if (!ing.inventory_item_id || ing.current_stock == null) {
              minServings = 0;
              break;
            }
            try {
              const stockInRecipeUnit = convertQuantity(Number(ing.current_stock), ing.inventory_unit, ing.unit);
              const servings = Math.floor(Number((stockInRecipeUnit / Number(ing.quantity_required)).toFixed(4)));
              if (servings < minServings) minServings = servings;
            } catch {
              minServings = 0;
            }
          }
          item.servings_available = minServings === Infinity ? 0 : Math.max(0, minServings);
          item.is_in_stock = item.servings_available > 0;
        } else {
          item.servings_available = null; // No recipe specified
          item.is_in_stock = item.is_available !== false;
        }
      }
    }

    res.json({ success: true, data: items });
  } catch (error) {
    console.error('Error fetching menu items:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET single menu item
app.get('/api/menu-items/:id', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM menu_items WHERE id = $1 AND deleted_at IS NULL
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Menu item not found' });
    }

    // Get ingredients for this menu item
    const ingredients = await pool.query(`
      SELECT mii.*, ii.current_stock, ii.unit 
      FROM menu_item_ingredients mii
      LEFT JOIN inventory_items ii ON mii.inventory_item_id = ii.id
      WHERE mii.menu_item_id = $1
    `, [req.params.id]);

    res.json({ 
      success: true, 
      data: {
        ...result.rows[0],
        ingredients: ingredients.rows
      }
    });
  } catch (error) {
    console.error('Error fetching menu item:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// CREATE menu item
const calculateMenuMargin = (cost, price) =>
  cost != null && Number(price) > 0 ? ((price - cost) / price * 100) : null;

app.post('/api/menu-items', async (req, res) => {
  const { 
    name, description, category, cost_per_serving, 
    selling_price, is_vegetarian, prep_time_minutes, 
    image_url, ingredients 
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const businessResult = await client.query('SELECT id FROM businesses LIMIT 1');
    const businessId = businessResult.rows[0]?.id;

    if (!businessId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: 'No business found' });
    }

    // Insert menu item
    const itemResult = await client.query(`
      INSERT INTO menu_items 
      (business_id, name, description, category, cost_per_serving, selling_price, 
       margin_percent, is_vegetarian, prep_time_minutes, image_url, is_available)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, true)
      RETURNING *
    `, [
      businessId, name, description, category, cost_per_serving, selling_price,
      calculateMenuMargin(cost_per_serving, selling_price),
      is_vegetarian, prep_time_minutes, image_url
    ]);

    const itemId = itemResult.rows[0].id;

    // Insert ingredients (preventing duplicate inventory items)
    if (Array.isArray(ingredients) && ingredients.length > 0) {
      const seenInvIds = new Set();
      for (const ingredient of ingredients) {
        if (!ingredient.inventory_item_id || seenInvIds.has(ingredient.inventory_item_id)) continue;
        seenInvIds.add(ingredient.inventory_item_id);

        let ingName = ingredient.ingredient_name || ingredient.name;
        if (!ingName && ingredient.inventory_item_id) {
          const invQuery = await client.query('SELECT name FROM inventory_items WHERE id = $1', [ingredient.inventory_item_id]);
          ingName = invQuery.rows[0]?.name || 'Ingredient';
        }
        const qtyRequired = Number(ingredient.quantity_required ?? ingredient.quantity) || 0;

        await client.query(`
          INSERT INTO menu_item_ingredients 
          (menu_item_id, inventory_item_id, ingredient_name, quantity_required, unit)
          VALUES ($1, $2, $3, $4, $5)
        `, [
          itemId, 
          ingredient.inventory_item_id, 
          ingName, 
          qtyRequired, 
          ingredient.unit
        ]);
      }
    }

    await client.query('COMMIT');

    res.status(201).json({ 
      success: true, 
      message: 'Menu item created successfully',
      data: itemResult.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating menu item:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

// UPDATE menu item (including recipe ingredients)
app.put('/api/menu-items/:id', async (req, res) => {
  const { 
    name, description, category, cost_per_serving, 
    selling_price, is_vegetarian, prep_time_minutes, 
    is_available, ingredients 
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const result = await client.query(`
      UPDATE menu_items 
      SET name = $1, description = $2, category = $3, 
          cost_per_serving = $4, selling_price = $5,
          margin_percent = $6, is_vegetarian = $7, prep_time_minutes = $8,
          is_available = COALESCE($9, is_available),
          updated_at = NOW()
      WHERE id = $10 AND deleted_at IS NULL
      RETURNING *
    `, [
      name, description, category, cost_per_serving, selling_price,
      calculateMenuMargin(cost_per_serving, selling_price),
      is_vegetarian, prep_time_minutes, is_available, req.params.id
    ]);

    if (result.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Menu item not found' });
    }

    // Update ingredients if provided
    if (Array.isArray(ingredients)) {
      await client.query(`
        DELETE FROM menu_item_ingredients WHERE menu_item_id = $1
      `, [req.params.id]);

      const seenInvIds = new Set();
      for (const ingredient of ingredients) {
        if (!ingredient.inventory_item_id || seenInvIds.has(ingredient.inventory_item_id)) continue;
        seenInvIds.add(ingredient.inventory_item_id);

        let ingName = ingredient.ingredient_name || ingredient.name;
        if (!ingName && ingredient.inventory_item_id) {
          const invQuery = await client.query('SELECT name FROM inventory_items WHERE id = $1', [ingredient.inventory_item_id]);
          ingName = invQuery.rows[0]?.name || 'Ingredient';
        }
        const qtyRequired = Number(ingredient.quantity_required ?? ingredient.quantity) || 0;

        await client.query(`
          INSERT INTO menu_item_ingredients 
          (menu_item_id, inventory_item_id, ingredient_name, quantity_required, unit)
          VALUES ($1, $2, $3, $4, $5)
        `, [
          req.params.id, 
          ingredient.inventory_item_id, 
          ingName, 
          qtyRequired, 
          ingredient.unit
        ]);
      }
    }

    await client.query('COMMIT');

    res.json({ 
      success: true, 
      message: 'Menu item updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating menu item:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

// DELETE menu item (soft delete)
app.delete('/api/menu-items/:id', async (req, res) => {
  try {
    const result = await pool.query(`
      UPDATE menu_items 
      SET deleted_at = NOW()
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING *
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Menu item not found' });
    }

    res.json({ success: true, message: 'Menu item deleted successfully' });
  } catch (error) {
    console.error('Error deleting menu item:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// INVENTORY ITEMS ENDPOINTS
// ============================================================================

// GET all inventory items
app.get('/api/inventory', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        i.id, i.name, i.category, i.unit, i.current_stock, i.minimum_stock,
        i.cost_per_unit, i.supplier_id, COALESCE(s.name, i.supplier_name) AS supplier_name,
        i.expiry_date, i.is_active
      FROM inventory_items i
      LEFT JOIN suppliers s ON s.id = i.supplier_id AND s.business_id = i.business_id
      WHERE i.is_active = true
      ORDER BY i.name
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching inventory:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET low stock items
app.get('/api/inventory/low-stock', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        id, name, category, unit, current_stock, minimum_stock,
        (minimum_stock - current_stock) as shortage, supplier_name
      FROM inventory_items
      WHERE is_active = true AND current_stock <= minimum_stock
      ORDER BY shortage DESC
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching low stock items:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// CREATE inventory item
app.post('/api/inventory', async (req, res) => {
  const { 
    name, category, unit, cost_per_unit, 
    current_stock, minimum_stock, supplier_id, supplier_name
  } = req.body ?? {};

  if (!name || cost_per_unit == null) {
    return res.status(400).json({ success: false, error: 'Name and cost per unit are required.' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const businessResult = await client.query('SELECT id FROM businesses LIMIT 1');
    const businessId = businessResult.rows[0]?.id;

    if (!businessId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, error: 'No business found' });
    }

    const initialStock = Number(current_stock) || 0;
    const minStock = Number(minimum_stock) || 0;
    const cost = Number(cost_per_unit) || 0;

    const result = await client.query(`
      INSERT INTO inventory_items
      (business_id, name, category, unit, current_stock, cost_per_unit, 
       supplier_id, supplier_name, minimum_stock, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, true)
      RETURNING *
    `, [
      businessId, name.trim(), category || 'General', unit || 'kg',
      initialStock, cost, supplier_id || null, supplier_name || null, minStock
    ]);

    const newItem = result.rows[0];

    // Log initial stock movement if quantity > 0
    if (initialStock > 0) {
      await client.query(`
        INSERT INTO inventory_movements (
          business_id, inventory_item_id, movement_type, 
          quantity, unit, previous_stock, new_stock, notes
        )
        VALUES ($1, $2, 'Initial Stock', $3, $4, 0, $3, 'Initial inventory registration')
      `, [businessId, newItem.id, initialStock, newItem.unit]);
    }

    await client.query('COMMIT');

    res.status(201).json({ 
      success: true, 
      message: 'Inventory item created successfully',
      data: newItem
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating inventory item:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

// UPDATE inventory item
app.put('/api/inventory/:id', async (req, res) => {
  const { name, category, unit, cost_per_unit, supplier_id, supplier_name, minimum_stock } = req.body;

  try {
    const result = await pool.query(`
      UPDATE inventory_items 
      SET name = $1, category = $2, unit = $3, cost_per_unit = $4,
          supplier_id = $5, supplier_name = $6, minimum_stock = $7,
          updated_at = NOW()
      WHERE id = $8 AND is_active = true
      RETURNING *
    `, [
      name, category, unit, cost_per_unit, 
      supplier_id || null, supplier_name || null, minimum_stock, req.params.id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Inventory item not found' });
    }

    res.json({ 
      success: true, 
      message: 'Inventory item updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating inventory item:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ADJUST / RESTOCK stock
app.post('/api/inventory/:id/adjust', async (req, res) => {
  const { quantity_change, movement_type, notes } = req.body;
  const change = Number(quantity_change);

  if (isNaN(change) || change === 0) {
    return res.status(400).json({ success: false, error: 'Valid non-zero quantity change is required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const current = await client.query(`
      SELECT * FROM inventory_items WHERE id = $1 FOR UPDATE
    `, [req.params.id]);

    if (current.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Inventory item not found' });
    }

    const item = current.rows[0];
    const previousStock = Number(item.current_stock);
    const newStock = previousStock + change;

    if (newStock < 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        success: false, 
        error: `Cannot reduce stock below zero. Current stock is ${previousStock} ${item.unit}.` 
      });
    }

    const updated = await client.query(`
      UPDATE inventory_items 
      SET current_stock = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [newStock, req.params.id]);

    const moveType = movement_type || (change > 0 ? 'Restock' : 'Adjustment');

    await client.query(`
      INSERT INTO inventory_movements (
        business_id, inventory_item_id, movement_type, 
        quantity, unit, previous_stock, new_stock, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [
      item.business_id, req.params.id, moveType,
      change, item.unit, previousStock, newStock, notes || `${moveType}: ${change > 0 ? '+' : ''}${change} ${item.unit}`
    ]);

    await client.query('COMMIT');

    res.json({ 
      success: true, 
      message: 'Stock adjusted successfully',
      data: updated.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error adjusting stock:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

// UPDATE stock (PUT compatibility)
app.put('/api/inventory/:id/stock', async (req, res) => {
  const { quantity, movement_type, reference_id, notes } = req.body;
  const change = Number(quantity);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const current = await client.query(`
      SELECT * FROM inventory_items WHERE id = $1 FOR UPDATE
    `, [req.params.id]);

    if (current.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Inventory item not found' });
    }

    const item = current.rows[0];
    const previousStock = Number(item.current_stock);
    const newStock = previousStock + change;

    if (newStock < 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ 
        success: false, 
        error: `Cannot reduce stock below zero. Current stock is ${previousStock} ${item.unit}.` 
      });
    }

    const result = await client.query(`
      UPDATE inventory_items 
      SET current_stock = $1, updated_at = NOW()
      WHERE id = $2
      RETURNING *
    `, [newStock, req.params.id]);

    const moveType = movement_type || (change > 0 ? 'Restock' : 'Adjustment');

    await client.query(`
      INSERT INTO inventory_movements (
        business_id, inventory_item_id, movement_type, 
        quantity, unit, previous_stock, new_stock, notes
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `, [item.business_id, req.params.id, moveType, change, item.unit, previousStock, newStock, notes || `Stock update: ${reference_id || ''}`]);

    await client.query('COMMIT');

    res.json({ 
      success: true, 
      message: 'Stock updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error updating stock:', error);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    client.release();
  }
});

// GET all inventory movements
app.get('/api/inventory/movements', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        im.id, im.inventory_item_id, im.order_id, im.movement_type, 
        im.quantity, im.unit, im.previous_stock, im.new_stock, im.notes, im.created_at,
        ii.name as ingredient_name, ii.category,
        COALESCE(o.order_ref, o.order_number) as order_ref
      FROM inventory_movements im
      JOIN inventory_items ii ON im.inventory_item_id = ii.id
      LEFT JOIN orders o ON im.order_id = o.id
      ORDER BY im.created_at DESC
      LIMIT 100
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching inventory movements:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE inventory item
app.delete('/api/inventory/:id', async (req, res) => {
  try {
    const result = await pool.query(`
      UPDATE inventory_items 
      SET is_active = false, updated_at = NOW()
      WHERE id = $1 AND is_active = true
      RETURNING *
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Inventory item not found' });
    }

    res.json({ 
      success: true, 
      message: 'Inventory item deleted successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error deleting inventory item:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// SUPPLIERS ENDPOINTS
// ============================================================================

// GET all suppliers for a business
app.get('/api/suppliers', async (req, res) => {
  try {
    // Get the business ID (for now, using the first/only business)
    const businessResult = await pool.query('SELECT id FROM businesses LIMIT 1');
    const businessId = businessResult.rows[0]?.id;

    if (!businessId) {
      return res.status(400).json({ success: false, error: 'No business found' });
    }

    const result = await pool.query(`
      SELECT id, name, email, phone, address, city, payment_terms, contact_person, is_active
      FROM suppliers
      WHERE business_id = $1 AND is_active = true
      ORDER BY name
    `, [businessId]);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// CREATE supplier
app.post('/api/suppliers', async (req, res) => {
  const { name, email, phone, address, city, payment_terms, contact_person } = req.body;

  try {
    // Get the business ID (for now, using the first/only business)
    const businessResult = await pool.query('SELECT id FROM businesses LIMIT 1');
    const businessId = businessResult.rows[0]?.id;

    if (!businessId) {
      return res.status(400).json({ success: false, error: 'No business found' });
    }

    const result = await pool.query(`
      INSERT INTO suppliers 
      (business_id, name, email, phone, address, city, payment_terms, contact_person, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
      RETURNING id, name, email, phone, address, city, payment_terms, contact_person
    `, [businessId, name, email, phone, address, city, payment_terms, contact_person]);

    res.status(201).json({ 
      success: true, 
      message: 'Supplier created successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating supplier:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE supplier
app.delete('/api/suppliers/:id', async (req, res) => {
  try {
    const result = await pool.query(`
      UPDATE suppliers 
      SET is_active = false, updated_at = NOW()
      WHERE id = $1 AND is_active = true
      RETURNING *
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Supplier not found' });
    }

    res.json({ 
      success: true, 
      message: 'Supplier deleted successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error deleting supplier:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// PURCHASES ENDPOINTS
// ============================================================================

// GET all purchases
app.get('/api/purchases', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        p.id, p.purchase_order_number, p.supplier_name, p.purchase_date, 
        p.total_amount, p.payment_status, p.status, p.created_at,
        pi.quantity, pi.unit, pi.unit_price, pi.ingredient_name
      FROM purchases p
      LEFT JOIN purchase_items pi ON p.id = pi.purchase_id
      ORDER BY p.purchase_date DESC
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching purchases:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// CREATE purchase
app.post('/api/purchases', async (req, res) => {
  const { supplier_id, supplier_name, purchase_date, items } = req.body;

  try {
    // Get the business ID (for now, using the first/only business)
    const businessResult = await pool.query('SELECT id FROM businesses LIMIT 1');
    const businessId = businessResult.rows[0]?.id;

    if (!businessId) {
      return res.status(400).json({ success: false, error: 'No business found' });
    }

    // Safely calculate totals with default empty array
    const itemsArray = items || [];
    const totalAmount = itemsArray.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);

    // Generate unique purchase order number using UUID suffix
    const purchaseOrderNumber = `PO-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;

    // Create purchase order
    const purchaseResult = await pool.query(`
      INSERT INTO purchases 
      (business_id, purchase_order_number, supplier_id, supplier_name, purchase_date, total_amount, final_amount, payment_status)
      VALUES ($1, $2, $3, $4, $5, $6, $7, 'Pending')
      RETURNING *
    `, [businessId, purchaseOrderNumber, supplier_id, supplier_name, purchase_date, totalAmount, totalAmount]);

    const purchaseId = purchaseResult.rows[0].id;

    // Add items to purchase
    if (itemsArray && itemsArray.length > 0) {
      for (const item of itemsArray) {
        // Auto-create inventory item if it doesn't exist
        let inventoryItemId = null;
        const existingInventory = await pool.query(`
          SELECT id FROM inventory_items 
          WHERE business_id = $1 AND name = $2 AND is_active = true
        `, [businessId, item.ingredient_name]);

        if (existingInventory.rows.length > 0) {
          inventoryItemId = existingInventory.rows[0].id;
        } else {
          // Create new inventory item
          const newInventory = await pool.query(`
            INSERT INTO inventory_items 
            (business_id, name, unit, cost_per_unit, current_stock, minimum_stock, supplier_id, supplier_name, is_active)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, true)
            RETURNING id
          `, [businessId, item.ingredient_name, item.unit, item.unit_price, item.quantity, 0, supplier_id, supplier_name]);
          inventoryItemId = newInventory.rows[0].id;
        }

        // Add purchase item
        await pool.query(`
          INSERT INTO purchase_items 
          (purchase_id, inventory_item_id, ingredient_name, quantity, unit, unit_price, total_price)
          VALUES ($1, $2, $3, $4, $5, $6, $7)
        `, [
          purchaseId, inventoryItemId, item.ingredient_name,
          item.quantity, item.unit, item.unit_price, item.quantity * item.unit_price
        ]);

        // Update inventory stock
        await pool.query(`
          UPDATE inventory_items 
          SET current_stock = current_stock + $1, updated_at = NOW()
          WHERE id = $2
        `, [item.quantity, inventoryItemId]);
      }
    }

    res.status(201).json({ 
      success: true, 
      message: 'Purchase order created successfully',
      data: purchaseResult.rows[0]
    });
  } catch (error) {
    console.error('Error creating purchase:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// UPDATE purchase
app.put('/api/purchases/:id', async (req, res) => {
  const { payment_status, status } = req.body;

  try {
    const result = await pool.query(`
      UPDATE purchases 
      SET payment_status = COALESCE($1, payment_status),
          status = COALESCE($2, status),
          updated_at = NOW()
      WHERE id = $3
      RETURNING *
    `, [payment_status, status, req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Purchase not found' });
    }

    res.json({ 
      success: true, 
      message: 'Purchase updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating purchase:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE purchase
app.delete('/api/purchases/:id', async (req, res) => {
  try {
    const result = await pool.query(`
      DELETE FROM purchases 
      WHERE id = $1
      RETURNING *
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Purchase not found' });
    }

    res.json({ 
      success: true, 
      message: 'Purchase deleted successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error deleting purchase:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// SEARCH ENDPOINT
// ============================================================================

// Global search
app.get('/api/search', async (req, res) => {
  const { q } = req.query;

  if (!q || q.length < 2) {
    return res.json({ success: true, data: { menuItems: [], inventory: [] } });
  }

  try {
    const searchTerm = `%${q}%`;

    const menuItems = await pool.query(`
      SELECT id, name, 'menu' as type FROM menu_items 
      WHERE name ILIKE $1 AND deleted_at IS NULL LIMIT 5
    `, [searchTerm]);

    const inventory = await pool.query(`
      SELECT id, name, 'inventory' as type FROM inventory_items 
      WHERE name ILIKE $1 AND is_active = true LIMIT 5
    `, [searchTerm]);

    res.json({ 
      success: true, 
      data: {
        menuItems: menuItems.rows,
        inventory: inventory.rows
      }
    });
  } catch (error) {
    console.error('Error searching:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// USER/PROFILE ENDPOINT
// ============================================================================

// GET user profile (demo)
app.get('/api/profile', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT id, name, tagline, email, phone, address, city FROM businesses LIMIT 1
    `);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Business not found' });
    }

    res.json({ 
      success: true, 
      data: {
        id: result.rows[0].id,
        name: result.rows[0].name,
        tagline: result.rows[0].tagline,
        email: result.rows[0].email,
        phone: result.rows[0].phone,
        address: result.rows[0].address,
        city: result.rows[0].city,
        role: 'Admin'
      }
    });
  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// UPDATE profile
app.put('/api/profile', async (req, res) => {
  const { name, tagline, email, phone, address, city } = req.body;

  try {
    const result = await pool.query(`
      UPDATE businesses 
      SET name = COALESCE($1, name), 
          tagline = COALESCE($2, tagline),
          email = COALESCE($3, email),
          phone = COALESCE($4, phone),
          address = COALESCE($5, address),
          city = COALESCE($6, city),
          updated_at = NOW()
      WHERE id = (SELECT id FROM businesses LIMIT 1)
      RETURNING id, name, tagline, email, phone, address, city
    `, [name, tagline, email, phone, address, city]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Business not found' });
    }

    res.json({ 
      success: true, 
      message: 'Profile updated successfully',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// DASHBOARD STATS ENDPOINT
// ============================================================================

// GET dashboard statistics
app.get('/api/dashboard/stats', async (req, res) => {
  try {
    const stats = await pool.query(`
      SELECT 
        (SELECT COUNT(*) FROM inventory_items WHERE current_stock <= minimum_stock AND is_active = true) as low_stock_count,
        (SELECT SUM(current_stock * cost_per_unit) FROM inventory_items WHERE is_active = true) as inventory_value,
        (SELECT COUNT(*) FROM inventory_items WHERE is_active = true) as inventory_count,
        (SELECT COUNT(*) FROM purchases) as purchase_count
    `);

    res.json({ success: true, data: stats.rows[0] });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// ROLES ENDPOINTS (v2.1)
// ============================================================================

// GET all roles for business
app.get('/api/roles', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT r.*, 
        (SELECT json_agg(permission) FROM role_permissions WHERE role_id = r.id) as permissions
      FROM roles r
      ORDER BY r.name
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching roles:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// CREATE role
app.post('/api/roles', async (req, res) => {
  const { name, description } = req.body;

  try {
    const result = await pool.query(`
      INSERT INTO roles (name, description, is_system_role)
      VALUES ($1, $2, false)
      RETURNING id, name, description
    `, [name, description]);

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error creating role:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// UPDATE role
app.put('/api/roles/:id', async (req, res) => {
  const { name, description } = req.body;

  try {
    const result = await pool.query(`
      UPDATE roles
      SET name = $1, description = $2, updated_at = CURRENT_TIMESTAMP
      WHERE id = $3 AND is_system_role = false
      RETURNING id, name, description
    `, [name, description, req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Role not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error updating role:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// STAFF ENDPOINTS (v2.1)
// ============================================================================

// GET all staff
app.get('/api/staff', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.*, r.name as role_name, r.description as role_description
      FROM staff s
      LEFT JOIN roles r ON s.role_id = r.id
      WHERE s.deleted_at IS NULL
      ORDER BY s.name
    `);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching staff:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET single staff member
app.get('/api/staff/:id', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT s.*, r.name as role_name
      FROM staff s
      LEFT JOIN roles r ON s.role_id = r.id
      WHERE s.id = $1 AND s.deleted_at IS NULL
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Staff member not found' });
    }

    // Get permissions for this staff member's role
    const permissions = await pool.query(`
      SELECT permission FROM role_permissions WHERE role_id = $1
    `, [result.rows[0].role_id]);

    res.json({ 
      success: true, 
      data: {
        ...result.rows[0],
        permissions: permissions.rows.map(p => p.permission)
      }
    });
  } catch (error) {
    console.error('Error fetching staff member:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// CREATE staff member
app.post('/api/staff', async (req, res) => {
  const { name, email, phone, role_id, position, hire_date } = req.body;

  try {
    const result = await pool.query(`
      INSERT INTO staff (name, email, phone, role_id, position, hire_date, is_active)
      VALUES ($1, $2, $3, $4, $5, $6, true)
      RETURNING id, name, email, phone, role_id, position, hire_date
    `, [name, email, phone, role_id, position, hire_date]);

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error creating staff member:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// UPDATE staff member
app.put('/api/staff/:id', async (req, res) => {
  const { name, email, phone, role_id, position, is_active } = req.body;

  try {
    const result = await pool.query(`
      UPDATE staff
      SET name = $1, email = $2, phone = $3, role_id = $4, position = $5, is_active = $6, updated_at = CURRENT_TIMESTAMP
      WHERE id = $7 AND deleted_at IS NULL
      RETURNING id, name, email, phone, role_id, position, is_active
    `, [name, email, phone, role_id, position, is_active, req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Staff member not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error updating staff member:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE staff member (soft delete)
app.delete('/api/staff/:id', async (req, res) => {
  try {
    const result = await pool.query(`
      UPDATE staff
      SET deleted_at = CURRENT_TIMESTAMP
      WHERE id = $1
      RETURNING id
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Staff member not found' });
    }

    res.json({ success: true, message: 'Staff member deleted' });
  } catch (error) {
    console.error('Error deleting staff member:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// ORDERS ENDPOINTS
// ============================================================================

// GET all orders (most recent first)
app.get('/api/orders', async (req, res) => {
  try {
    const ordersResult = await pool.query(`
      SELECT 
        id, 
        COALESCE(order_ref, order_number) as order_ref, 
        COALESCE(customer_name, client_name) as customer_name, 
        table_no, 
        COALESCE(payment_method, 'Cash') as payment_method, 
        COALESCE(total_amount, total_value, 0) as total_amount, 
        status, 
        inventory_deducted,
        inventory_deducted_at,
        cancellation_reason,
        created_at
      FROM orders
      ORDER BY created_at DESC
    `);
    const orders = ordersResult.rows;

    // Attach items for each order
    if (orders.length > 0) {
      const ids = orders.map((o) => o.id);
      const itemsResult = await pool.query(`
        SELECT 
          id, 
          order_id, 
          menu_item_id, 
          COALESCE(name, item_name) as name, 
          category, 
          COALESCE(unit_price, 0) as unit_price, 
          COALESCE(quantity, 1) as quantity, 
          COALESCE(line_total, total_price, 0) as line_total, 
          created_at
        FROM order_items WHERE order_id = ANY($1::uuid[])
      `, [ids]);
      const itemsByOrder = {};
      for (const item of itemsResult.rows) {
        if (!itemsByOrder[item.order_id]) itemsByOrder[item.order_id] = [];
        itemsByOrder[item.order_id].push(item);
      }
      for (const order of orders) {
        order.items = itemsByOrder[order.id] ?? [];
      }
    }

    res.json({ success: true, data: orders });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// CREATE order (Initial status is 'New', inventory is NOT deducted yet per Rule 4)
app.post('/api/orders', async (req, res) => {
  const { customer_name, table_no, payment_method, items, total_amount } = req.body;

  try {
    const businessResult = await pool.query('SELECT id FROM businesses LIMIT 1');
    const businessId = businessResult.rows[0]?.id;
    if (!businessId) {
      return res.status(400).json({ success: false, error: 'No business found' });
    }

    const orderRef = `ORD-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
    const itemsArray = items || [];
    const computedTotal = total_amount ?? itemsArray.reduce((s, i) => s + (Number(i.unit_price) || 0) * (Number(i.quantity) || 1), 0);

    const orderResult = await pool.query(`
      INSERT INTO orders (
        business_id, order_ref, order_number, customer_name, client_name, table_no, payment_method, total_amount, total_value, status, inventory_deducted
      )
      VALUES ($1, $2, $2, $3, $3, $4, $5, $6, $6, 'New', false)
      RETURNING id, order_ref, order_number, customer_name, table_no, payment_method, total_amount, status, inventory_deducted, created_at
    `, [businessId, orderRef, customer_name || null, table_no || null, payment_method || 'Cash', computedTotal]);

    const orderId = orderResult.rows[0].id;

    for (const item of itemsArray) {
      await pool.query(`
        INSERT INTO order_items (
          order_id, menu_item_id, name, item_name, category, unit_price, quantity, line_total, total_price
        )
        VALUES ($1, $2, $3, $3, $4, $5, $6, $7, $7)
      `, [
        orderId,
        item.menu_item_id || null,
        item.name,
        item.category || null,
        Number(item.unit_price) || 0,
        Number(item.quantity) || 1,
        (Number(item.unit_price) || 0) * (Number(item.quantity) || 1),
      ]);
    }

    res.status(201).json({
      success: true,
      message: 'Order created successfully with status New',
      data: { ...orderResult.rows[0], order_ref: orderRef, items: itemsArray },
    });
  } catch (error) {
    console.error('Error creating order:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET order ingredient requirements & stock check
app.get('/api/orders/:id/requirements', async (req, res) => {
  try {
    const orderId = req.params.id;
    const orderRes = await pool.query('SELECT * FROM orders WHERE id = $1', [orderId]);
    if (orderRes.rows.length === 0) return res.status(404).json({ success: false, error: 'Order not found' });
    const order = orderRes.rows[0];

    // If already deducted, return recorded consumptions
    if (order.inventory_deducted) {
      const consumptions = await pool.query(`
        SELECT * FROM order_ingredient_consumptions WHERE order_id = $1 ORDER BY ingredient_name
      `, [orderId]);
      return res.json({ 
        success: true, 
        deducted: true, 
        can_prepare: true, 
        ingredients: consumptions.rows 
      });
    }

    // Otherwise calculate required ingredients from recipes
    const itemsRes = await pool.query(`
      SELECT oi.*, mi.name as menu_name
      FROM order_items oi
      LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
      WHERE oi.order_id = $1
    `, [orderId]);

    const menuIds = itemsRes.rows.map(i => i.menu_item_id).filter(Boolean);
    let recipeIngredients = [];
    if (menuIds.length > 0) {
      const ingRes = await pool.query(`
        SELECT mii.*, ii.name as inventory_name, ii.current_stock, ii.unit as inventory_unit
        FROM menu_item_ingredients mii
        JOIN inventory_items ii ON mii.inventory_item_id = ii.id
        WHERE mii.menu_item_id = ANY($1::uuid[])
      `, [menuIds]);
      recipeIngredients = ingRes.rows;
    }

    const reqMap = {};
    for (const item of itemsRes.rows) {
      const ings = recipeIngredients.filter(r => r.menu_item_id === item.menu_item_id);
      const qty = Number(item.quantity) || 1;
      for (const ing of ings) {
        if (!reqMap[ing.inventory_item_id]) {
          reqMap[ing.inventory_item_id] = {
            inventory_item_id: ing.inventory_item_id,
            ingredient_name: ing.ingredient_name,
            recipe_unit: ing.unit,
            inventory_unit: ing.inventory_unit,
            current_stock: Number(ing.current_stock),
            required_quantity: 0,
          };
        }
        reqMap[ing.inventory_item_id].required_quantity += Number(ing.quantity_required) * qty;
      }
    }

    const list = Object.values(reqMap).map(r => {
      let reqInInvUnit = r.required_quantity;
      let hasSufficient = true;
      try {
        reqInInvUnit = convertQuantity(r.required_quantity, r.recipe_unit, r.inventory_unit);
        hasSufficient = r.current_stock >= reqInInvUnit;
      } catch {
        hasSufficient = false;
      }
      return {
        ...r,
        required_in_inventory_unit: Number(reqInInvUnit.toFixed(4)),
        is_sufficient: hasSufficient,
        shortage: hasSufficient ? 0 : Number((reqInInvUnit - r.current_stock).toFixed(4)),
      };
    });

    res.json({
      success: true,
      deducted: false,
      can_prepare: list.every(i => i.is_sufficient),
      ingredients: list,
    });
  } catch (error) {
    console.error('Error fetching order requirements:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// UPDATE order status (Automatic Ingredient Deduction on 'Preparing' with strict Rule 4 compliance)
const updateOrderStatusHandler = async (req, res) => {
  const { status, cancellation_reason } = req.body;
  const orderId = req.params.id;

  if (!['New', 'Preparing', 'Ready', 'Completed', 'Cancelled'].includes(status)) {
    return res.status(400).json({ success: false, error: 'Invalid order status' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Lock the order row to prevent race conditions
    const orderRes = await client.query(`
      SELECT * FROM orders WHERE id = $1 FOR UPDATE
    `, [orderId]);

    if (orderRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ success: false, error: 'Order not found' });
    }

    const order = orderRes.rows[0];
    const isAlreadyDeducted = Boolean(order.inventory_deducted);

    // Rule: Order Cancellation
    if (status === 'Cancelled') {
      // "Cancelling an order before preparation must not deduct inventory."
      // "Cancelling an order after preparation has started must not automatically return consumed ingredients to stock."
      await client.query(`
        UPDATE orders 
        SET status = 'Cancelled', cancellation_reason = $1, updated_at = NOW()
        WHERE id = $2
      `, [cancellation_reason || 'Cancelled by manager', orderId]);

      await client.query('COMMIT');
      return res.json({ 
        success: true, 
        message: 'Order cancelled successfully',
        data: { ...order, status: 'Cancelled', cancellation_reason }
      });
    }

    // Rule: Changing an order to 'Preparing' (or Ready/Completed) deducts ingredients automatically exactly once!
    const shouldDeduct = (status === 'Preparing' || status === 'Ready' || status === 'Completed') && !isAlreadyDeducted;

    if (shouldDeduct) {
      // 2. Fetch order items
      const itemsRes = await client.query(`
        SELECT oi.*, mi.name as menu_name
        FROM order_items oi
        LEFT JOIN menu_items mi ON oi.menu_item_id = mi.id
        WHERE oi.order_id = $1
      `, [orderId]);

      const orderItems = itemsRes.rows;

      // 3. For each order item, find recipe ingredients
      const menuIds = orderItems.map(i => i.menu_item_id).filter(Boolean);
      let ingredientsByMenu = {};

      if (menuIds.length > 0) {
        const ingRes = await client.query(`
          SELECT * FROM menu_item_ingredients WHERE menu_item_id = ANY($1::uuid[])
        `, [menuIds]);
        for (const ing of ingRes.rows) {
          if (!ingredientsByMenu[ing.menu_item_id]) ingredientsByMenu[ing.menu_item_id] = [];
          ingredientsByMenu[ing.menu_item_id].push(ing);
        }
      }

      // 4. Calculate total required quantity per inventory_item_id
      const requiredAgg = {};
      for (const item of orderItems) {
        const recipe = ingredientsByMenu[item.menu_item_id] || [];
        const orderItemQty = Number(item.quantity) || 1;

        for (const r of recipe) {
          if (!r.inventory_item_id) continue;
          const totalQty = Number(r.quantity_required) * orderItemQty;

          if (!requiredAgg[r.inventory_item_id]) {
            requiredAgg[r.inventory_item_id] = {
              inventory_item_id: r.inventory_item_id,
              ingredient_name: r.ingredient_name,
              recipeUnit: r.unit,
              totalRequired: 0,
              itemConsumptions: [],
            };
          }
          requiredAgg[r.inventory_item_id].totalRequired += totalQty;
          requiredAgg[r.inventory_item_id].itemConsumptions.push({
            order_item_id: item.id,
            menu_item_id: item.menu_item_id,
            ingredient_name: r.ingredient_name,
            quantity: totalQty,
            unit: r.unit,
          });
        }
      }

      const invIds = Object.keys(requiredAgg);
      if (invIds.length > 0) {
        // 5. Lock inventory items row-level to prevent negative stock during concurrent orders
        const invRes = await client.query(`
          SELECT id, name, unit, current_stock, cost_per_unit, business_id
          FROM inventory_items
          WHERE id = ANY($1::uuid[])
          FOR UPDATE
        `, [invIds]);

        const invMap = {};
        invRes.rows.forEach(r => { invMap[r.id] = r; });

        // 6. Check stock sufficiency for ALL required ingredients
        const shortages = [];
        const deductions = [];

        for (const invId of invIds) {
          const req = requiredAgg[invId];
          const invItem = invMap[invId];

          if (!invItem) {
            shortages.push({
              name: req.ingredient_name,
              required: req.totalRequired,
              available: 0,
              unit: req.recipeUnit,
              error: 'Inventory ingredient record missing',
            });
            continue;
          }

          let requiredInInvUnit;
          try {
            requiredInInvUnit = convertQuantity(req.totalRequired, req.recipeUnit, invItem.unit);
          } catch (convErr) {
            shortages.push({
              name: invItem.name,
              required: req.totalRequired,
              available: Number(invItem.current_stock),
              unit: invItem.unit,
              error: convErr.message,
            });
            continue;
          }

          const currentStock = Number(invItem.current_stock);
          if (currentStock < requiredInInvUnit) {
            shortages.push({
              name: invItem.name,
              required: Number(requiredInInvUnit.toFixed(4)),
              available: Number(currentStock.toFixed(4)),
              unit: invItem.unit,
              shortage: Number((requiredInInvUnit - currentStock).toFixed(4)),
            });
          } else {
            deductions.push({
              inventory_item_id: invId,
              name: invItem.name,
              business_id: invItem.business_id,
              previous_stock: currentStock,
              new_stock: Number((currentStock - requiredInInvUnit).toFixed(4)),
              quantity_deducted: requiredInInvUnit,
              unit: invItem.unit,
              cost_at_deduction: Number(invItem.cost_per_unit) || 0,
              itemConsumptions: req.itemConsumptions,
            });
          }
        }

        // 7. If any shortage exists, block transition and rollback!
        if (shortages.length > 0) {
          await client.query('ROLLBACK');
          return res.status(400).json({
            success: false,
            error: `Insufficient stock to prepare order ${order.order_ref || orderId}. Please restock required ingredients.`,
            shortages,
          });
        }

        // 8. Deduct stock and record movements & consumptions
        for (const ded of deductions) {
          // Update inventory stock
          await client.query(`
            UPDATE inventory_items
            SET current_stock = $1, updated_at = NOW()
            WHERE id = $2
          `, [ded.new_stock, ded.inventory_item_id]);

          // Record in inventory_movements
          await client.query(`
            INSERT INTO inventory_movements (
              business_id, inventory_item_id, order_id, movement_type, 
              quantity, unit, previous_stock, new_stock, notes
            )
            VALUES ($1, $2, $3, 'order_deduction', $4, $5, $6, $7, $8)
          `, [
            ded.business_id,
            ded.inventory_item_id,
            orderId,
            -ded.quantity_deducted,
            ded.unit,
            ded.previous_stock,
            ded.new_stock,
            `Recipe deduction for order ${order.order_ref || orderId}`
          ]);

          // Record in stock_movements (compatibility)
          await client.query(`
            INSERT INTO stock_movements (
              business_id, inventory_item_id, movement_type, 
              quantity_change, previous_stock, new_stock, reference_id, reference_type, notes
            )
            VALUES ($1, $2, 'Consumption', $3, $4, $5, $6, 'Order', $7)
          `, [
            ded.business_id,
            ded.inventory_item_id,
            -ded.quantity_deducted,
            ded.previous_stock,
            ded.new_stock,
            order.order_ref || orderId,
            `Recipe deduction for order ${order.order_ref || orderId}`
          ]);

          // Record detailed item consumptions
          for (const c of ded.itemConsumptions) {
            await client.query(`
              INSERT INTO order_ingredient_consumptions (
                order_id, order_item_id, menu_item_id, inventory_item_id, 
                ingredient_name, quantity_deducted, unit, cost_at_deduction
              )
              VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            `, [
              orderId,
              c.order_item_id,
              c.menu_item_id,
              ded.inventory_item_id,
              c.ingredient_name,
              c.quantity,
              c.unit,
              ded.cost_at_deduction
            ]);
          }
        }
      }

      // Mark order as deducted
      await client.query(`
        UPDATE orders 
        SET status = $1, inventory_deducted = true, inventory_deducted_at = NOW(), updated_at = NOW()
        WHERE id = $2
      `, [status, orderId]);
    } else {
      // Order was already deducted earlier, simply update status (e.g. from Preparing to Ready or Completed)
      await client.query(`
        UPDATE orders 
        SET status = $1, updated_at = NOW()
        WHERE id = $2
      `, [status, orderId]);
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      message: `Order status updated to ${status}${shouldDeduct ? ' and inventory deducted' : ''}`,
      data: {
        id: orderId,
        status,
        inventory_deducted: isAlreadyDeducted || shouldDeduct,
      }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating order status:', err);
    res.status(500).json({ success: false, error: err.message });
  } finally {
    client.release();
  }
};

app.patch('/api/orders/:id/status', updateOrderStatusHandler);
app.put('/api/orders/:id/status', updateOrderStatusHandler);

// DELETE order
app.delete('/api/orders/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM orders WHERE id = $1 RETURNING id',
      [req.params.id],
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Order not found' });
    }
    res.json({ success: true, message: 'Order deleted' });
  } catch (error) {
    console.error('Error deleting order:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================
// HEALTH CHECK
// ============================================================================

app.get('/health', (req, res) => {
  res.json({ status: 'OK', server: 'Running', timestamp: new Date() });
});

// ============================================================================
// ERROR HANDLING
// ============================================================================

// ============================================================================
// NOTIFICATIONS ENDPOINTS
// ============================================================================

// GET notifications for logged-in user
app.get('/api/notifications', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT * FROM notifications 
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 50
    `, [req.user.id]);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('Error fetching notifications:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// MARK notification as read
app.put('/api/notifications/:id/read', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      UPDATE notifications 
      SET is_read = true, read_at = NOW()
      WHERE id = $1 AND user_id = $2
      RETURNING *
    `, [req.params.id, req.user.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Notification not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// MARK ALL notifications as read
app.put('/api/notifications/read-all', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      UPDATE notifications 
      SET is_read = true, read_at = NOW()
      WHERE user_id = $1 AND is_read = false
      RETURNING *
    `, [req.user.id]);

    res.json({ success: true, message: 'All notifications marked as read', count: result.rowCount });
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============================================================================

app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ success: false, error: 'Internal server error' });
});

// ============================================================================
// START SERVER
// ============================================================================

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  app.listen(PORT, process.env.HOST, () => {
    console.log(`\n🍽️  Madras Beef Belly API`);
    console.log(`✅ Server running on http://localhost:${PORT}`);
    console.log(`📊 Frontend: http://localhost:8080`);
    console.log(`🗄️  Database: ${process.env.DB_NAME || 'restaurant_inventory_manager'}`);
    console.log(`\n📚 Available endpoints:`);
    console.log(`   GET    /api/menu-items`);
    console.log(`   POST   /api/menu-items`);
    console.log(`   PUT    /api/menu-items/:id`);
    console.log(`   DELETE /api/menu-items/:id`);
    console.log(`   GET    /api/inventory`);
    console.log(`   POST   /api/inventory`);
    console.log(`   PUT    /api/inventory/:id`);
    console.log(`   PUT    /api/inventory/:id/stock`);
    console.log(`   GET    /api/purchases`);
    console.log(`   POST   /api/purchases`);
    console.log(`   GET    /api/search?q=query`);
    console.log(`   GET    /api/profile`);
    console.log(`   PUT    /api/profile`);
    console.log(`   GET    /api/dashboard/stats`);
    console.log(`   GET    /api/roles`);
    console.log(`   POST   /api/roles`);
    console.log(`   PUT    /api/roles/:id`);
    console.log(`   GET    /api/staff`);
    console.log(`   GET    /api/staff/:id`);
    console.log(`   POST   /api/staff`);
    console.log(`   PUT    /api/staff/:id`);
    console.log(`   DELETE /api/staff/:id`);
    console.log(`\n`);
  });
}

export default app;
