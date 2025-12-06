// Script khởi tạo admin mặc định vào SQLite
const sqlite3 = require('sqlite3').verbose();
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const DB_PATH = path.join(__dirname, 'data.db');
const db = new sqlite3.Database(DB_PATH);

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

async function main() {
  await run(`CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    passwordHash TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'user',
    createdAt TEXT NOT NULL
  )`);

  const admin = await get(`SELECT id FROM users WHERE role = 'admin' LIMIT 1`);
  if (admin) {
    console.log('Admin đã tồn tại, không cần khởi tạo.');
    process.exit(0);
  }

  const passwordHash = await bcrypt.hash('admin123', 10);
  await run(
    `INSERT INTO users (id, name, email, passwordHash, role, createdAt)
     VALUES (?, ?, ?, ?, 'admin', ?)`,
    [uuidv4(), 'Quản trị viên', 'admin@farm.com', passwordHash, new Date().toISOString()]
  );
  console.log('Đã tạo admin: admin@farm.com / admin123');
  process.exit(0);
}

main().catch((err) => {
  console.error('Lỗi khởi tạo admin:', err.message);
  process.exit(1);
});
