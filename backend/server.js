const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const db = require('./database');
const { signToken, requireAuth, requireAdmin, requireCenterAccess, COOKIE_NAME, SESSION_DAYS } = require('./auth');
const multer = require('multer');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const Anthropic = require('@anthropic-ai/sdk');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

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
  const { title, description, location, start_date, end_date, all_day, category, start_time, end_time } = req.body;
  if (!title || !start_date) return res.status(400).json({ error: 'Title and start date required' });
  const result = db.prepare(`
    INSERT INTO calendar_events (center_id, title, description, location, start_date, end_date, all_day, category, start_time, end_time)
    VALUES (?,?,?,?,?,?,?,?,?,?)
  `).run(req.params.centerId, title, description||null, location||null, start_date, end_date||null, all_day ?? 1, category || 'management', start_time||null, end_time||null);
  res.json(db.prepare('SELECT * FROM calendar_events WHERE id = ?').get(result.lastInsertRowid));
});

app.put('/api/calendar/:id', requireAuth, requireAdmin, (req, res) => {
  const { title, description, location, start_date, end_date, all_day, category, start_time, end_time } = req.body;
  db.prepare(`UPDATE calendar_events SET title=?, description=?, location=?, start_date=?, end_date=?, all_day=?, category=?, start_time=?, end_time=? WHERE id=?`)
    .run(title, description||null, location||null, start_date, end_date||null, all_day ?? 1, category, start_time||null, end_time||null, req.params.id);
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

// Update rates_published flag
app.patch('/api/competitors/:id', requireAuth, requireAdmin, (req, res) => {
  const updates = []
  const params = []
  if (req.body.rates_published !== undefined) { updates.push('rates_published=?'); params.push(req.body.rates_published ? 1 : 0) }
  if (req.body.notes !== undefined) { updates.push('notes=?'); params.push(req.body.notes) }
  if (!updates.length) return res.status(400).json({ error: 'Nothing to update' })
  params.push(req.params.id)
  db.prepare(`UPDATE competitors SET ${updates.join(',')},updated_at=CURRENT_TIMESTAMP WHERE id=?`).run(...params)
  res.json({ ok: true })
})

// ─── Google Places — Auto-discover nearby daycares ────────────────────────────

async function placesNearbySearch(lat, lng, radiusMeters, apiKey) {
  const https = require('https')
  return new Promise((resolve) => {
    const path = `/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radiusMeters}&type=child_care_agency&key=${apiKey}`
    const req = https.request({ hostname: 'maps.googleapis.com', path, method: 'GET' }, res => {
      let d = ''
      res.on('data', c => d += c)
      res.on('end', () => { try { resolve(JSON.parse(d)) } catch { resolve({ results: [] }) } })
    })
    req.on('error', () => resolve({ results: [] }))
    req.end()
  })
}

async function placesTextSearch(query, lat, lng, apiKey) {
  const https = require('https')
  return new Promise((resolve) => {
    const path = `/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&location=${lat},${lng}&radius=48280&key=${apiKey}`
    const req = https.request({ hostname: 'maps.googleapis.com', path, method: 'GET' }, res => {
      let d = ''
      res.on('data', c => d += c)
      res.on('end', () => { try { resolve(JSON.parse(d)) } catch { resolve({ results: [] }) } })
    })
    req.on('error', () => resolve({ results: [] }))
    req.end()
  })
}

app.post('/api/centers/:centerId/discover-competitors', requireAuth, requireAdmin, async (req, res) => {
  const apiKey = process.env.GOOGLE_MAPS_API_KEY
  if (!apiKey) return res.status(503).json({ error: 'GOOGLE_MAPS_API_KEY not configured in environment variables' })

  const center = db.prepare('SELECT * FROM centers WHERE id=?').get(req.params.centerId)
  if (!center) return res.status(404).json({ error: 'Center not found' })
  if (!center.lat || !center.lng) return res.status(400).json({ error: 'Center has no coordinates. Add lat/lng to this center first.' })

  const radiusMiles = parseInt(req.body.radius_miles) || 30
  const radiusMeters = radiusMiles * 1609

  try {
    // Search using Google Places
    const [nearbyRes, textRes] = await Promise.all([
      placesNearbySearch(center.lat, center.lng, radiusMeters, apiKey),
      placesTextSearch('daycare child care preschool', center.lat, center.lng, apiKey),
    ])

    const allResults = [...(nearbyRes.results || []), ...(textRes.results || [])]

    // Deduplicate by place_id
    const seen = new Set()
    const unique = allResults.filter(r => {
      if (seen.has(r.place_id)) return false
      seen.add(r.place_id)
      return true
    })

    // Get existing competitor names (for duplicate detection)
    const existing = db.prepare('SELECT name FROM competitors WHERE center_id=?').all(req.params.centerId).map(r => r.name.toLowerCase())

    const discovered = unique.map(place => {
      const addressParts = (place.vicinity || place.formatted_address || '').split(',')
      const city = addressParts.length >= 2 ? addressParts[addressParts.length - 2]?.trim() : center.city
      const stateZip = addressParts[addressParts.length - 1]?.trim() || ''
      const stateMatch = stateZip.match(/([A-Z]{2})\s*(\d{5})?/)
      const state = stateMatch?.[1] || center.state
      const zip = stateMatch?.[2] || null

      // Compute distance (Haversine)
      const R = 3958.8
      const dLat = (place.geometry.location.lat - center.lat) * Math.PI / 180
      const dLon = (place.geometry.location.lng - center.lng) * Math.PI / 180
      const a = Math.sin(dLat/2)**2 + Math.cos(center.lat*Math.PI/180) * Math.cos(place.geometry.location.lat*Math.PI/180) * Math.sin(dLon/2)**2
      const distanceMiles = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))

      return {
        place_id: place.place_id,
        name: place.name,
        address: place.vicinity || place.formatted_address,
        city: city || center.city,
        state: state || center.state,
        zip,
        lat: place.geometry.location.lat,
        lng: place.geometry.location.lng,
        rating: place.rating,
        distance_miles: Math.round(distanceMiles * 10) / 10,
        already_tracked: existing.includes(place.name.toLowerCase()),
        rates_published: false, // unknown — admin must update
      }
    }).filter(p => p.distance_miles <= radiusMiles)
      .sort((a, b) => a.distance_miles - b.distance_miles)

    res.json({ found: discovered.length, results: discovered, center_name: center.name, radius_miles: radiusMiles })
  } catch (e) {
    res.status(500).json({ error: e.message })
  }
})

// ─── Food Pricing ──────────────────────────────────────────────────────────────

app.get('/api/vendors', requireAuth, (req, res) => {
  res.json(db.prepare('SELECT * FROM vendors ORDER BY name').all());
});

app.post('/api/vendors', requireAuth, requireAdmin, (req, res) => {
  const { name, type, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'Vendor name required' });
  const r = db.prepare('INSERT INTO vendors (name, type, notes) VALUES (?,?,?)').run(name, type || 'grocery', notes || null);
  res.json(db.prepare('SELECT * FROM vendors WHERE id = ?').get(r.lastInsertRowid));
});

app.delete('/api/vendors/:id', requireAuth, requireAdmin, (req, res) => {
  db.prepare('DELETE FROM vendors WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
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

// ─── Kroger Live Pricing (activates when KROGER_CLIENT_ID is set) ────────────

let krogerToken = null;
let krogerTokenExpiry = 0;

async function getKrogerToken() {
  if (krogerToken && Date.now() < krogerTokenExpiry) return krogerToken;
  const clientId = process.env.KROGER_CLIENT_ID;
  const clientSecret = process.env.KROGER_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  try {
    const https = require('https');
    return new Promise((resolve) => {
      const creds = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      const body = 'grant_type=client_credentials&scope=product.compact';
      const req = https.request({ hostname: 'api.kroger.com', path: '/v1/connect/oauth2/token', method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': `Basic ${creds}`, 'Content-Length': Buffer.byteLength(body) }
      }, res => {
        let d = '';
        res.on('data', c => d += c);
        res.on('end', () => {
          try {
            const json = JSON.parse(d);
            krogerToken = json.access_token;
            krogerTokenExpiry = Date.now() + ((json.expires_in || 1800) - 60) * 1000;
            resolve(krogerToken);
          } catch { resolve(null); }
        });
      });
      req.on('error', () => resolve(null));
      req.write(body); req.end();
    });
  } catch { return null; }
}

async function krogerSearch(query, token) {
  const https = require('https');
  return new Promise((resolve) => {
    const path = `/v1/products?filter.term=${encodeURIComponent(query)}&filter.locationId=01400943&filter.limit=5`;
    const req = https.request({ hostname: 'api.kroger.com', path, method: 'GET',
      headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' }
    }, res => {
      let d = '';
      res.on('data', c => d += c);
      res.on('end', () => {
        try { resolve(JSON.parse(d)); } catch { resolve({}); }
      });
    });
    req.on('error', () => resolve({}));
    req.end();
  });
}

app.post('/api/ingredients/lookup', requireAuth, async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'query required' });
  const token = await getKrogerToken();
  if (!token) return res.json({ source: 'unavailable', message: 'Kroger API not configured. Add KROGER_CLIENT_ID + KROGER_CLIENT_SECRET in Railway.', products: [] });
  try {
    const data = await krogerSearch(query, token);
    const products = (data.data || []).map(p => ({
      name: p.description, brand: p.brand, size: p.items?.[0]?.size,
      price: p.items?.[0]?.price?.regular, sale_price: p.items?.[0]?.price?.promo,
    }));
    res.json({ source: 'kroger', products });
  } catch (e) { res.json({ source: 'error', message: e.message, products: [] }); }
});

app.post('/api/ingredients/parse-list', requireAuth, (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: 'text required' });
  const lines = text.split(/\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
  const items = lines.map(line => {
    const match = line.match(/^(\d+\.?\d*)\s*(lb[s]?|oz|gallon[s]?|quart[s]?|pint[s]?|each|case|bag[s]?|box(?:es)?|can[s]?|jar[s]?|dozen|pack[s]?|ct|count)\.?\s+(.+)$/i);
    if (match) return { qty: parseFloat(match[1]), unit: match[2].toLowerCase().replace(/s$/, ''), name: match[3].trim() };
    return { qty: null, unit: null, name: line.replace(/^[\d.,]+\s*/, '').trim() };
  });
  const ins = db.prepare('INSERT OR IGNORE INTO ingredients (name) VALUES (?)');
  items.forEach(item => { if (item.name) ins.run(item.name); });
  res.json({ items, count: items.length });
});

// ─── Recipes ──────────────────────────────────────────────────────────────────

app.post('/api/recipes/parse-document', requireAuth, requireAdmin, upload.single('file'), async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'AI parsing not configured — add ANTHROPIC_API_KEY to Railway env vars.' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });

  try {
    let text = '';
    const mime = req.file.mimetype;
    const name = req.file.originalname.toLowerCase();

    if (mime === 'application/pdf' || name.endsWith('.pdf')) {
      const data = await pdfParse(req.file.buffer);
      text = data.text;
    } else if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || name.endsWith('.docx')) {
      const result = await mammoth.extractRawText({ buffer: req.file.buffer });
      text = result.value;
    } else if (name.endsWith('.doc')) {
      return res.status(400).json({ error: 'Legacy .doc files are not supported. Please save as .docx and try again.' });
    } else {
      return res.status(400).json({ error: 'Unsupported file type. Please upload a PDF or Word document.' });
    }

    if (!text.trim()) return res.status(400).json({ error: 'Could not extract text from document.' });

    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5',
      max_tokens: 1024,
      system: `You are a recipe parser for a childcare company's food program. Extract recipe data from the provided text and return ONLY valid JSON with this exact structure:
{
  "name": "Recipe name",
  "category": "one of: Breakfast, Lunch, Dinner, Snack, Dessert — pick the best fit or null",
  "servings": <integer or null>,
  "ingredients": [{"quantity": "1", "unit": "cup", "name": "all-purpose flour"}, ...],
  "steps": ["Step 1 text", "Step 2 text", ...],
  "notes": "any notes, allergen info, or storage instructions — or null"
}
Rules:
- If multiple recipes are present, return only the first/main one.
- For ingredients: split quantity and unit from the ingredient name. quantity and unit may be null if not listed.
- Steps should be clean, readable sentences.
- Return ONLY the JSON object, no markdown, no explanation.`,
      messages: [{ role: 'user', content: text.slice(0, 8000) }]
    });

    const raw = message.content[0].text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/, '').trim();
    const parsed = JSON.parse(raw);
    res.json(parsed);
  } catch (err) {
    console.error('Recipe parse error:', err);
    res.status(500).json({ error: 'Failed to parse document: ' + err.message });
  }
});

app.get('/api/recipes', requireAuth, (req, res) => {
  const { center_id } = req.query;
  let query = 'SELECT * FROM recipes ORDER BY name';
  let params = [];
  if (center_id) {
    query = 'SELECT * FROM recipes WHERE center_id IS NULL OR center_id = ? ORDER BY name';
    params = [center_id];
  }
  const rows = db.prepare(query).all(...params);
  res.json(rows.map(r => ({
    ...r,
    ingredients: JSON.parse(r.ingredients || '[]'),
    steps: JSON.parse(r.steps || '[]'),
  })));
});

function syncRecipeIngredients(ingredients) {
  const ins = db.prepare('INSERT OR IGNORE INTO ingredients (name) VALUES (?)');
  (ingredients || []).forEach(ing => {
    const n = (ing.name || '').trim();
    if (n) ins.run(n);
  });
}

app.post('/api/recipes', requireAuth, requireAdmin, (req, res) => {
  const { center_id, name, category, servings, ingredients, steps, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const r = db.prepare('INSERT INTO recipes (center_id,name,category,servings,ingredients,steps,notes) VALUES (?,?,?,?,?,?,?)')
    .run(center_id || null, name, category || null, servings || 1,
         JSON.stringify(ingredients || []), JSON.stringify(steps || []), notes || null);
  syncRecipeIngredients(ingredients);
  res.json(db.prepare('SELECT * FROM recipes WHERE id=?').get(r.lastInsertRowid));
});

app.put('/api/recipes/:id', requireAuth, requireAdmin, (req, res) => {
  const { name, category, servings, ingredients, steps, notes } = req.body;
  db.prepare('UPDATE recipes SET name=?,category=?,servings=?,ingredients=?,steps=?,notes=?,updated_at=datetime("now") WHERE id=?')
    .run(name, category || null, servings || 1,
         JSON.stringify(ingredients || []), JSON.stringify(steps || []), notes || null, req.params.id);
  syncRecipeIngredients(ingredients);
  res.json({ ok: true });
});

app.delete('/api/recipes/:id', requireAuth, requireAdmin, (req, res) => {
  db.prepare('DELETE FROM recipes WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ─── Center & Licensing Compliance ────────────────────────────────────────────

app.get('/api/centers/:centerId/center-compliance', requireAuth, requireCenterAccess, (req, res) => {
  const rows = db.prepare('SELECT * FROM center_compliance WHERE center_id=? ORDER BY due_date ASC').all(req.params.centerId);
  res.json(rows);
});

app.post('/api/centers/:centerId/center-compliance', requireAuth, requireAdmin, (req, res) => {
  const { name, type, description, state, due_date, completed_date, recurs, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'Name required' });
  const r = db.prepare('INSERT INTO center_compliance (center_id,name,type,description,state,due_date,completed_date,recurs,notes) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(req.params.centerId, name, type || 'licensing', description || null, state || null, due_date || null, completed_date || null, recurs || 'annual', notes || null);
  res.json(db.prepare('SELECT * FROM center_compliance WHERE id=?').get(r.lastInsertRowid));
});

app.put('/api/center-compliance/:id', requireAuth, requireAdmin, (req, res) => {
  const { name, type, description, state, due_date, completed_date, recurs, notes } = req.body;
  db.prepare('UPDATE center_compliance SET name=?,type=?,description=?,state=?,due_date=?,completed_date=?,recurs=?,notes=?,updated_at=datetime("now") WHERE id=?')
    .run(name, type || 'licensing', description || null, state || null, due_date || null, completed_date || null, recurs || 'annual', notes || null, req.params.id);
  res.json({ ok: true });
});

app.delete('/api/center-compliance/:id', requireAuth, requireAdmin, (req, res) => {
  db.prepare('DELETE FROM center_compliance WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ─── Staff Points ─────────────────────────────────────────────────────────────

app.get('/api/staff/:id/points', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT sp.*, u.name as recorded_by_name FROM staff_points sp LEFT JOIN users u ON sp.recorded_by=u.id WHERE sp.staff_id=? ORDER BY sp.event_date DESC, sp.created_at DESC').all(req.params.id);
  const total = rows.reduce((sum, r) => sum + r.points, 0);
  res.json({ history: rows, total });
});

app.post('/api/staff/:id/points', requireAuth, (req, res) => {
  const { type, points, notes, event_date } = req.body;
  if (!type || points == null) return res.status(400).json({ error: 'type and points required' });
  const r = db.prepare('INSERT INTO staff_points (staff_id,type,points,notes,recorded_by,event_date) VALUES (?,?,?,?,?,?)')
    .run(req.params.id, type, points, notes || null, req.user.id, event_date || new Date().toISOString().split('T')[0]);
  res.json(db.prepare('SELECT * FROM staff_points WHERE id=?').get(r.lastInsertRowid));
});

app.delete('/api/points/:id', requireAuth, requireAdmin, (req, res) => {
  db.prepare('DELETE FROM staff_points WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});

// ─── Staff Reviews ────────────────────────────────────────────────────────────

app.get('/api/reviews', requireAuth, (req, res) => {
  let rows;
  if (req.user.role === 'admin') {
    rows = db.prepare('SELECT sr.*, s.name as staff_name, s.title as staff_title, s.center_id, u.name as reviewer_name FROM staff_reviews sr JOIN staff s ON sr.staff_id=s.id LEFT JOIN users u ON sr.reviewed_by=u.id ORDER BY sr.created_at DESC').all();
  } else {
    // Directors only see their center's staff
    const centers = db.prepare('SELECT center_id FROM user_centers WHERE user_id=?').all(req.user.id).map(r => r.center_id);
    if (!centers.length) return res.json([]);
    rows = db.prepare(`SELECT sr.*, s.name as staff_name, s.title as staff_title, u.name as reviewer_name FROM staff_reviews sr JOIN staff s ON sr.staff_id=s.id LEFT JOIN users u ON sr.reviewed_by=u.id WHERE s.center_id IN (${centers.map(()=>'?').join(',')}) ORDER BY sr.created_at DESC`).all(...centers);
  }
  res.json(rows);
});

app.post('/api/reviews', requireAuth, (req, res) => {
  const { staff_id, review_period, positives, growth_areas, focus_areas, notes } = req.body;
  if (!staff_id || !review_period) return res.status(400).json({ error: 'staff_id and review_period required' });
  const r = db.prepare('INSERT INTO staff_reviews (staff_id,review_period,positives,growth_areas,focus_areas,notes,reviewed_by) VALUES (?,?,?,?,?,?,?)')
    .run(staff_id, review_period, positives || null, growth_areas || null, focus_areas || null, notes || null, req.user.id);
  res.json(db.prepare('SELECT * FROM staff_reviews WHERE id=?').get(r.lastInsertRowid));
});

app.put('/api/reviews/:id', requireAuth, requireAdmin, (req, res) => {
  const { review_period, positives, growth_areas, focus_areas, notes } = req.body;
  db.prepare('UPDATE staff_reviews SET review_period=?,positives=?,growth_areas=?,focus_areas=?,notes=?,updated_at=datetime("now") WHERE id=?')
    .run(review_period, positives || null, growth_areas || null, focus_areas || null, notes || null, req.params.id);
  res.json({ ok: true });
});

app.get('/api/staff/:id/reviews', requireAuth, (req, res) => {
  const rows = db.prepare('SELECT sr.*, u.name as reviewer_name FROM staff_reviews sr LEFT JOIN users u ON sr.reviewed_by=u.id WHERE sr.staff_id=? ORDER BY sr.created_at DESC').all(req.params.id);
  res.json(rows);
});

// ─── Handbook Documents ───────────────────────────────────────────────────────

app.get('/api/handbooks', requireAuth, (req, res) => {
  res.json(db.prepare('SELECT * FROM handbook_documents ORDER BY type, updated_at DESC').all());
});

app.post('/api/handbooks', requireAuth, requireAdmin, (req, res) => {
  const { type, title, file_url, notes } = req.body;
  if (!type || !title) return res.status(400).json({ error: 'type and title required' });
  const r = db.prepare('INSERT INTO handbook_documents (type,title,file_url,notes) VALUES (?,?,?,?)').run(type, title, file_url || null, notes || null);
  res.json(db.prepare('SELECT * FROM handbook_documents WHERE id=?').get(r.lastInsertRowid));
});

app.delete('/api/handbooks/:id', requireAuth, requireAdmin, (req, res) => {
  db.prepare('DELETE FROM handbook_documents WHERE id=?').run(req.params.id);
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
  const calendarCount = db.prepare('SELECT COUNT(*) as n FROM calendar_events').get().n;
  if (calendarCount === 0) {
    try { require('./seed-calendar'); console.log('✓ Auto-seeded calendar'); } catch(e) { console.warn('Calendar seed error:', e.message); }
  }
  const menuCount = db.prepare('SELECT COUNT(*) as n FROM weekly_menus').get().n;
  if (menuCount === 0) {
    try { require('./seed-menus'); console.log('✓ Auto-seeded menus'); } catch(e) { console.warn('Menu seed error:', e.message); }
  }
});
