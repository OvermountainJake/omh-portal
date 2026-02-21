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

  CREATE TABLE IF NOT EXISTS weekly_menus (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    center_id   INTEGER REFERENCES centers(id) ON DELETE CASCADE,
    week_label  TEXT NOT NULL,
    week_start  DATE NOT NULL,
    week_end    DATE NOT NULL,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS menu_items (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    menu_id     INTEGER NOT NULL REFERENCES weekly_menus(id) ON DELETE CASCADE,
    day_of_week TEXT NOT NULL CHECK(day_of_week IN ('Monday','Tuesday','Wednesday','Thursday','Friday')),
    meal_type   TEXT NOT NULL CHECK(meal_type IN ('Breakfast','Lunch','Snack')),
    items       TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS ingredients (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL UNIQUE COLLATE NOCASE,
    category   TEXT DEFAULT 'general',
    unit       TEXT DEFAULT 'each',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS vendors (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    name       TEXT NOT NULL UNIQUE,
    type       TEXT DEFAULT 'grocery' CHECK(type IN ('grocery','wholesale','distributor','local')),
    notes      TEXT
  );

  CREATE TABLE IF NOT EXISTS ingredient_prices (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
    vendor_id     INTEGER NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
    center_id     INTEGER REFERENCES centers(id) ON DELETE CASCADE,
    price         REAL NOT NULL,
    unit          TEXT NOT NULL,
    notes         TEXT,
    recorded_at   DATE DEFAULT (DATE('now')),
    UNIQUE(ingredient_id, vendor_id, center_id)
  );

  CREATE TABLE IF NOT EXISTS waitlist_entries (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    center_id               INTEGER NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
    child_name              TEXT NOT NULL,
    date_of_birth           TEXT,
    desired_enrollment_time TEXT,
    parent_name             TEXT,
    phone                   TEXT,
    email                   TEXT,
    notes                   TEXT,
    last_contact            TEXT,
    signed_up_at            TEXT DEFAULT (date('now')),
    heard_about_us          TEXT,
    created_at              DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at              DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS email_senders (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    email      TEXT NOT NULL UNIQUE COLLATE NOCASE,
    name       TEXT NOT NULL,
    center_id  INTEGER NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
    active     INTEGER NOT NULL DEFAULT 1,
    last_used  TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS competitors (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    center_id         INTEGER REFERENCES centers(id) ON DELETE CASCADE,
    name              TEXT NOT NULL,
    city              TEXT,
    state             TEXT,
    zip               TEXT,
    is_ours           INTEGER DEFAULT 0,
    youngstar_rating  INTEGER,
    rates_json        TEXT DEFAULT '{}',
    notes             TEXT,
    updated_at        DATETIME DEFAULT CURRENT_TIMESTAMP
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

// Seed vendors
const vendorCount = db.prepare('SELECT COUNT(*) as n FROM vendors').get().n;
if (vendorCount === 0) {
  const vendors = [
    ['Badger Foods', 'distributor'],
    ['Aldi', 'grocery'],
    ['Walmart', 'grocery'],
    ["Sam's Club", 'wholesale'],
    ["Gordon Food Service", 'distributor'],
    ['Festival Foods', 'grocery'],
    ['Costco', 'wholesale'],
  ];
  const insertV = db.prepare('INSERT INTO vendors (name, type) VALUES (?,?)');
  vendors.forEach(([name, type]) => insertV.run(name, type));
  console.log('✓ Seeded vendors');
}

module.exports = db;
