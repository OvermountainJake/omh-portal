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

  -- Teacher Compliance
  CREATE TABLE IF NOT EXISTS staff (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    center_id    INTEGER REFERENCES centers(id) ON DELETE CASCADE,
    name         TEXT NOT NULL,
    title        TEXT,
    email        TEXT,
    phone        TEXT,
    hire_date    DATE,
    status       TEXT DEFAULT 'active' CHECK(status IN ('active','inactive')),
    created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS compliance_requirements (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    name        TEXT NOT NULL,
    description TEXT,
    recurs      TEXT DEFAULT 'once' CHECK(recurs IN ('once','annual','biennial','every3years')),
    applies_to  TEXT DEFAULT 'all',
    sort_order  INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS staff_compliance (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    staff_id       INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    requirement_id INTEGER NOT NULL REFERENCES compliance_requirements(id) ON DELETE CASCADE,
    completed_date DATE,
    expiry_date    DATE,
    notes          TEXT,
    UNIQUE(staff_id, requirement_id)
  );

  -- Time Off Tracker
  CREATE TABLE IF NOT EXISTS time_off_requests (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    staff_id    INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    center_id   INTEGER REFERENCES centers(id),
    type        TEXT NOT NULL CHECK(type IN ('vacation','sick','personal','bereavement','other')),
    start_date  DATE NOT NULL,
    end_date    DATE NOT NULL,
    hours       REAL,
    status      TEXT DEFAULT 'pending' CHECK(status IN ('pending','approved','denied')),
    notes       TEXT,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS staff_pto_balances (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    staff_id     INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE UNIQUE,
    vacation_hrs REAL DEFAULT 0,
    sick_hrs     REAL DEFAULT 0,
    personal_hrs REAL DEFAULT 0,
    as_of_date   DATE,
    updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  -- Staffing Schedule
  CREATE TABLE IF NOT EXISTS schedule_shifts (
    id         INTEGER PRIMARY KEY AUTOINCREMENT,
    staff_id   INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
    center_id  INTEGER REFERENCES centers(id) ON DELETE CASCADE,
    shift_date DATE NOT NULL,
    start_time TEXT NOT NULL,
    end_time   TEXT NOT NULL,
    role       TEXT,
    notes      TEXT
  );

  -- Financial Performance
  CREATE TABLE IF NOT EXISTS financial_snapshots (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    center_id     INTEGER REFERENCES centers(id) ON DELETE CASCADE,
    period_label  TEXT NOT NULL,
    period_start  DATE NOT NULL,
    period_end    DATE NOT NULL,
    revenue       REAL DEFAULT 0,
    expenses      REAL DEFAULT 0,
    payroll       REAL DEFAULT 0,
    food_costs    REAL DEFAULT 0,
    supplies      REAL DEFAULT 0,
    utilities     REAL DEFAULT 0,
    other_exp     REAL DEFAULT 0,
    notes         TEXT,
    created_at    DATETIME DEFAULT CURRENT_TIMESTAMP
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

// Seed compliance requirements
const compCount = db.prepare('SELECT COUNT(*) as n FROM compliance_requirements').get().n;
if (compCount === 0) {
  const reqs = [
    ['Background Check', 'State background check before hire', 'once'],
    ['CPR Certification', 'Infant/Child CPR — must be in-person', 'biennial'],
    ['First Aid Certification', 'Standard first aid training', 'biennial'],
    ['Mandated Reporter Training', 'Child abuse mandated reporter (WI ch. 48)', 'annual'],
    ['Annual Health Exam', 'Physical health examination on file', 'annual'],
    ['TB Screening', 'Tuberculosis risk screening', 'annual'],
    ['Food Handler Certification', 'Food safety / ServSafe', 'every3years'],
    ['YoungStar Training Hours', 'Required training hours for YoungStar rating level', 'annual'],
    ['AHT / Shaken Baby Training', 'Abusive Head Trauma prevention', 'once'],
    ['Bloodborne Pathogens', 'OSHA bloodborne pathogens training', 'annual'],
    ['Emergency Procedures', 'Fire/evacuation/lockdown drills documented', 'annual'],
    ['Safe Sleep Training', 'SIDS/safe sleep (required for infant rooms)', 'once'],
    ['Pesticide Notification', 'Right-to-know pesticide awareness', 'annual'],
  ];
  const ins = db.prepare('INSERT INTO compliance_requirements (name, description, recurs) VALUES (?,?,?)');
  reqs.forEach(([name, desc, recurs], i) => ins.run(name, desc, recurs));
  console.log('✓ Seeded compliance requirements');
}

module.exports = db;
