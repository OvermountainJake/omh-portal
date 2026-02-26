const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10,
});

// Convert SQLite-style ? placeholders to PostgreSQL $1, $2, ...
function toPositional(sql) {
  let i = 0;
  return sql.replace(/\?/g, () => `$${++i}`);
}

// Flatten params for spread calls like .all(...params)
function flatten(params) {
  if (params.length === 0) return [];
  if (params.length === 1 && Array.isArray(params[0])) return params[0];
  return params;
}

class Statement {
  constructor(sql) {
    this.sql = sql;
  }

  async run(...params) {
    const flat = flatten(params);
    const pgSql = toPositional(this.sql);
    const isInsert = /^\s*INSERT/i.test(this.sql);
    const finalSql = isInsert && !/RETURNING/i.test(pgSql) ? pgSql + ' RETURNING *' : pgSql;
    try {
      const { rows, rowCount } = await pool.query(finalSql, flat.length ? flat : undefined);
      return { lastInsertRowid: rows[0]?.id ?? null, changes: rowCount };
    } catch (e) {
      throw e;
    }
  }

  async get(...params) {
    const flat = flatten(params);
    const { rows } = await pool.query(toPositional(this.sql), flat.length ? flat : undefined);
    return rows[0] ?? null;
  }

  async all(...params) {
    const flat = flatten(params);
    const { rows } = await pool.query(toPositional(this.sql), flat.length ? flat : undefined);
    return rows;
  }
}

const db = {
  prepare: (sql) => new Statement(sql),

  exec: async (sql) => {
    await pool.query(sql);
  },

  query: (sql, params) => pool.query(sql, params),

  pool,
};

// ─── Schema init ──────────────────────────────────────────────────────────────

async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS centers (
      id         SERIAL PRIMARY KEY,
      name       TEXT NOT NULL,
      address    TEXT,
      city       TEXT,
      state      TEXT,
      zip        TEXT,
      lat        REAL,
      lng        REAL,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS users (
      id            SERIAL PRIMARY KEY,
      email         TEXT NOT NULL UNIQUE,
      name          TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      role          TEXT NOT NULL DEFAULT 'director' CHECK(role IN ('admin','director')),
      created_at    TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS user_centers (
      user_id   INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      center_id INTEGER NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
      PRIMARY KEY(user_id, center_id)
    );

    CREATE TABLE IF NOT EXISTS calendar_events (
      id          SERIAL PRIMARY KEY,
      center_id   INTEGER REFERENCES centers(id) ON DELETE CASCADE,
      title       TEXT NOT NULL,
      description TEXT,
      location    TEXT,
      start_date  TEXT NOT NULL,
      end_date    TEXT,
      all_day     INTEGER DEFAULT 1,
      category    TEXT DEFAULT 'management',
      start_time  TEXT,
      end_time    TEXT,
      created_at  TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS weekly_menus (
      id          SERIAL PRIMARY KEY,
      center_id   INTEGER REFERENCES centers(id) ON DELETE CASCADE,
      week_label  TEXT,
      week_start  TEXT NOT NULL,
      week_end    TEXT,
      created_at  TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS menu_items (
      id          SERIAL PRIMARY KEY,
      menu_id     INTEGER NOT NULL REFERENCES weekly_menus(id) ON DELETE CASCADE,
      day_of_week TEXT NOT NULL,
      meal_type   TEXT NOT NULL,
      items       TEXT
    );

    CREATE TABLE IF NOT EXISTS ingredients (
      id         SERIAL PRIMARY KEY,
      name       TEXT NOT NULL UNIQUE,
      category   TEXT DEFAULT 'general',
      unit       TEXT DEFAULT 'each',
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS vendors (
      id      SERIAL PRIMARY KEY,
      name    TEXT NOT NULL UNIQUE,
      type    TEXT DEFAULT 'grocery' CHECK(type IN ('grocery','wholesale','distributor','local')),
      notes   TEXT,
      website TEXT
    );

    CREATE TABLE IF NOT EXISTS ingredient_prices (
      id            SERIAL PRIMARY KEY,
      ingredient_id INTEGER NOT NULL REFERENCES ingredients(id) ON DELETE CASCADE,
      vendor_id     INTEGER NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,
      center_id     INTEGER REFERENCES centers(id) ON DELETE CASCADE,
      price         REAL NOT NULL,
      unit          TEXT NOT NULL,
      notes         TEXT,
      recorded_at   TEXT DEFAULT CURRENT_DATE
    );

    CREATE TABLE IF NOT EXISTS waitlist_entries (
      id                     SERIAL PRIMARY KEY,
      center_id              INTEGER REFERENCES centers(id) ON DELETE CASCADE,
      child_name             TEXT NOT NULL,
      date_of_birth          TEXT,
      desired_enrollment_time TEXT,
      parent_name            TEXT,
      phone                  TEXT,
      email                  TEXT,
      notes                  TEXT,
      status                 TEXT DEFAULT 'waiting',
      last_contact           TEXT,
      signed_up_at           TEXT DEFAULT CURRENT_DATE,
      heard_about_us         TEXT,
      is_expected            INTEGER DEFAULT 0,
      updated_at             TIMESTAMP DEFAULT NOW(),
      created_at             TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS email_senders (
      id          SERIAL PRIMARY KEY,
      email       TEXT NOT NULL UNIQUE,
      name        TEXT NOT NULL,
      center_id   INTEGER NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
      active      INTEGER DEFAULT 1,
      last_used   TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS competitors (
      id               SERIAL PRIMARY KEY,
      center_id        INTEGER REFERENCES centers(id) ON DELETE SET NULL,
      name             TEXT NOT NULL,
      city             TEXT,
      state            TEXT,
      zip              TEXT,
      is_ours          INTEGER DEFAULT 0,
      youngstar_rating INTEGER,
      rates_json       TEXT DEFAULT '{}',
      notes            TEXT,
      rates_published  INTEGER DEFAULT 1,
      updated_at       TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS handbook_pages (
      id         SERIAL PRIMARY KEY,
      slug       TEXT UNIQUE,
      title      TEXT NOT NULL,
      content    TEXT,
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS staff (
      id         SERIAL PRIMARY KEY,
      center_id  INTEGER REFERENCES centers(id) ON DELETE SET NULL,
      name       TEXT NOT NULL,
      title      TEXT,
      email      TEXT,
      phone      TEXT,
      hire_date  TEXT,
      status     TEXT DEFAULT 'active',
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS compliance_requirements (
      id          SERIAL PRIMARY KEY,
      name        TEXT NOT NULL,
      description TEXT,
      recurs      TEXT DEFAULT 'annual',
      sort_order  INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS staff_compliance (
      id              SERIAL PRIMARY KEY,
      staff_id        INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
      requirement_id  INTEGER NOT NULL REFERENCES compliance_requirements(id) ON DELETE CASCADE,
      completed_date  TEXT,
      expiry_date     TEXT,
      notes           TEXT,
      UNIQUE(staff_id, requirement_id)
    );

    CREATE TABLE IF NOT EXISTS time_off_requests (
      id         SERIAL PRIMARY KEY,
      staff_id   INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
      center_id  INTEGER REFERENCES centers(id) ON DELETE SET NULL,
      type       TEXT NOT NULL,
      start_date TEXT NOT NULL,
      end_date   TEXT NOT NULL,
      hours      REAL,
      notes      TEXT,
      status     TEXT DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS staff_pto_balances (
      id           SERIAL PRIMARY KEY,
      staff_id     INTEGER NOT NULL UNIQUE REFERENCES staff(id) ON DELETE CASCADE,
      vacation_hrs REAL DEFAULT 0,
      sick_hrs     REAL DEFAULT 0,
      personal_hrs REAL DEFAULT 0,
      as_of_date   TEXT,
      updated_at   TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS schedule_shifts (
      id         SERIAL PRIMARY KEY,
      staff_id   INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
      center_id  INTEGER REFERENCES centers(id) ON DELETE CASCADE,
      shift_date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time   TEXT NOT NULL,
      role       TEXT,
      notes      TEXT
    );

    CREATE TABLE IF NOT EXISTS financial_snapshots (
      id           SERIAL PRIMARY KEY,
      center_id    INTEGER NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
      period_label TEXT,
      period_start TEXT NOT NULL,
      period_end   TEXT,
      revenue      REAL DEFAULT 0,
      expenses     REAL DEFAULT 0,
      payroll      REAL DEFAULT 0,
      food_costs   REAL DEFAULT 0,
      supplies     REAL DEFAULT 0,
      utilities    REAL DEFAULT 0,
      other_exp    REAL DEFAULT 0,
      notes        TEXT,
      created_at   TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS recipes (
      id          SERIAL PRIMARY KEY,
      center_id   INTEGER REFERENCES centers(id) ON DELETE SET NULL,
      name        TEXT NOT NULL,
      category    TEXT,
      servings    INTEGER DEFAULT 1,
      ingredients TEXT DEFAULT '[]',
      steps       TEXT DEFAULT '[]',
      notes       TEXT,
      created_at  TIMESTAMP DEFAULT NOW(),
      updated_at  TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS center_compliance (
      id              SERIAL PRIMARY KEY,
      center_id       INTEGER NOT NULL REFERENCES centers(id) ON DELETE CASCADE,
      name            TEXT NOT NULL,
      type            TEXT DEFAULT 'licensing',
      description     TEXT,
      state           TEXT,
      due_date        TEXT,
      completed_date  TEXT,
      recurs          TEXT DEFAULT 'annual',
      notes           TEXT,
      created_at      TIMESTAMP DEFAULT NOW(),
      updated_at      TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS staff_points (
      id          SERIAL PRIMARY KEY,
      staff_id    INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
      type        TEXT NOT NULL,
      points      REAL NOT NULL,
      notes       TEXT,
      recorded_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
      event_date  TEXT DEFAULT CURRENT_DATE,
      created_at  TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS staff_reviews (
      id             SERIAL PRIMARY KEY,
      staff_id       INTEGER NOT NULL REFERENCES staff(id) ON DELETE CASCADE,
      review_period  TEXT NOT NULL,
      positives      TEXT,
      growth_areas   TEXT,
      focus_areas    TEXT,
      notes          TEXT,
      reviewed_by    INTEGER REFERENCES users(id) ON DELETE SET NULL,
      created_at     TIMESTAMP DEFAULT NOW(),
      updated_at     TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS handbook_documents (
      id         SERIAL PRIMARY KEY,
      type       TEXT NOT NULL CHECK(type IN ('director','staff','parent')),
      title      TEXT NOT NULL,
      file_url   TEXT,
      notes      TEXT,
      updated_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS settings (
      key   TEXT PRIMARY KEY,
      value TEXT
    );
  `);
}

// ─── Migrations ────────────────────────────────────────────────────────────────

async function runMigrations() {
  // Add website column to vendors if not already present
  await pool.query(`ALTER TABLE vendors ADD COLUMN IF NOT EXISTS website TEXT`);

  // Populate known vendor websites (safe to run repeatedly — only sets where null)
  const knownWebsites = [
    ['Walmart',               'walmart.com'],
    ['Aldi',                  'aldi.us'],
    ['Costco',                'costco.com'],
    ["Sam's Club",            'samsclub.com'],
    ['Gordon Food Service',   'gfs.com'],
    ['Festival Foods',        'festivalbfoods.com'],
  ];
  for (const [name, website] of knownWebsites) {
    await pool.query(`UPDATE vendors SET website = $1 WHERE name = $2 AND (website IS NULL OR website = '')`, [website, name]);
  }
}

// ─── Seed data ─────────────────────────────────────────────────────────────────

async function seedIfEmpty() {
  // Admin user
  const userCount = (await pool.query('SELECT COUNT(*) as n FROM users')).rows[0].n;
  if (parseInt(userCount) === 0) {
    await pool.query(
      `INSERT INTO users (email, name, password_hash, role) VALUES ($1,$2,$3,$4),($5,$6,$7,$8) ON CONFLICT DO NOTHING`,
      [
        'dave@overmountainholdings.com', 'Dave', bcrypt.hashSync('ChangeMe123!', 12), 'admin',
        'harry@overmountainholdings.com', 'Harry', bcrypt.hashSync('ChangeMe123!', 12), 'admin',
      ]
    );
    console.log('✓ Seeded users');
  }

  // Vendors
  const vendorCount = (await pool.query('SELECT COUNT(*) as n FROM vendors')).rows[0].n;
  if (parseInt(vendorCount) === 0) {
    await pool.query(`
      INSERT INTO vendors (name, type) VALUES
        ('Badger Foods', 'distributor'),
        ('Aldi', 'grocery'),
        ('Walmart', 'grocery'),
        ('Sam''s Club', 'wholesale'),
        ('Gordon Food Service', 'distributor'),
        ('Festival Foods', 'grocery'),
        ('Costco', 'wholesale')
      ON CONFLICT DO NOTHING
    `);
    console.log('✓ Seeded vendors');
  }
}

// ─── Boot ──────────────────────────────────────────────────────────────────────

let initialized = false;
async function ensureReady() {
  if (initialized) return;
  if (!process.env.DATABASE_URL) {
    console.error('❌ DATABASE_URL is not set. In Railway: go to your web service → Variables → add DATABASE_URL referencing your Postgres service.');
    process.exit(1);
  }
  try {
    await initSchema();
    await runMigrations();
    await seedIfEmpty();
    initialized = true;
    console.log('✓ Database ready (PostgreSQL)');
  } catch (err) {
    console.error('❌ Database init failed:', err.message);
    console.error('   Check that DATABASE_URL is set and the Postgres service is running.');
    process.exit(1);
  }
}

ensureReady();

module.exports = db;
