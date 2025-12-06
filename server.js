const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-change-me';
const DB_PATH = path.join(__dirname, 'data.db');

const db = new sqlite3.Database(DB_PATH);

// Promisified helpers for sqlite
const run = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) return reject(err);
      resolve(this);
    });
  });

const get = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row);
    });
  });

const all = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

async function initDb() {
  await run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    passwordHash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    createdAt TEXT NOT NULL
  )`);

  await run(`CREATE TABLE IF NOT EXISTS products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    price REAL DEFAULT 0,
    stock INTEGER DEFAULT 0,
    status TEXT DEFAULT 'available',
    image TEXT,
    createdAt TEXT NOT NULL
  )`);

  await run(`CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT,
    excerpt TEXT,
    status TEXT DEFAULT 'published',
    image TEXT,
    categoryId TEXT,
    createdAt TEXT NOT NULL
  )`);

  await run(`CREATE TABLE IF NOT EXISTS post_categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    parentId TEXT,
    createdAt TEXT NOT NULL,
    FOREIGN KEY(parentId) REFERENCES post_categories(id) ON DELETE SET NULL
  )`);

  await run(`CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    customerName TEXT NOT NULL,
    total REAL DEFAULT 0,
    date TEXT NOT NULL,
    status TEXT DEFAULT 'pending',
    createdAt TEXT NOT NULL
  )`);

  // Thêm cột mới nếu chưa có
  const info = await all(`PRAGMA table_info(orders)`);
  const cols = (info || []).map((c) => c.name);
  if (!cols.includes('phone')) {
    try { await run(`ALTER TABLE orders ADD COLUMN phone TEXT`); } catch (_) {}
  }
  if (!cols.includes('address')) {
    try { await run(`ALTER TABLE orders ADD COLUMN address TEXT`); } catch (_) {}
  }
  if (!cols.includes('items')) {
    try { await run(`ALTER TABLE orders ADD COLUMN items TEXT`); } catch (_) {}
  }

  // Thêm cột ảnh cho sản phẩm, bài viết nếu chưa có
  const productCols = (await all(`PRAGMA table_info(products)`)).map((c) => c.name);
  if (!productCols.includes('image')) {
    try { await run(`ALTER TABLE products ADD COLUMN image TEXT`); } catch (_) {}
  }
  const postCols = (await all(`PRAGMA table_info(posts)`)).map((c) => c.name);
  if (!postCols.includes('image')) {
    try { await run(`ALTER TABLE posts ADD COLUMN image TEXT`); } catch (_) {}
  }
  if (!postCols.includes('categoryId')) {
    try { await run(`ALTER TABLE posts ADD COLUMN categoryId TEXT`); } catch (_) {}
  }

  await run(`CREATE TABLE IF NOT EXISTS bird_nests (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    name TEXT,
    hatch_date TEXT,
    notes TEXT,
    FOREIGN KEY(user_id) REFERENCES users(id)
  )`);

  const admin = await get(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`);
  if (!admin) {
    const passwordHash = await bcrypt.hash('admin123', 10);
    await run(
      `INSERT INTO users (id, name, email, passwordHash, role, createdAt)
       VALUES (?, ?, ?, ?, 'admin', ?)`,
      [uuidv4(), 'Quản trị viên', 'admin@farm.com', passwordHash, new Date().toISOString()]
    );
  }
}

const POSTS_WITH_CATEGORY_SQL = `
  SELECT p.*, c.name AS categoryName, c.parentId AS parentCategoryId, parent.name AS parentCategoryName
  FROM posts p
  LEFT JOIN post_categories c ON p.categoryId = c.id
  LEFT JOIN post_categories parent ON c.parentId = parent.id
`;

const listPostsWithCategory = () =>
  all(`${POSTS_WITH_CATEGORY_SQL} ORDER BY datetime(p.createdAt) DESC`);

const getPostWithCategory = (id) =>
  get(`${POSTS_WITH_CATEGORY_SQL} WHERE p.id = ?`, [id]);

async function getCategoryTree() {
  const rows = await all(
    `SELECT id, name, parentId, createdAt FROM post_categories ORDER BY name COLLATE NOCASE`
  );
  const nodes = rows.map((row) => ({ ...row, children: [] }));
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const tree = [];
  nodes.forEach((node) => {
    if (node.parentId && byId.has(node.parentId)) {
      byId.get(node.parentId).children.push(node);
    } else {
      tree.push(node);
    }
  });
  return { tree, flat: rows };
}

function createToken(user) {
  return jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, {
    expiresIn: '7d',
  });
}

function sanitizeUser(user) {
  if (!user) return null;
  const { passwordHash, ...rest } = user;
  return rest;
}

function authRequired(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ message: 'Vui lòng đăng nhập' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    return next();
  } catch (err) {
    return res.status(401).json({ message: 'Phiên đăng nhập không hợp lệ' });
  }
}

function adminRequired(req, res, next) {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({ message: 'Yêu cầu quyền quản trị' });
  }
  return next();
}

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Thiếu thông tin' });
    }

    const existing = await get(`SELECT id FROM users WHERE LOWER(email) = LOWER(?)`, [email]);
    if (existing) {
      return res.status(400).json({ message: 'Email đã được sử dụng' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = {
      id: uuidv4(),
      name,
      email,
      passwordHash,
      role: 'user',
      createdAt: new Date().toISOString(),
    };
    await run(
      `INSERT INTO users (id, name, email, passwordHash, role, createdAt)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [user.id, user.name, user.email, user.passwordHash, user.role, user.createdAt]
    );

    const token = createToken(user);
    res.json({ token, user: sanitizeUser(user) });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi máy chủ', detail: err.message });
  }
});

async function handleLogin(req, res, { adminOnly = false } = {}) {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ message: 'Thiếu thông tin' });
    }

    const user = await get(`SELECT * FROM users WHERE LOWER(email) = LOWER(?)`, [email]);
    if (!user) {
      return res.status(400).json({ message: 'Sai email hoặc mật khẩu' });
    }

    if (adminOnly && user.role !== 'admin') {
      return res.status(403).json({ message: 'Không có quyền quản trị' });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return res.status(400).json({ message: 'Sai email hoặc mật khẩu' });
    }

    const token = createToken(user);
    return res.json({ token, user: sanitizeUser(user) });
  } catch (err) {
    res.status(500).json({ message: 'Lỗi máy chủ', detail: err.message });
  }
}

app.post('/api/auth/login', (req, res) => handleLogin(req, res));
app.post('/api/auth/admin-login', (req, res) => handleLogin(req, res, { adminOnly: true }));

app.get('/api/products', async (req, res) => {
  try {
    const products = await all(`SELECT * FROM products ORDER BY datetime(createdAt) DESC`);
    res.json({ products });
  } catch (err) {
    res.status(500).json({ message: 'Không tải được sản phẩm' });
  }
});

app.get('/api/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const product = await get(`SELECT * FROM products WHERE id = ?`, [id]);
    if (!product) return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
    res.json({ product });
  } catch (err) {
    res.status(500).json({ message: 'Không tải được sản phẩm' });
  }
});

app.post('/api/products', authRequired, adminRequired, async (req, res) => {
  try {
    const { name, price, stock, status, image } = req.body || {};
    if (!name) return res.status(400).json({ message: 'Tên sản phẩm bắt buộc' });

    const product = {
      id: uuidv4(),
      name,
      price: Number(price) || 0,
      stock: Number(stock) || 0,
      status: status || 'available',
      image: image || '',
      createdAt: new Date().toISOString(),
    };

    await run(
      `INSERT INTO products (id, name, price, stock, status, image, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [product.id, product.name, product.price, product.stock, product.status, product.image, product.createdAt]
    );
    res.json({ product });
  } catch (err) {
    res.status(500).json({ message: 'Không thêm được sản phẩm' });
  }
});

app.put('/api/products/:id', authRequired, adminRequired, async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await get(`SELECT * FROM products WHERE id = ?`, [id]);
    if (!existing) return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });

    const next = {
      name: req.body.name ?? existing.name,
      price: Number(req.body.price ?? existing.price),
      stock: Number(req.body.stock ?? existing.stock),
      status: req.body.status ?? existing.status,
      image: req.body.image ?? existing.image,
    };

    await run(
      `UPDATE products SET name = ?, price = ?, stock = ?, status = ?, image = ? WHERE id = ?`,
      [next.name, next.price, next.stock, next.status, next.image, id]
    );

    const updated = await get(`SELECT * FROM products WHERE id = ?`, [id]);
    res.json({ product: updated });
  } catch (err) {
    res.status(500).json({ message: 'Không cập nhật được sản phẩm' });
  }
});

app.delete('/api/products/:id', authRequired, adminRequired, async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await get(`SELECT id FROM products WHERE id = ?`, [id]);
    if (!existing) return res.status(404).json({ message: 'Không tìm thấy sản phẩm' });
    await run(`DELETE FROM products WHERE id = ?`, [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Không xóa được sản phẩm' });
  }
});

app.get('/api/posts', async (req, res) => {
  try {
    const posts = await listPostsWithCategory();
    res.json({ posts });
  } catch (err) {
    res.status(500).json({ message: 'Không tải được bài viết' });
  }
});

app.get('/api/posts/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const post = await getPostWithCategory(id);
    if (!post) return res.status(404).json({ message: 'Không tìm thấy bài viết' });
    res.json({ post });
  } catch (err) {
    res.status(500).json({ message: 'Không tải được bài viết' });
  }
});

app.post('/api/posts', authRequired, adminRequired, async (req, res) => {
  try {
    const { title, content, status, excerpt, image, categoryId } = req.body || {};
    if (!title) return res.status(400).json({ message: 'Thiếu tiêu đề' });

    let normalizedCategoryId = categoryId || null;
    if (normalizedCategoryId) {
      const category = await get(`SELECT id FROM post_categories WHERE id = ?`, [normalizedCategoryId]);
      if (!category) {
        return res.status(400).json({ message: 'Danh mục không tồn tại' });
      }
    }

    const post = {
      id: uuidv4(),
      title,
      content: content || '',
      excerpt: excerpt || '',
      status: status || 'published',
      image: image || '',
      categoryId: normalizedCategoryId,
      createdAt: new Date().toISOString(),
    };

    await run(
      `INSERT INTO posts (id, title, content, excerpt, status, image, categoryId, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [post.id, post.title, post.content, post.excerpt, post.status, post.image, post.categoryId, post.createdAt]
    );
    const created = await getPostWithCategory(post.id);
    res.json({ post: created });
  } catch (err) {
    res.status(500).json({ message: 'Không thêm được bài viết' });
  }
});

app.put('/api/posts/:id', authRequired, adminRequired, async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await get(`SELECT * FROM posts WHERE id = ?`, [id]);
    if (!existing) return res.status(404).json({ message: 'Không tìm thấy bài viết' });

    const next = {
      title: req.body.title ?? existing.title,
      content: req.body.content ?? existing.content,
      excerpt: req.body.excerpt ?? existing.excerpt,
      status: req.body.status ?? existing.status,
      image: req.body.image ?? existing.image,
      categoryId:
        req.body.categoryId === undefined || req.body.categoryId === null
          ? existing.categoryId
          : req.body.categoryId || null,
    };

    if (next.categoryId) {
      const category = await get(`SELECT id FROM post_categories WHERE id = ?`, [next.categoryId]);
      if (!category) {
        return res.status(400).json({ message: 'Danh mục không tồn tại' });
      }
    }

    await run(
      `UPDATE posts SET title = ?, content = ?, excerpt = ?, status = ?, image = ?, categoryId = ? WHERE id = ?`,
      [next.title, next.content, next.excerpt, next.status, next.image, next.categoryId, id]
    );

    const updated = await getPostWithCategory(id);
    res.json({ post: updated });
  } catch (err) {
    res.status(500).json({ message: 'Không cập nhật được bài viết' });
  }
});

app.get('/api/post-categories', async (req, res) => {
  try {
    const { tree, flat } = await getCategoryTree();
    res.json({ categories: tree, flat });
  } catch (err) {
    res.status(500).json({ message: 'Không tải được danh mục' });
  }
});

app.post('/api/post-categories', authRequired, adminRequired, async (req, res) => {
  try {
    const { name, parentId } = req.body || {};
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Thiếu tên danh mục' });
    }
    let normalizedParentId = parentId || null;
    if (normalizedParentId) {
      const parent = await get(`SELECT id FROM post_categories WHERE id = ?`, [normalizedParentId]);
      if (!parent) return res.status(400).json({ message: 'Danh mục cha không tồn tại' });
    }
    const category = {
      id: uuidv4(),
      name: name.trim(),
      parentId: normalizedParentId,
      createdAt: new Date().toISOString(),
    };
    await run(
      `INSERT INTO post_categories (id, name, parentId, createdAt) VALUES (?, ?, ?, ?)`,
      [category.id, category.name, category.parentId, category.createdAt]
    );
    const saved = await get(`SELECT id, name, parentId, createdAt FROM post_categories WHERE id = ?`, [category.id]);
    res.json({ category: saved });
  } catch (err) {
    res.status(500).json({ message: 'Không tạo được danh mục' });
  }
});

app.put('/api/post-categories/:id', authRequired, adminRequired, async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await get(`SELECT * FROM post_categories WHERE id = ?`, [id]);
    if (!existing) return res.status(404).json({ message: 'Không tìm thấy danh mục' });
    const { name, parentId } = req.body || {};
    if (parentId === id) {
      return res.status(400).json({ message: 'Danh mục cha không hợp lệ' });
    }
    let normalizedParentId =
      parentId === undefined || parentId === null ? existing.parentId : parentId || null;
    if (normalizedParentId) {
      const parent = await get(`SELECT id FROM post_categories WHERE id = ?`, [normalizedParentId]);
      if (!parent) return res.status(400).json({ message: 'Danh mục cha không tồn tại' });
    }
    await run(
      `UPDATE post_categories SET name = ?, parentId = ? WHERE id = ?`,
      [name?.trim() || existing.name, normalizedParentId, id]
    );
    const updated = await get(`SELECT id, name, parentId, createdAt FROM post_categories WHERE id = ?`, [id]);
    res.json({ category: updated });
  } catch (err) {
    res.status(500).json({ message: 'Không cập nhật được danh mục' });
  }
});

app.delete('/api/post-categories/:id', authRequired, adminRequired, async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await get(`SELECT id FROM post_categories WHERE id = ?`, [id]);
    if (!existing) return res.status(404).json({ message: 'Không tìm thấy danh mục' });
    await run(`UPDATE post_categories SET parentId = NULL WHERE parentId = ?`, [id]);
    await run(`UPDATE posts SET categoryId = NULL WHERE categoryId = ?`, [id]);
    await run(`DELETE FROM post_categories WHERE id = ?`, [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Không xóa được danh mục' });
  }
});

app.get('/api/users', authRequired, adminRequired, async (req, res) => {
  try {
    const users = await all(`SELECT id, name, email, role, createdAt FROM users ORDER BY datetime(createdAt) DESC`);
    res.json({ users });
  } catch (err) {
    res.status(500).json({ message: 'Không tải được danh sách tài khoản' });
  }
});

app.post('/api/users', authRequired, adminRequired, async (req, res) => {
  try {
    const { name, email, password, role } = req.body || {};
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Thiếu thông tin' });
    }
    const existing = await get(`SELECT id FROM users WHERE LOWER(email) = LOWER(?)`, [email]);
    if (existing) return res.status(400).json({ message: 'Email đã tồn tại' });
    const passwordHash = await bcrypt.hash(password, 10);
    const user = {
      id: uuidv4(),
      name,
      email,
      passwordHash,
      role: role || 'user',
      createdAt: new Date().toISOString(),
    };
    await run(
      `INSERT INTO users (id, name, email, passwordHash, role, createdAt)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [user.id, user.name, user.email, user.passwordHash, user.role, user.createdAt]
    );
    res.json({ user: sanitizeUser(user) });
  } catch (err) {
    res.status(500).json({ message: 'Không thêm được tài khoản' });
  }
});

app.put('/api/users/:id/role', authRequired, adminRequired, async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body || {};
    if (!['admin', 'user'].includes(role)) {
      return res.status(400).json({ message: 'Quyền không hợp lệ' });
    }
    await run(`UPDATE users SET role = ? WHERE id = ?`, [role, id]);
    const user = await get(`SELECT id, name, email, role, createdAt FROM users WHERE id = ?`, [id]);
    res.json({ user });
  } catch (err) {
    res.status(500).json({ message: 'Không cập nhật được quyền' });
  }
});

app.put('/api/users/:id', authRequired, adminRequired, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, password, role } = req.body || {};
    const user = await get(`SELECT * FROM users WHERE id = ?`, [id]);
    if (!user) return res.status(404).json({ message: 'Không tìm thấy tài khoản' });
    if (email && email.toLowerCase() !== user.email.toLowerCase()) {
      const exists = await get(`SELECT id FROM users WHERE LOWER(email) = LOWER(?) AND id != ?`, [email, id]);
      if (exists) return res.status(400).json({ message: 'Email đã tồn tại' });
    }
    let passwordHash = user.passwordHash;
    if (password) passwordHash = await bcrypt.hash(password, 10);
    await run(
      `UPDATE users SET name = ?, email = ?, passwordHash = ?, role = ? WHERE id = ?`,
      [name || user.name, email || user.email, passwordHash, role || user.role, id]
    );
    const updated = await get(`SELECT id, name, email, role, createdAt FROM users WHERE id = ?`, [id]);
    res.json({ user: updated });
  } catch (err) {
    res.status(500).json({ message: 'Không cập nhật được tài khoản' });
  }
});

app.delete('/api/users/:id', authRequired, adminRequired, async (req, res) => {
  try {
    const { id } = req.params;
    if (req.user.id === id) {
      return res.status(400).json({ message: 'Không thể tự xóa tài khoản của bạn' });
    }
    const existing = await get(`SELECT id FROM users WHERE id = ?`, [id]);
    if (!existing) return res.status(404).json({ message: 'Không tìm thấy tài khoản' });
    await run(`DELETE FROM users WHERE id = ?`, [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Không xóa được tài khoản' });
  }
});

app.delete('/api/posts/:id', authRequired, adminRequired, async (req, res) => {
  try {
    const { id } = req.params;
    const existing = await get(`SELECT id FROM posts WHERE id = ?`, [id]);
    if (!existing) return res.status(404).json({ message: 'Không tìm thấy bài viết' });
    await run(`DELETE FROM posts WHERE id = ?`, [id]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ message: 'Không xóa được bài viết' });
  }
});

app.get('/api/orders', authRequired, adminRequired, async (req, res) => {
  try {
    const orders = await all(`SELECT * FROM orders ORDER BY datetime(createdAt) DESC`);
    res.json({ orders });
  } catch (err) {
    res.status(500).json({ message: 'Không tải được đơn hàng' });
  }
});

app.post('/api/orders', authRequired, adminRequired, async (req, res) => {
  try {
    const { code, customerName, total, date, status, phone, address, items } = req.body || {};
    if (!customerName) return res.status(400).json({ message: 'Thiếu thông tin đơn hàng' });
    const order = {
      id: uuidv4(),
      code: code || `DH-${Date.now()}`,
      customerName,
      total: Number(total) || 0,
      date: date || new Date().toISOString(),
      status: status || 'pending',
      phone: phone || '',
      address: address || '',
      items: JSON.stringify(items || []),
      createdAt: new Date().toISOString(),
    };
    await run(
      `INSERT INTO orders (id, code, customerName, total, date, status, phone, address, items, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        order.id,
        order.code,
        order.customerName,
        order.total,
        order.date,
        order.status,
        order.phone,
        order.address,
        order.items,
        order.createdAt,
      ]
    );
    res.json({ order });
  } catch (err) {
    res.status(500).json({ message: 'Không thêm được đơn hàng' });
  }
});

app.post('/api/orders/public', async (req, res) => {
  try {
    const { customerName, phone, address, items } = req.body || {};
    if (!customerName || !phone || !address || !Array.isArray(items) || !items.length) {
      return res.status(400).json({ message: 'Thiếu thông tin đặt hàng' });
    }
    const total = items.reduce((sum, it) => sum + (Number(it.price || 0) * (Number(it.qty || 1))), 0);
    const order = {
      id: uuidv4(),
      code: `DH-${Date.now()}`,
      customerName,
      total,
      date: new Date().toISOString(),
      status: 'pending',
      phone,
      address,
      items: JSON.stringify(items),
      createdAt: new Date().toISOString(),
    };
    await run(
      `INSERT INTO orders (id, code, customerName, total, date, status, phone, address, items, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [order.id, order.code, order.customerName, order.total, order.date, order.status, order.phone, order.address, order.items, order.createdAt]
    );
    res.json({ order });
  } catch (err) {
    res.status(500).json({ message: 'Không lưu được đơn hàng' });
  }
});

app.get('/api/bird-nests', authRequired, async (req, res) => {
  try {
    const nests = await all(`SELECT id, name, hatch_date AS hatchDate, notes FROM bird_nests WHERE user_id = ?`, [
      req.user.id,
    ]);
    res.json({ nests });
  } catch (err) {
    res.status(500).json({ message: 'Không tải được dữ liệu tổ chim' });
  }
});

app.put('/api/bird-nests', authRequired, async (req, res) => {
  const { nests } = req.body || {};
  if (!Array.isArray(nests)) {
    return res.status(400).json({ message: 'Dữ liệu không hợp lệ' });
  }
  let inTx = false;
  try {
    await run('BEGIN');
    inTx = true;
    await run(`DELETE FROM bird_nests WHERE user_id = ?`, [req.user.id]);

    for (const nest of nests) {
      const id = nest.id || uuidv4();
      await run(
        `INSERT INTO bird_nests (id, user_id, name, hatch_date, notes) VALUES (?, ?, ?, ?, ?)`,
        [id, req.user.id, nest.name || 'Tổ mới', nest.hatchDate || null, nest.notes || '']
      );
    }
    await run('COMMIT');
    inTx = false;
    const saved = await all(
      `SELECT id, name, hatch_date AS hatchDate, notes FROM bird_nests WHERE user_id = ?`,
      [req.user.id]
    );
    res.json({ nests: saved });
  } catch (err) {
    try {
      if (inTx) await run('ROLLBACK');
    } catch (_) {
      /* ignore rollback errors */
    }
    res.status(500).json({ message: 'Không lưu được dữ liệu tổ chim' });
  }
});

initDb().then(() => {
  app.listen(PORT, () => {
    console.log(`API server running at http://localhost:${PORT}`);
  });
});
