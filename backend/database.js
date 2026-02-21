const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');

const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'portal.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

// ─── Schema ────────────────────────────────────────────────────────────────────

db.exec(`
  CREATE TABLE IF NOT EXISTS centers (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    name      TEXT NOT NULL,
    address   TEXT,
    city      TEXT,
    state     TEXT,
    zip       TEXT,
    lat       REAL,
    lng       REAL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS users (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name          TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    role          TEXT NOT NULL DEFAULT 'director' CHECK(role IN ('admin','director')),
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS user_centers (
    user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    center_id INTEGER NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, center_id)
  );

  CREATE TABLE IF NOT EXISTS calendar_events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    center_id   INTEGER REFERENCES centers(id) ON DELETE CASCADE,
    title       TEXT NOT NULL,
    description TEXT,
    start_date  DATE NOT NULL,
    end_date    DATE,
    all_day     INTEGER DEFAULT 1,
    category    TEXT NOT NULL DEFAULT 'management' CHECK(category IN ('management','family')),
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS handbook_pages (
    id        INTEGER PRIMARY KEY AUTOINCREMENT,
    title     TEXT NOT NULL,
    content   TEXT,
    pdf_path  TEXT,
    sort_order INTEGER DEFAULT 0,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// ─── Seed data ────────────────────────────────────────────────────────────────

const centerCount = db.prepare('SELECT COUNT(*) as n FROM centers').get().n;
if (centerCount === 0) {
  db.prepare(`INSERT INTO centers (name, city, state, zip, lat, lng)
              VALUES (?, ?, ?, ?, ?, ?)`).run(
    'Young Child Development Center', 'Appleton', 'WI', '54911', 44.2619, -88.4154
  );
  console.log('✓ Seeded YCDC center');
}

const userCount = db.prepare('SELECT COUNT(*) as n FROM users').get().n;
if (userCount === 0) {
  const adminHash = bcrypt.hashSync('ChangeMe123!', 12);
  const dave = db.prepare(`INSERT INTO users (email, name, password_hash, role) VALUES (?,?,?,?)`).run(
    'dave@overmountainholdings.com', 'Dave Thoensen', adminHash, 'admin'
  );
  const harry = db.prepare(`INSERT INTO users (email, name, password_hash, role) VALUES (?,?,?,?)`).run(
    'harry@overmountainholdings.com', 'Harry Rossman', adminHash, 'admin'
  );
  console.log('✓ Seeded admin users (Dave, Harry)');
}

module.exports = db;
