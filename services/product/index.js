// services/product/index.js — Product Service (Port 3002)
require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const cors    = require('cors');
const upload  = require('../../backend/s3');
const { auth, role, rateLimit, requestLogger, redis } = require('../../shared/middleware');

const app  = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

app.use(express.json());
app.use(cors());
app.use(requestLogger('PRODUCT-SVC'));

app.get('/health', (req, res) => res.json({ status: 'ok', service: 'product' }));

// ─── Full-text search with PostgreSQL tsvectors ────────────
app.get('/api/products', async (req, res) => {
  try {
    const { q = '', page = 1, categoryId, minPrice, maxPrice, sellerId, sort = 'recent' } = req.query;
    const limit  = 20;
    const offset = (page - 1) * limit;

    // Try Redis cache for empty searches
    const cacheKey = `products:${q}:${categoryId||''}:${minPrice||''}:${maxPrice||''}:${sort}:${page}`;
    if (!q && !categoryId && !minPrice && !maxPrice && page == 1) {
      const cached = await redis.get(cacheKey);
      if (cached) return res.json(JSON.parse(cached));
    }

    let where   = ['p.active = TRUE'];
    const params = [];
    let i = 1;

    if (q) {
      // PostgreSQL full-text search
      where.push(`(
        to_tsvector('spanish', p.title || ' ' || COALESCE(p.description,'')) @@ plainto_tsquery('spanish', $${i})
        OR p.title ILIKE $${i+1}
      )`);
      params.push(q, `%${q}%`);
      i += 2;
    }
    if (categoryId) { where.push(`p.category_id=$${i++}`); params.push(categoryId); }
    if (minPrice)   { where.push(`p.price>=$${i++}`);       params.push(minPrice); }
    if (maxPrice)   { where.push(`p.price<=$${i++}`);       params.push(maxPrice); }
    if (sellerId)   { where.push(`p.seller_id=$${i++}`);    params.push(sellerId); }

    const orderBy = {
      recent:    'p.created_at DESC',
      price_asc: 'p.price ASC',
      price_desc:'p.price DESC',
      rating:    'seller_rating DESC NULLS LAST',
    }[sort] || 'p.created_at DESC';

    const sql = `
      SELECT p.*, u.name AS seller_name, c.name AS category_name,
        sp.rating_avg AS seller_rating, sp.verified AS seller_verified,
        sp.location_city
      FROM products p
      JOIN users u ON u.id=p.seller_id
      LEFT JOIN categories c ON c.id=p.category_id
      LEFT JOIN seller_profiles sp ON sp.user_id=p.seller_id
      WHERE ${where.join(' AND ')}
      ORDER BY ${orderBy}
      LIMIT $${i} OFFSET $${i+1}`;
    params.push(limit, offset);

    const [rows, count] = await Promise.all([
      pool.query(sql, params),
      pool.query(`SELECT COUNT(*) FROM products p WHERE ${where.join(' AND ')}`, params.slice(0, -2)),
    ]);

    const result = { products: rows.rows, total: parseInt(count.rows[0].count) };

    // Cache empty searches for 2 min
    if (!q && !categoryId && !minPrice && !maxPrice && page == 1) {
      await redis.setex(cacheKey, 120, JSON.stringify(result));
    }

    res.json(result);
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error interno' }); }
});

app.get('/api/products/search', async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;
    if (!q) return res.json([]);

    // Full-text search with ranking
    const r = await pool.query(`
      SELECT p.id, p.title, p.price, p.image_url,
        ts_rank(to_tsvector('spanish', p.title || ' ' || COALESCE(p.description,'')),
                plainto_tsquery('spanish', $1)) AS rank,
        u.name AS seller_name, c.name AS category_name
      FROM products p
      JOIN users u ON u.id=p.seller_id
      LEFT JOIN categories c ON c.id=p.category_id
      WHERE p.active=TRUE AND (
        to_tsvector('spanish', p.title || ' ' || COALESCE(p.description,'')) @@ plainto_tsquery('spanish', $1)
        OR p.title ILIKE $2
      )
      ORDER BY rank DESC, p.created_at DESC
      LIMIT $3`, [q, `%${q}%`, limit]);

    res.json(r.rows);
  } catch { res.status(500).json({ error: 'Error interno' }); }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const cacheKey = `product:${req.params.id}`;
    const cached   = await redis.get(cacheKey);
    if (cached) return res.json(JSON.parse(cached));

    const r = await pool.query(`
      SELECT p.*, u.name AS seller_name, c.name AS category_name,
        sp.business_name, sp.location_city, sp.rating_avg AS seller_rating,
        sp.total_sales, sp.portfolio_desc, sp.verified
      FROM products p
      JOIN users u ON u.id=p.seller_id
      LEFT JOIN categories c ON c.id=p.category_id
      LEFT JOIN seller_profiles sp ON sp.user_id=p.seller_id
      WHERE p.id=$1 AND p.active=TRUE`, [req.params.id]);

    if (!r.rows.length) return res.status(404).json({ error: 'Producto no encontrado' });

    const reviews = await pool.query(`
      SELECT rv.*, u.name AS buyer_name FROM reviews rv
      JOIN users u ON u.id=rv.buyer_id
      WHERE rv.seller_id=$1 ORDER BY rv.created_at DESC LIMIT 5`, [r.rows[0].seller_id]);

    const data = { ...r.rows[0], reviews: reviews.rows };
    await redis.setex(cacheKey, 300, JSON.stringify(data));
    res.json(data);
  } catch { res.status(500).json({ error: 'Error interno' }); }
});

app.post('/api/products', auth, role('VENDEDOR'), upload.single('image'), async (req, res) => {
  try {
    const { title, description, price, categoryId, minQuantity, productionTimeDays, requiresDesignFile, materialsAvailable, sizesAvailable } = req.body;
    const imageUrl = req.file ? `http://localhost:3001/uploads/${req.file.filename}` : null;

    await pool.query(
      'INSERT INTO products(seller_id,category_id,title,description,price,min_quantity,production_time_days,requires_design_file,materials_available,sizes_available,image_url) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)',
      [req.user.id, categoryId||null, title, description, price, minQuantity||1, productionTimeDays||3, requiresDesignFile==='true', materialsAvailable||null, sizesAvailable||null, imageUrl]
    );

    // Invalidate product cache
    await redis.del('products:::::::1');
    res.status(201).json({ ok: true });
  } catch (err) { console.error(err); res.status(500).json({ error: 'Error interno' }); }
});

app.get('/api/seller/products', auth, role('VENDEDOR'), async (req, res) => {
  try {
    const r = await pool.query(
      'SELECT p.*,c.name AS category_name FROM products p LEFT JOIN categories c ON c.id=p.category_id WHERE p.seller_id=$1 ORDER BY p.created_at DESC',
      [req.user.id]
    );
    res.json(r.rows);
  } catch { res.status(500).json({ error: 'Error interno' }); }
});

app.delete('/api/products/:id', auth, role('VENDEDOR'), async (req, res) => {
  try {
    await pool.query('UPDATE products SET active=FALSE WHERE id=$1 AND seller_id=$2', [req.params.id, req.user.id]);
    await redis.del(`product:${req.params.id}`);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Error interno' }); }
});

// Admin product moderation
app.get('/api/admin/products', auth, role('ADMIN'), async (req, res) => {
  try {
    const r = await pool.query(`
      SELECT p.*, u.name AS seller_name, c.name AS category_name
      FROM products p JOIN users u ON u.id=p.seller_id LEFT JOIN categories c ON c.id=p.category_id
      ORDER BY p.created_at DESC`);
    res.json(r.rows);
  } catch { res.status(500).json({ error: 'Error interno' }); }
});

app.put('/api/admin/products/:id/moderate', auth, role('ADMIN'), async (req, res) => {
  try {
    const { action, reason } = req.body;
    const active = action === 'approve';
    await pool.query('UPDATE products SET active=$1 WHERE id=$2', [active, req.params.id]);
    const p = await pool.query('SELECT seller_id,title FROM products WHERE id=$1', [req.params.id]);
    if (p.rows.length) {
      const msg = active ? `Tu producto "${p.rows[0].title}" fue aprobado.` : `Producto rechazado. Motivo: ${reason}`;
      await pool.query('INSERT INTO notifications(user_id,type,title,message,link) VALUES($1,$2,$3,$4,$5)',
        [p.rows[0].seller_id, 'PRODUCTO_MODERADO', active?'Producto aprobado':'Producto rechazado', msg, '/seller/orders']);
    }
    await redis.del(`product:${req.params.id}`);
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Error interno' }); }
});

// Categories CRUD
app.get('/api/categories', async (req, res) => {
  try {
    const cached = await redis.get('categories:all');
    if (cached) return res.json(JSON.parse(cached));
    const r = await pool.query('SELECT * FROM categories ORDER BY name');
    await redis.setex('categories:all', 3600, JSON.stringify(r.rows));
    res.json(r.rows);
  } catch { res.status(500).json({ error: 'Error interno' }); }
});

app.post('/api/admin/categories', auth, role('ADMIN'), async (req, res) => {
  try {
    const { name, commission_rate } = req.body;
    const r = await pool.query('INSERT INTO categories(name,commission_rate) VALUES($1,$2) RETURNING *', [name, commission_rate||10]);
    await redis.del('categories:all');
    res.json(r.rows[0]);
  } catch { res.status(500).json({ error: 'Error interno' }); }
});

app.put('/api/admin/categories/:id/commission', auth, role('ADMIN'), async (req, res) => {
  try {
    await pool.query('UPDATE categories SET commission_rate=$1 WHERE id=$2', [req.body.commission_rate, req.params.id]);
    await redis.del('categories:all');
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Error interno' }); }
});

app.delete('/api/admin/categories/:id', auth, role('ADMIN'), async (req, res) => {
  try {
    await pool.query('DELETE FROM categories WHERE id=$1', [req.params.id]);
    await redis.del('categories:all');
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Error interno' }); }
});

app.listen(3002, () => console.log('✅ Product Service activo en :3002'));
