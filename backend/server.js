const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const db = require('./database');
const { signToken, requireAuth, requireAdmin, requireCenterAccess, COOKIE_NAME, SESSION_DAYS } = require('./auth');

const app = express();
const PORT = process.env.PORT || 3002;
const IS_PROD = process.env.NODE_ENV === 'production';

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());
app.use(cookieParser());

// Serve built React frontend
const FRONTEND_BUILD = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(FRONTEND_BUILD)) {
  app.use(express.static(FRONTEND_BUILD));
}

// ─── Auth ──────────────────────────────────────────────────────────────────────

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' });

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim());
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = signToken(user);
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    secure: IS_PROD,
    sameSite: 'lax',
    maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000,
  });

  const centers = db.prepare(`
    SELECT c.* FROM centers c
    JOIN user_centers uc ON c.id = uc.center_id
    WHERE uc.user_id = ?
  `).all(user.id);

  const accessibleCenters = user.role === 'admin'
    ? db.prepare('SELECT * FROM centers ORDER BY name').all()
    : centers;

  res.json({ id: user.id, email: user.email, name: user.name, role: user.role, centers: accessibleCenters });
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

app.get('/api/auth/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT id, email, name, role FROM users WHERE id = ?').get(req.user.id);
  const centers = user.role === 'admin'
    ? db.prepare('SELECT * FROM centers ORDER BY name').all()
    : db.prepare(`SELECT c.* FROM centers c JOIN user_centers uc ON c.id = uc.center_id WHERE uc.user_id = ? ORDER BY c.name`).all(user.id);
  res.json({ ...user, centers });
});

app.post('/api/auth/change-password', requireAuth, (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both passwords required' });
  if (newPassword.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
  if (!bcrypt.compareSync(currentPassword, user.password_hash)) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(newPassword, 12), req.user.id);
  res.json({ ok: true });
});

// ─── Centers ───────────────────────────────────────────────────────────────────

app.get('/api/centers', requireAuth, (req, res) => {
  const centers = req.user.role === 'admin'
    ? db.prepare('SELECT * FROM centers ORDER BY name').all()
    : db.prepare(`SELECT c.* FROM centers c JOIN user_centers uc ON c.id = uc.center_id WHERE uc.user_id = ? ORDER BY c.name`).all(req.user.id);
  res.json(centers);
});

app.post('/api/centers', requireAuth, requireAdmin, (req, res) => {
  const { name, address, city, state, zip, lat, lng } = req.body;
  if (!name) return res.status(400).json({ error: 'Center name required' });
  const result = db.prepare(`INSERT INTO centers (name, address, city, state, zip, lat, lng) VALUES (?,?,?,?,?,?,?)`).run(name, address, city, state, zip, lat, lng);
  res.json(db.prepare('SELECT * FROM centers WHERE id = ?').get(result.lastInsertRowid));
});

app.put('/api/centers/:id', requireAuth, requireAdmin, (req, res) => {
  const { name, address, city, state, zip, lat, lng } = req.body;
  db.prepare(`UPDATE centers SET name=?, address=?, city=?, state=?, zip=?, lat=?, lng=? WHERE id=?`)
    .run(name, address, city, state, zip, lat, lng, req.params.id);
  res.json(db.prepare('SELECT * FROM centers WHERE id = ?').get(req.params.id));
});

// ─── Users (admin) ─────────────────────────────────────────────────────────────

app.get('/api/users', requireAuth, requireAdmin, (req, res) => {
  const users = db.prepare('SELECT id, email, name, role, created_at FROM users ORDER BY name').all();
  const centers = db.prepare('SELECT user_id, center_id FROM user_centers').all();
  const centerMap = {};
  centers.forEach(({ user_id, center_id }) => {
    if (!centerMap[user_id]) centerMap[user_id] = [];
    centerMap[user_id].push(center_id);
  });
  res.json(users.map(u => ({ ...u, center_ids: centerMap[u.id] || [] })));
});

app.post('/api/users', requireAuth, requireAdmin, (req, res) => {
  const { email, name, password, role, center_ids } = req.body;
  if (!email || !name || !password) return res.status(400).json({ error: 'Email, name, and password required' });
  if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

  const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email.trim());
  if (existing) return res.status(409).json({ error: 'Email already in use' });

  const hash = bcrypt.hashSync(password, 12);
  const result = db.prepare(`INSERT INTO users (email, name, password_hash, role) VALUES (?,?,?,?)`).run(email.trim(), name, hash, role || 'director');
  const userId = result.lastInsertRowid;

  if (Array.isArray(center_ids)) {
    const insertCenter = db.prepare('INSERT OR IGNORE INTO user_centers (user_id, center_id) VALUES (?,?)');
    center_ids.forEach(cid => insertCenter.run(userId, cid));
  }

  res.json({ id: userId, email, name, role: role || 'director', center_ids: center_ids || [] });
});

app.put('/api/users/:id', requireAuth, requireAdmin, (req, res) => {
  const { name, role, center_ids, password } = req.body;
  if (name) db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, req.params.id);
  if (role) db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
  if (password && password.length >= 8) {
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(password, 12), req.params.id);
  }
  if (Array.isArray(center_ids)) {
    db.prepare('DELETE FROM user_centers WHERE user_id = ?').run(req.params.id);
    const insertCenter = db.prepare('INSERT OR IGNORE INTO user_centers (user_id, center_id) VALUES (?,?)');
    center_ids.forEach(cid => insertCenter.run(req.params.id, cid));
  }
  res.json({ ok: true });
});

app.delete('/api/users/:id', requireAuth, requireAdmin, (req, res) => {
  db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ─── Calendar ──────────────────────────────────────────────────────────────────

app.get('/api/centers/:centerId/calendar', requireAuth, requireCenterAccess, (req, res) => {
  const { month, year } = req.query;
  let query = 'SELECT * FROM calendar_events WHERE (center_id = ? OR center_id IS NULL)';
  const params = [req.params.centerId];
  if (month && year) {
    query += ` AND strftime('%Y-%m', start_date) = ?`;
    params.push(`${year}-${String(month).padStart(2,'0')}`);
  }
  query += ' ORDER BY start_date ASC';
  res.json(db.prepare(query).all(...params));
});

app.post('/api/centers/:centerId/calendar', requireAuth, requireAdmin, (req, res) => {
  const { title, description, start_date, end_date, all_day, category } = req.body;
  if (!title || !start_date) return res.status(400).json({ error: 'Title and start date required' });
  const result = db.prepare(`
    INSERT INTO calendar_events (center_id, title, description, start_date, end_date, all_day, category)
    VALUES (?,?,?,?,?,?,?)
  `).run(req.params.centerId, title, description, start_date, end_date, all_day ?? 1, category || 'management');
  res.json(db.prepare('SELECT * FROM calendar_events WHERE id = ?').get(result.lastInsertRowid));
});

app.put('/api/calendar/:id', requireAuth, requireAdmin, (req, res) => {
  const { title, description, start_date, end_date, all_day, category } = req.body;
  db.prepare(`UPDATE calendar_events SET title=?, description=?, start_date=?, end_date=?, all_day=?, category=? WHERE id=?`)
    .run(title, description, start_date, end_date, all_day ?? 1, category, req.params.id);
  res.json(db.prepare('SELECT * FROM calendar_events WHERE id = ?').get(req.params.id));
});

app.delete('/api/calendar/:id', requireAuth, requireAdmin, (req, res) => {
  db.prepare('DELETE FROM calendar_events WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ─── Waitlist ──────────────────────────────────────────────────────────────────

app.get('/api/centers/:centerId/waitlist', requireAuth, requireCenterAccess, (req, res) => {
  res.json(db.prepare('SELECT * FROM waitlist_entries WHERE center_id = ? ORDER BY signed_up_at DESC').all(req.params.centerId));
});

app.post('/api/centers/:centerId/waitlist', requireAuth, requireAdmin, (req, res) => {
  const { child_name, date_of_birth, desired_enrollment_time, parent_name, phone, email, notes, last_contact, signed_up_at, heard_about_us } = req.body;
  if (!child_name?.trim()) return res.status(400).json({ error: 'Child name is required' });
  const r = db.prepare(`
    INSERT INTO waitlist_entries (center_id, child_name, date_of_birth, desired_enrollment_time, parent_name, phone, email, notes, last_contact, signed_up_at, heard_about_us)
    VALUES (?,?,?,?,?,?,?,?,?,?,?)
  `).run(req.params.centerId, child_name.trim(), date_of_birth||null, desired_enrollment_time||null, parent_name||null, phone||null, email||null, notes||null, last_contact||null, signed_up_at||new Date().toISOString().split('T')[0], heard_about_us||null);
  res.status(201).json(db.prepare('SELECT * FROM waitlist_entries WHERE id = ?').get(r.lastInsertRowid));
});

app.put('/api/centers/:centerId/waitlist/:id', requireAuth, requireAdmin, (req, res) => {
  const { child_name, date_of_birth, desired_enrollment_time, parent_name, phone, email, notes, last_contact, signed_up_at, heard_about_us } = req.body;
  db.prepare(`UPDATE waitlist_entries SET child_name=?,date_of_birth=?,desired_enrollment_time=?,parent_name=?,phone=?,email=?,notes=?,last_contact=?,signed_up_at=?,heard_about_us=?,updated_at=CURRENT_TIMESTAMP WHERE id=? AND center_id=?`)
    .run(child_name, date_of_birth||null, desired_enrollment_time||null, parent_name||null, phone||null, email||null, notes||null, last_contact||null, signed_up_at, heard_about_us||null, req.params.id, req.params.centerId);
  res.json(db.prepare('SELECT * FROM waitlist_entries WHERE id = ?').get(req.params.id));
});

app.delete('/api/centers/:centerId/waitlist/:id', requireAuth, requireAdmin, (req, res) => {
  db.prepare('DELETE FROM waitlist_entries WHERE id = ? AND center_id = ?').run(req.params.id, req.params.centerId);
  res.json({ ok: true });
});

// Email senders (for waitlist email intake)
app.get('/api/email-senders', requireAuth, requireAdmin, (req, res) => {
  res.json(db.prepare('SELECT es.*, c.name as center_name FROM email_senders es JOIN centers c ON c.id = es.center_id ORDER BY es.name').all());
});

app.post('/api/email-senders', requireAuth, requireAdmin, (req, res) => {
  const { email, name, center_id } = req.body;
  if (!email || !name || !center_id) return res.status(400).json({ error: 'Email, name, and center required' });
  try {
    const r = db.prepare('INSERT INTO email_senders (email, name, center_id) VALUES (?,?,?)').run(email.trim().toLowerCase(), name.trim(), center_id);
    res.json(db.prepare('SELECT es.*, c.name as center_name FROM email_senders es JOIN centers c ON c.id = es.center_id WHERE es.id = ?').get(r.lastInsertRowid));
  } catch { res.status(409).json({ error: 'That email is already an approved sender' }); }
});

app.put('/api/email-senders/:id', requireAuth, requireAdmin, (req, res) => {
  const { active } = req.body;
  if (active !== undefined) db.prepare('UPDATE email_senders SET active = ? WHERE id = ?').run(active ? 1 : 0, req.params.id);
  res.json({ ok: true });
});

app.delete('/api/email-senders/:id', requireAuth, requireAdmin, (req, res) => {
  db.prepare('DELETE FROM email_senders WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// Internal email intake (no user auth — used by email processor script)
app.post('/api/email-intake', (req, res) => {
  const { secret, sender_email, entry } = req.body;
  if (secret !== process.env.INTERNAL_SECRET) return res.status(403).json({ error: 'Forbidden' });
  const sender = db.prepare('SELECT * FROM email_senders WHERE email = ? AND active = 1').get(sender_email?.toLowerCase());
  if (!sender) return res.status(403).json({ error: 'Sender not authorized' });
  const { child_name, date_of_birth, desired_enrollment_time, parent_name, phone, email, notes, heard_about_us } = entry;
  if (!child_name?.trim()) return res.status(400).json({ error: 'Child name is required' });
  const r = db.prepare(`INSERT INTO waitlist_entries (center_id, child_name, date_of_birth, desired_enrollment_time, parent_name, phone, email, notes, signed_up_at, heard_about_us) VALUES (?,?,?,?,?,?,?,?,?,?)`)
    .run(sender.center_id, child_name.trim(), date_of_birth||null, desired_enrollment_time||null, parent_name||null, phone||null, email||null, notes||`Added via email from ${sender.name}`, new Date().toISOString().split('T')[0], heard_about_us||null);
  db.prepare("UPDATE email_senders SET last_used = datetime('now') WHERE id = ?").run(sender.id);
  res.status(201).json(db.prepare('SELECT * FROM waitlist_entries WHERE id = ?').get(r.lastInsertRowid));
});

// Internal: check sender auth
app.post('/api/email-senders/check', (req, res) => {
  const { email, secret } = req.body;
  if (secret !== process.env.INTERNAL_SECRET) return res.status(403).json({ error: 'Forbidden' });
  const sender = db.prepare('SELECT es.*, c.name as center_name FROM email_senders es JOIN centers c ON c.id = es.center_id WHERE es.email = ? AND es.active = 1').get(email?.toLowerCase());
  if (!sender) return res.status(404).json({ error: 'Not approved' });
  res.json(sender);
});

// ─── Competitive Analysis ─────────────────────────────────────────────────────

app.get('/api/competitors', requireAuth, (req, res) => {
  const { center_id } = req.query;
  const rows = center_id
    ? db.prepare('SELECT * FROM competitors WHERE center_id = ? ORDER BY is_ours DESC, name ASC').all(center_id)
    : db.prepare('SELECT * FROM competitors ORDER BY is_ours DESC, name ASC').all();
  res.json(rows.map(r => ({ ...r, is_ours: !!r.is_ours, rates: JSON.parse(r.rates_json || '{}') })));
});

app.post('/api/competitors', requireAuth, requireAdmin, (req, res) => {
  const { name, city, state, zip, is_ours, youngstar_rating, rates, notes, center_id } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const r = db.prepare(`
    INSERT INTO competitors (center_id, name, city, state, zip, is_ours, youngstar_rating, rates_json, notes)
    VALUES (?,?,?,?,?,?,?,?,?)
  `).run(center_id || null, name, city, state, zip, is_ours ? 1 : 0, youngstar_rating || null, JSON.stringify(rates || {}), notes);
  res.json({ id: r.lastInsertRowid, name, city, state, is_ours: !!is_ours, youngstar_rating, rates: rates || {} });
});

app.put('/api/competitors/:id', requireAuth, requireAdmin, (req, res) => {
  const { name, city, state, zip, is_ours, youngstar_rating, rates, notes } = req.body;
  db.prepare(`UPDATE competitors SET name=?,city=?,state=?,zip=?,is_ours=?,youngstar_rating=?,rates_json=?,notes=?,updated_at=CURRENT_TIMESTAMP WHERE id=?`)
    .run(name, city, state, zip, is_ours ? 1 : 0, youngstar_rating || null, JSON.stringify(rates || {}), notes, req.params.id);
  res.json({ ok: true });
});

app.delete('/api/competitors/:id', requireAuth, requireAdmin, (req, res) => {
  db.prepare('DELETE FROM competitors WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ─── Food Pricing ──────────────────────────────────────────────────────────────

app.get('/api/vendors', requireAuth, (req, res) => {
  res.json(db.prepare('SELECT * FROM vendors ORDER BY name').all());
});

app.post('/api/vendors', requireAuth, requireAdmin, (req, res) => {
  const { name, type, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'Vendor name required' });
  const r = db.prepare('INSERT INTO vendors (name, type, notes) VALUES (?,?,?)').run(name, type || 'grocery', notes);
  res.json(db.prepare('SELECT * FROM vendors WHERE id = ?').get(r.lastInsertRowid));
});

app.get('/api/ingredients', requireAuth, (req, res) => {
  const ingredients = db.prepare('SELECT * FROM ingredients ORDER BY name').all();
  const prices = db.prepare('SELECT ip.*, v.name as vendor_name FROM ingredient_prices ip JOIN vendors v ON v.id = ip.vendor_id').all();
  const priceMap = {};
  prices.forEach(p => {
    if (!priceMap[p.ingredient_id]) priceMap[p.ingredient_id] = [];
    priceMap[p.ingredient_id].push(p);
  });
  res.json(ingredients.map(i => ({ ...i, prices: priceMap[i.id] || [] })));
});

app.post('/api/ingredients', requireAuth, requireAdmin, (req, res) => {
  const { name, category, unit } = req.body;
  if (!name) return res.status(400).json({ error: 'Ingredient name required' });
  try {
    const r = db.prepare('INSERT INTO ingredients (name, category, unit) VALUES (?,?,?)').run(name, category || 'general', unit || 'each');
    res.json(db.prepare('SELECT * FROM ingredients WHERE id = ?').get(r.lastInsertRowid));
  } catch {
    res.status(409).json({ error: 'Ingredient already exists' });
  }
});

app.put('/api/ingredients/:id/prices', requireAuth, requireAdmin, (req, res) => {
  const { prices } = req.body; // [{ vendor_id, price, unit, center_id }]
  if (!Array.isArray(prices)) return res.status(400).json({ error: 'prices must be an array' });
  const upsert = db.prepare(`
    INSERT INTO ingredient_prices (ingredient_id, vendor_id, center_id, price, unit)
    VALUES (?,?,?,?,?)
    ON CONFLICT(ingredient_id, vendor_id, center_id) DO UPDATE SET price=excluded.price, unit=excluded.unit, recorded_at=DATE('now')
  `);
  const tx = db.transaction(() => prices.forEach(p => upsert.run(req.params.id, p.vendor_id, p.center_id || null, p.price, p.unit || 'each')));
  tx();
  res.json({ ok: true });
});

app.get('/api/ingredients/compare', requireAuth, (req, res) => {
  const rows = db.prepare(`
    SELECT i.name as ingredient, i.unit as default_unit, v.name as vendor, ip.price, ip.unit, ip.recorded_at
    FROM ingredient_prices ip
    JOIN ingredients i ON i.id = ip.ingredient_id
    JOIN vendors v ON v.id = ip.vendor_id
    ORDER BY i.name, ip.price ASC
  `).all();

  // Group by ingredient
  const grouped = {};
  rows.forEach(r => {
    if (!grouped[r.ingredient]) grouped[r.ingredient] = { ingredient: r.ingredient, vendors: [] };
    grouped[r.ingredient].vendors.push({ vendor: r.vendor, price: r.price, unit: r.unit });
  });
  res.json(Object.values(grouped));
});

// Menus
app.get('/api/centers/:centerId/menus', requireAuth, requireCenterAccess, (req, res) => {
  const menus = db.prepare('SELECT * FROM weekly_menus WHERE center_id = ? ORDER BY week_start DESC').all(req.params.centerId);
  const items = db.prepare('SELECT * FROM menu_items WHERE menu_id IN (SELECT id FROM weekly_menus WHERE center_id = ?)').all(req.params.centerId);
  const itemMap = {};
  items.forEach(i => { if (!itemMap[i.menu_id]) itemMap[i.menu_id] = []; itemMap[i.menu_id].push(i); });
  res.json(menus.map(m => ({ ...m, items: itemMap[m.id] || [] })));
});

app.post('/api/centers/:centerId/menus', requireAuth, requireAdmin, (req, res) => {
  const { week_label, week_start, week_end, items } = req.body;
  if (!week_start) return res.status(400).json({ error: 'week_start required' });
  const r = db.prepare('INSERT INTO weekly_menus (center_id, week_label, week_start, week_end) VALUES (?,?,?,?)').run(req.params.centerId, week_label || `Week of ${week_start}`, week_start, week_end || week_start);
  if (Array.isArray(items)) {
    const ins = db.prepare('INSERT INTO menu_items (menu_id, day_of_week, meal_type, items) VALUES (?,?,?,?)');
    const tx = db.transaction(() => items.forEach(i => ins.run(r.lastInsertRowid, i.day_of_week, i.meal_type, i.items)));
    tx();
  }
  res.json({ id: r.lastInsertRowid, week_label, week_start, week_end });
});

// ─── Dashboard Summary ─────────────────────────────────────────────────────────

app.get('/api/dashboard', requireAuth, (req, res) => {
  // Placeholder — will populate as sub-apps are built
  const centers = req.user.role === 'admin'
    ? db.prepare('SELECT * FROM centers').all()
    : db.prepare(`SELECT c.* FROM centers c JOIN user_centers uc ON c.id = uc.center_id WHERE uc.user_id = ?`).all(req.user.id);

  const today = new Date().toISOString().slice(0, 10);
  const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

  const upcomingEvents = db.prepare(`
    SELECT * FROM calendar_events
    WHERE start_date BETWEEN ? AND ?
    ORDER BY start_date ASC LIMIT 10
  `).all(today, nextWeek);

  res.json({ centers, upcomingEvents, stats: {} });
});

// ─── Staff / Employee Directory ────────────────────────────────────────────────

app.get('/api/staff', requireAuth, (req, res) => {
  const { center_id } = req.query;
  const rows = center_id
    ? db.prepare('SELECT * FROM staff WHERE center_id = ? ORDER BY name').all(center_id)
    : req.user.role === 'admin'
      ? db.prepare('SELECT s.*, c.name as center_name FROM staff s LEFT JOIN centers c ON c.id = s.center_id ORDER BY s.name').all()
      : db.prepare('SELECT s.*, c.name as center_name FROM staff s LEFT JOIN centers c ON c.id = s.center_id JOIN user_centers uc ON uc.center_id = s.center_id WHERE uc.user_id = ? ORDER BY s.name').all(req.user.id);
  res.json(rows);
});

app.post('/api/staff', requireAuth, requireAdmin, (req, res) => {
  const { name, title, email, phone, hire_date, center_id, status } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const r = db.prepare('INSERT INTO staff (name, title, email, phone, hire_date, center_id, status) VALUES (?,?,?,?,?,?,?)').run(name, title||null, email||null, phone||null, hire_date||null, center_id||null, status||'active');
  db.prepare('INSERT OR IGNORE INTO staff_pto_balances (staff_id) VALUES (?)').run(r.lastInsertRowid);
  res.json(db.prepare('SELECT * FROM staff WHERE id = ?').get(r.lastInsertRowid));
});

app.put('/api/staff/:id', requireAuth, requireAdmin, (req, res) => {
  const { name, title, email, phone, hire_date, center_id, status } = req.body;
  db.prepare('UPDATE staff SET name=?,title=?,email=?,phone=?,hire_date=?,center_id=?,status=? WHERE id=?').run(name, title||null, email||null, phone||null, hire_date||null, center_id||null, status||'active', req.params.id);
  res.json({ ok: true });
});

app.delete('/api/staff/:id', requireAuth, requireAdmin, (req, res) => {
  db.prepare('DELETE FROM staff WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ─── Teacher Compliance ────────────────────────────────────────────────────────

app.get('/api/compliance/requirements', requireAuth, (req, res) => {
  res.json(db.prepare('SELECT * FROM compliance_requirements ORDER BY sort_order, name').all());
});

app.get('/api/compliance/staff/:staffId', requireAuth, (req, res) => {
  const records = db.prepare('SELECT sc.*, cr.name as req_name, cr.recurs, cr.description FROM staff_compliance sc JOIN compliance_requirements cr ON cr.id = sc.requirement_id WHERE sc.staff_id = ?').all(req.params.staffId);
  res.json(records);
});

app.get('/api/compliance/center/:centerId', requireAuth, requireCenterAccess, (req, res) => {
  const staff = db.prepare('SELECT * FROM staff WHERE center_id = ? AND status = ?').all(req.params.centerId, 'active');
  const reqs = db.prepare('SELECT * FROM compliance_requirements ORDER BY name').all();
  const records = db.prepare('SELECT sc.* FROM staff_compliance sc JOIN staff s ON s.id = sc.staff_id WHERE s.center_id = ?').all(req.params.centerId);
  const today = new Date().toISOString().slice(0, 10);

  const matrix = staff.map(s => ({
    staff: s,
    compliance: reqs.map(r => {
      const rec = records.find(x => x.staff_id === s.id && x.requirement_id === r.id);
      let statusVal = 'missing';
      if (rec?.completed_date) {
        if (!rec.expiry_date || rec.expiry_date >= today) statusVal = 'current';
        else if (rec.expiry_date < today) statusVal = 'expired';
      }
      return { requirement: r, record: rec || null, status: statusVal };
    }),
  }));
  res.json({ staff, requirements: reqs, matrix });
});

app.post('/api/compliance', requireAuth, requireAdmin, (req, res) => {
  const { staff_id, requirement_id, completed_date, expiry_date, notes } = req.body;
  db.prepare(`INSERT INTO staff_compliance (staff_id, requirement_id, completed_date, expiry_date, notes)
    VALUES (?,?,?,?,?)
    ON CONFLICT(staff_id, requirement_id) DO UPDATE SET completed_date=excluded.completed_date, expiry_date=excluded.expiry_date, notes=excluded.notes`)
    .run(staff_id, requirement_id, completed_date||null, expiry_date||null, notes||null);
  res.json({ ok: true });
});

// ─── Time Off Tracker ─────────────────────────────────────────────────────────

app.get('/api/timeoff', requireAuth, (req, res) => {
  const { center_id, staff_id, status } = req.query;
  let q = 'SELECT tor.*, s.name as staff_name, s.title as staff_title FROM time_off_requests tor JOIN staff s ON s.id = tor.staff_id WHERE 1=1';
  const params = [];
  if (center_id) { q += ' AND tor.center_id = ?'; params.push(center_id); }
  if (staff_id) { q += ' AND tor.staff_id = ?'; params.push(staff_id); }
  if (status) { q += ' AND tor.status = ?'; params.push(status); }
  q += ' ORDER BY tor.start_date DESC';
  res.json(db.prepare(q).all(...params));
});

app.post('/api/timeoff', requireAuth, requireAdmin, (req, res) => {
  const { staff_id, center_id, type, start_date, end_date, hours, notes } = req.body;
  if (!staff_id || !type || !start_date || !end_date) return res.status(400).json({ error: 'staff_id, type, start_date, end_date required' });
  const r = db.prepare('INSERT INTO time_off_requests (staff_id, center_id, type, start_date, end_date, hours, notes, status) VALUES (?,?,?,?,?,?,?,?)').run(staff_id, center_id||null, type, start_date, end_date, hours||null, notes||null, 'approved');
  res.json(db.prepare('SELECT * FROM time_off_requests WHERE id = ?').get(r.lastInsertRowid));
});

app.put('/api/timeoff/:id/status', requireAuth, requireAdmin, (req, res) => {
  const { status } = req.body;
  db.prepare('UPDATE time_off_requests SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json({ ok: true });
});

app.delete('/api/timeoff/:id', requireAuth, requireAdmin, (req, res) => {
  db.prepare('DELETE FROM time_off_requests WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

app.get('/api/staff/:id/pto', requireAuth, (req, res) => {
  const bal = db.prepare('SELECT * FROM staff_pto_balances WHERE staff_id = ?').get(req.params.id);
  res.json(bal || { staff_id: req.params.id, vacation_hrs: 0, sick_hrs: 0, personal_hrs: 0 });
});

app.put('/api/staff/:id/pto', requireAuth, requireAdmin, (req, res) => {
  const { vacation_hrs, sick_hrs, personal_hrs, as_of_date } = req.body;
  db.prepare(`INSERT INTO staff_pto_balances (staff_id, vacation_hrs, sick_hrs, personal_hrs, as_of_date)
    VALUES (?,?,?,?,?) ON CONFLICT(staff_id) DO UPDATE SET vacation_hrs=excluded.vacation_hrs, sick_hrs=excluded.sick_hrs, personal_hrs=excluded.personal_hrs, as_of_date=excluded.as_of_date, updated_at=CURRENT_TIMESTAMP`)
    .run(req.params.id, vacation_hrs||0, sick_hrs||0, personal_hrs||0, as_of_date||new Date().toISOString().slice(0,10));
  res.json({ ok: true });
});

// ─── Staffing Schedule ────────────────────────────────────────────────────────

app.get('/api/centers/:centerId/schedule', requireAuth, requireCenterAccess, (req, res) => {
  const { week_start } = req.query;
  let q = 'SELECT ss.*, s.name as staff_name, s.title FROM schedule_shifts ss JOIN staff s ON s.id = ss.staff_id WHERE ss.center_id = ?';
  const params = [req.params.centerId];
  if (week_start) {
    const end = new Date(week_start); end.setDate(end.getDate() + 6);
    q += ' AND ss.shift_date BETWEEN ? AND ?';
    params.push(week_start, end.toISOString().slice(0, 10));
  }
  q += ' ORDER BY ss.shift_date, ss.start_time';
  res.json(db.prepare(q).all(...params));
});

app.post('/api/centers/:centerId/schedule', requireAuth, requireAdmin, (req, res) => {
  const { staff_id, shift_date, start_time, end_time, role, notes } = req.body;
  if (!staff_id || !shift_date || !start_time || !end_time) return res.status(400).json({ error: 'staff_id, shift_date, start_time, end_time required' });
  const r = db.prepare('INSERT INTO schedule_shifts (staff_id, center_id, shift_date, start_time, end_time, role, notes) VALUES (?,?,?,?,?,?,?)').run(staff_id, req.params.centerId, shift_date, start_time, end_time, role||null, notes||null);
  res.json(db.prepare('SELECT ss.*, s.name as staff_name FROM schedule_shifts ss JOIN staff s ON s.id = ss.staff_id WHERE ss.id = ?').get(r.lastInsertRowid));
});

app.delete('/api/schedule/:id', requireAuth, requireAdmin, (req, res) => {
  db.prepare('DELETE FROM schedule_shifts WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ─── Financial Performance ────────────────────────────────────────────────────

app.get('/api/centers/:centerId/financials', requireAuth, requireCenterAccess, (req, res) => {
  res.json(db.prepare('SELECT * FROM financial_snapshots WHERE center_id = ? ORDER BY period_start DESC').all(req.params.centerId));
});

app.post('/api/centers/:centerId/financials', requireAuth, requireAdmin, (req, res) => {
  const { period_label, period_start, period_end, revenue, expenses, payroll, food_costs, supplies, utilities, other_exp, notes } = req.body;
  if (!period_start) return res.status(400).json({ error: 'period_start required' });
  const r = db.prepare(`INSERT INTO financial_snapshots (center_id, period_label, period_start, period_end, revenue, expenses, payroll, food_costs, supplies, utilities, other_exp, notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
    .run(req.params.centerId, period_label||`${period_start} period`, period_start, period_end||period_start, revenue||0, expenses||0, payroll||0, food_costs||0, supplies||0, utilities||0, other_exp||0, notes||null);
  res.json(db.prepare('SELECT * FROM financial_snapshots WHERE id = ?').get(r.lastInsertRowid));
});

app.put('/api/financials/:id', requireAuth, requireAdmin, (req, res) => {
  const { period_label, period_start, period_end, revenue, expenses, payroll, food_costs, supplies, utilities, other_exp, notes } = req.body;
  db.prepare('UPDATE financial_snapshots SET period_label=?,period_start=?,period_end=?,revenue=?,expenses=?,payroll=?,food_costs=?,supplies=?,utilities=?,other_exp=?,notes=? WHERE id=?')
    .run(period_label, period_start, period_end, revenue||0, expenses||0, payroll||0, food_costs||0, supplies||0, utilities||0, other_exp||0, notes||null, req.params.id);
  res.json({ ok: true });
});

app.delete('/api/financials/:id', requireAuth, requireAdmin, (req, res) => {
  db.prepare('DELETE FROM financial_snapshots WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ─── Catch-all → SPA ──────────────────────────────────────────────────────────

if (fs.existsSync(FRONTEND_BUILD)) {
  app.get('*', (req, res) => {
    res.sendFile(path.join(FRONTEND_BUILD, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`OMH Portal running on port ${PORT}`);
  // Auto-seed data on first run
  const calendarCount = db.prepare('SELECT COUNT(*) as n FROM calendar_events').get().n;
  if (calendarCount === 0) {
    try { require('./seed-calendar'); console.log('✓ Auto-seeded calendar'); } catch(e) { console.warn('Calendar seed error:', e.message); }
  }
  const menuCount = db.prepare('SELECT COUNT(*) as n FROM weekly_menus').get().n;
  if (menuCount === 0) {
    try { require('./seed-menus'); console.log('✓ Auto-seeded menus'); } catch(e) { console.warn('Menu seed error:', e.message); }
  }
});
