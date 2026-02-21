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

// ─── Catch-all → SPA ──────────────────────────────────────────────────────────

if (fs.existsSync(FRONTEND_BUILD)) {
  app.get('*', (req, res) => {
    res.sendFile(path.join(FRONTEND_BUILD, 'index.html'));
  });
}

app.listen(PORT, () => console.log(`OMH Portal running on port ${PORT}`));
