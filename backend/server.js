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

const FRONTEND_BUILD = path.join(__dirname, '..', 'frontend', 'dist');
if (fs.existsSync(FRONTEND_BUILD)) {
  app.use(express.static(FRONTEND_BUILD));
}

// ─── Auth ──────────────────────────────────────────────────────────────────────

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password required' });
    const user = await db.prepare('SELECT * FROM users WHERE email = ?').get(email.trim());
    if (!user || !bcrypt.compareSync(password, user.password_hash))
      return res.status(401).json({ error: 'Invalid email or password' });
    const token = signToken(user);
    res.cookie(COOKIE_NAME, token, { httpOnly: true, secure: IS_PROD, sameSite: 'lax', maxAge: SESSION_DAYS * 24 * 60 * 60 * 1000 });
    const accessibleCenters = user.role === 'admin'
      ? await db.prepare('SELECT * FROM centers ORDER BY name').all()
      : await db.prepare('SELECT c.* FROM centers c JOIN user_centers uc ON c.id = uc.center_id WHERE uc.user_id = ? ORDER BY c.name').all(user.id);
    res.json({ id: user.id, email: user.email, name: user.name, role: user.role, centers: accessibleCenters });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/auth/logout', (req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

app.get('/api/auth/me', requireAuth, async (req, res) => {
  try {
    const user = await db.prepare('SELECT id, email, name, role FROM users WHERE id = ?').get(req.user.id);
    const centers = user.role === 'admin'
      ? await db.prepare('SELECT * FROM centers ORDER BY name').all()
      : await db.prepare('SELECT c.* FROM centers c JOIN user_centers uc ON c.id = uc.center_id WHERE uc.user_id = ? ORDER BY c.name').all(user.id);
    res.json({ ...user, centers });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/auth/change-password', requireAuth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Both passwords required' });
    if (newPassword.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });
    const user = await db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    if (!bcrypt.compareSync(currentPassword, user.password_hash))
      return res.status(401).json({ error: 'Current password is incorrect' });
    await db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(newPassword, 12), req.user.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Centers ───────────────────────────────────────────────────────────────────

app.get('/api/centers', requireAuth, async (req, res) => {
  try {
    const centers = req.user.role === 'admin'
      ? await db.prepare('SELECT * FROM centers ORDER BY name').all()
      : await db.prepare('SELECT c.* FROM centers c JOIN user_centers uc ON c.id = uc.center_id WHERE uc.user_id = ? ORDER BY c.name').all(req.user.id);
    res.json(centers);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/centers', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, address, city, state, zip, lat, lng } = req.body;
    if (!name) return res.status(400).json({ error: 'Center name required' });
    const r = await db.prepare('INSERT INTO centers (name,address,city,state,zip,lat,lng) VALUES (?,?,?,?,?,?,?)').run(name, address, city, state, zip, lat, lng);
    res.json(await db.prepare('SELECT * FROM centers WHERE id = ?').get(r.lastInsertRowid));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/centers/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, address, city, state, zip, lat, lng } = req.body;
    await db.prepare('UPDATE centers SET name=?,address=?,city=?,state=?,zip=?,lat=?,lng=? WHERE id=?').run(name, address, city, state, zip, lat, lng, req.params.id);
    res.json(await db.prepare('SELECT * FROM centers WHERE id = ?').get(req.params.id));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Users ─────────────────────────────────────────────────────────────────────

app.get('/api/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const users = await db.prepare('SELECT id, email, name, role, created_at FROM users ORDER BY name').all();
    const centers = await db.prepare('SELECT user_id, center_id FROM user_centers').all();
    const centerMap = {};
    centers.forEach(({ user_id, center_id }) => {
      if (!centerMap[user_id]) centerMap[user_id] = [];
      centerMap[user_id].push(center_id);
    });
    res.json(users.map(u => ({ ...u, center_ids: centerMap[u.id] || [] })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/users', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { email, name, password, role, center_ids } = req.body;
    if (!email || !name || !password) return res.status(400).json({ error: 'Email, name, and password required' });
    if (password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    const existing = await db.prepare('SELECT id FROM users WHERE email = ?').get(email.trim());
    if (existing) return res.status(409).json({ error: 'Email already in use' });
    const hash = bcrypt.hashSync(password, 12);
    const r = await db.prepare('INSERT INTO users (email,name,password_hash,role) VALUES (?,?,?,?)').run(email.trim(), name, hash, role || 'director');
    const userId = r.lastInsertRowid;
    if (Array.isArray(center_ids)) {
      for (const cid of center_ids) {
        await db.prepare('INSERT INTO user_centers (user_id,center_id) VALUES (?,?) ON CONFLICT DO NOTHING').run(userId, cid);
      }
    }
    res.json({ id: userId, email, name, role: role || 'director', center_ids: center_ids || [] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/users/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, role, center_ids, password } = req.body;
    if (name) await db.prepare('UPDATE users SET name = ? WHERE id = ?').run(name, req.params.id);
    if (role) await db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, req.params.id);
    if (password && password.length >= 8)
      await db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(bcrypt.hashSync(password, 12), req.params.id);
    if (Array.isArray(center_ids)) {
      await db.prepare('DELETE FROM user_centers WHERE user_id = ?').run(req.params.id);
      for (const cid of center_ids) {
        await db.prepare('INSERT INTO user_centers (user_id,center_id) VALUES (?,?) ON CONFLICT DO NOTHING').run(req.params.id, cid);
      }
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/users/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Calendar ──────────────────────────────────────────────────────────────────

app.get('/api/centers/:centerId/calendar', requireAuth, requireCenterAccess, async (req, res) => {
  try {
    const { month, year } = req.query;
    let query = 'SELECT * FROM calendar_events WHERE (center_id = ? OR center_id IS NULL)';
    const params = [req.params.centerId];
    if (month && year) {
      query += ` AND TO_CHAR(start_date::date, 'YYYY-MM') = ?`;
      params.push(`${year}-${String(month).padStart(2,'0')}`);
    }
    query += ' ORDER BY start_date ASC';
    res.json(await db.prepare(query).all(...params));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/centers/:centerId/calendar', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { title, description, location, start_date, end_date, all_day, category, start_time, end_time } = req.body;
    if (!title || !start_date) return res.status(400).json({ error: 'Title and start date required' });
    const r = await db.prepare('INSERT INTO calendar_events (center_id,title,description,location,start_date,end_date,all_day,category,start_time,end_time) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .run(req.params.centerId, title, description||null, location||null, start_date, end_date||null, all_day??1, category||'management', start_time||null, end_time||null);
    res.json(await db.prepare('SELECT * FROM calendar_events WHERE id = ?').get(r.lastInsertRowid));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/calendar/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { title, description, location, start_date, end_date, all_day, category, start_time, end_time } = req.body;
    await db.prepare('UPDATE calendar_events SET title=?,description=?,location=?,start_date=?,end_date=?,all_day=?,category=?,start_time=?,end_time=? WHERE id=?')
      .run(title, description||null, location||null, start_date, end_date||null, all_day??1, category, start_time||null, end_time||null, req.params.id);
    res.json(await db.prepare('SELECT * FROM calendar_events WHERE id = ?').get(req.params.id));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/calendar/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await db.prepare('DELETE FROM calendar_events WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Waitlist ──────────────────────────────────────────────────────────────────

app.get('/api/centers/:centerId/waitlist', requireAuth, requireCenterAccess, async (req, res) => {
  try {
    res.json(await db.prepare('SELECT * FROM waitlist_entries WHERE center_id = ? ORDER BY signed_up_at DESC').all(req.params.centerId));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/centers/:centerId/waitlist', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { child_name, date_of_birth, desired_enrollment_time, parent_name, phone, email, notes, last_contact, signed_up_at, heard_about_us } = req.body;
    if (!child_name?.trim()) return res.status(400).json({ error: 'Child name is required' });
    const r = await db.prepare('INSERT INTO waitlist_entries (center_id,child_name,date_of_birth,desired_enrollment_time,parent_name,phone,email,notes,last_contact,signed_up_at,heard_about_us) VALUES (?,?,?,?,?,?,?,?,?,?,?)')
      .run(req.params.centerId, child_name.trim(), date_of_birth||null, desired_enrollment_time||null, parent_name||null, phone||null, email||null, notes||null, last_contact||null, signed_up_at||new Date().toISOString().split('T')[0], heard_about_us||null);
    res.status(201).json(await db.prepare('SELECT * FROM waitlist_entries WHERE id = ?').get(r.lastInsertRowid));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/centers/:centerId/waitlist/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { child_name, date_of_birth, desired_enrollment_time, parent_name, phone, email, notes, last_contact, signed_up_at, heard_about_us } = req.body;
    await db.prepare('UPDATE waitlist_entries SET child_name=?,date_of_birth=?,desired_enrollment_time=?,parent_name=?,phone=?,email=?,notes=?,last_contact=?,signed_up_at=?,heard_about_us=?,updated_at=NOW() WHERE id=? AND center_id=?')
      .run(child_name, date_of_birth||null, desired_enrollment_time||null, parent_name||null, phone||null, email||null, notes||null, last_contact||null, signed_up_at, heard_about_us||null, req.params.id, req.params.centerId);
    res.json(await db.prepare('SELECT * FROM waitlist_entries WHERE id = ?').get(req.params.id));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/centers/:centerId/waitlist/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await db.prepare('DELETE FROM waitlist_entries WHERE id = ? AND center_id = ?').run(req.params.id, req.params.centerId);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/email-senders', requireAuth, requireAdmin, async (req, res) => {
  try {
    res.json(await db.prepare('SELECT es.*, c.name as center_name FROM email_senders es JOIN centers c ON c.id = es.center_id ORDER BY es.name').all());
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/email-senders', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { email, name, center_id } = req.body;
    if (!email || !name || !center_id) return res.status(400).json({ error: 'Email, name, and center required' });
    const r = await db.prepare('INSERT INTO email_senders (email,name,center_id) VALUES (?,?,?)').run(email.trim().toLowerCase(), name.trim(), center_id);
    res.json(await db.prepare('SELECT es.*, c.name as center_name FROM email_senders es JOIN centers c ON c.id = es.center_id WHERE es.id = ?').get(r.lastInsertRowid));
  } catch { res.status(409).json({ error: 'That email is already an approved sender' }); }
});

app.put('/api/email-senders/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { active } = req.body;
    if (active !== undefined) await db.prepare('UPDATE email_senders SET active = ? WHERE id = ?').run(active ? 1 : 0, req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/email-senders/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await db.prepare('DELETE FROM email_senders WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/email-intake', async (req, res) => {
  try {
    const { secret, sender_email, entry } = req.body;
    if (secret !== process.env.INTERNAL_SECRET) return res.status(403).json({ error: 'Forbidden' });
    const sender = await db.prepare('SELECT * FROM email_senders WHERE email = ? AND active = 1').get(sender_email?.toLowerCase());
    if (!sender) return res.status(403).json({ error: 'Sender not authorized' });
    const { child_name, date_of_birth, desired_enrollment_time, parent_name, phone, email, notes, heard_about_us } = entry;
    if (!child_name?.trim()) return res.status(400).json({ error: 'Child name is required' });
    const r = await db.prepare('INSERT INTO waitlist_entries (center_id,child_name,date_of_birth,desired_enrollment_time,parent_name,phone,email,notes,signed_up_at,heard_about_us) VALUES (?,?,?,?,?,?,?,?,?,?)')
      .run(sender.center_id, child_name.trim(), date_of_birth||null, desired_enrollment_time||null, parent_name||null, phone||null, email||null, notes||`Added via email from ${sender.name}`, new Date().toISOString().split('T')[0], heard_about_us||null);
    await db.prepare('UPDATE email_senders SET last_used = NOW() WHERE id = ?').run(sender.id);
    res.status(201).json(await db.prepare('SELECT * FROM waitlist_entries WHERE id = ?').get(r.lastInsertRowid));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/email-senders/check', async (req, res) => {
  try {
    const { email, secret } = req.body;
    if (secret !== process.env.INTERNAL_SECRET) return res.status(403).json({ error: 'Forbidden' });
    const sender = await db.prepare('SELECT es.*, c.name as center_name FROM email_senders es JOIN centers c ON c.id = es.center_id WHERE es.email = ? AND es.active = 1').get(email?.toLowerCase());
    if (!sender) return res.status(404).json({ error: 'Not approved' });
    res.json(sender);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Competitive Analysis ─────────────────────────────────────────────────────

app.get('/api/competitors', requireAuth, async (req, res) => {
  try {
    const { center_id } = req.query;
    const rows = center_id
      ? await db.prepare('SELECT * FROM competitors WHERE center_id = ? ORDER BY is_ours DESC, name ASC').all(center_id)
      : await db.prepare('SELECT * FROM competitors ORDER BY is_ours DESC, name ASC').all();
    res.json(rows.map(r => ({ ...r, is_ours: !!r.is_ours, rates: JSON.parse(r.rates_json || '{}') })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/competitors', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, city, state, zip, is_ours, youngstar_rating, rates, notes, center_id } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const r = await db.prepare('INSERT INTO competitors (center_id,name,city,state,zip,is_ours,youngstar_rating,rates_json,notes) VALUES (?,?,?,?,?,?,?,?,?)')
      .run(center_id||null, name, city, state, zip, is_ours?1:0, youngstar_rating||null, JSON.stringify(rates||{}), notes);
    res.json({ id: r.lastInsertRowid, name, city, state, is_ours: !!is_ours, youngstar_rating, rates: rates||{} });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/competitors/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, city, state, zip, is_ours, youngstar_rating, rates, notes } = req.body;
    await db.prepare('UPDATE competitors SET name=?,city=?,state=?,zip=?,is_ours=?,youngstar_rating=?,rates_json=?,notes=?,updated_at=NOW() WHERE id=?')
      .run(name, city, state, zip, is_ours?1:0, youngstar_rating||null, JSON.stringify(rates||{}), notes, req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/competitors/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await db.prepare('DELETE FROM competitors WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.patch('/api/competitors/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const updates = []; const params = [];
    if (req.body.rates_published !== undefined) { updates.push('rates_published=?'); params.push(req.body.rates_published?1:0); }
    if (req.body.notes !== undefined) { updates.push('notes=?'); params.push(req.body.notes); }
    if (!updates.length) return res.status(400).json({ error: 'Nothing to update' });
    params.push(req.params.id);
    await db.prepare(`UPDATE competitors SET ${updates.join(',')},updated_at=NOW() WHERE id=?`).run(...params);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Google Places ────────────────────────────────────────────────────────────

async function placesNearbySearch(lat, lng, radiusMeters, apiKey) {
  const https = require('https');
  return new Promise((resolve) => {
    const path = `/maps/api/place/nearbysearch/json?location=${lat},${lng}&radius=${radiusMeters}&type=child_care_agency&key=${apiKey}`;
    const req = https.request({ hostname: 'maps.googleapis.com', path, method: 'GET' }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({ results: [] }); } });
    });
    req.on('error', () => resolve({ results: [] })); req.end();
  });
}

async function placesTextSearch(query, lat, lng, apiKey) {
  const https = require('https');
  return new Promise((resolve) => {
    const path = `/maps/api/place/textsearch/json?query=${encodeURIComponent(query)}&location=${lat},${lng}&radius=48280&key=${apiKey}`;
    const req = https.request({ hostname: 'maps.googleapis.com', path, method: 'GET' }, res => {
      let d = ''; res.on('data', c => d += c);
      res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({ results: [] }); } });
    });
    req.on('error', () => resolve({ results: [] })); req.end();
  });
}

app.post('/api/centers/:centerId/discover-competitors', requireAuth, requireAdmin, async (req, res) => {
  try {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) return res.status(503).json({ error: 'GOOGLE_MAPS_API_KEY not configured' });
    const center = await db.prepare('SELECT * FROM centers WHERE id=?').get(req.params.centerId);
    if (!center) return res.status(404).json({ error: 'Center not found' });
    if (!center.lat || !center.lng) return res.status(400).json({ error: 'Center has no coordinates.' });
    const radiusMiles = parseInt(req.body.radius_miles) || 30;
    const radiusMeters = radiusMiles * 1609;
    const [nearbyRes, textRes] = await Promise.all([
      placesNearbySearch(center.lat, center.lng, radiusMeters, apiKey),
      placesTextSearch('daycare child care preschool', center.lat, center.lng, apiKey),
    ]);
    const allResults = [...(nearbyRes.results||[]), ...(textRes.results||[])];
    const seen = new Set();
    const unique = allResults.filter(r => { if (seen.has(r.place_id)) return false; seen.add(r.place_id); return true; });
    const existing = (await db.prepare('SELECT name FROM competitors WHERE center_id=?').all(req.params.centerId)).map(r => r.name.toLowerCase());
    const discovered = unique.map(place => {
      const addressParts = (place.vicinity || place.formatted_address || '').split(',');
      const city = addressParts.length >= 2 ? addressParts[addressParts.length - 2]?.trim() : center.city;
      const stateZip = addressParts[addressParts.length - 1]?.trim() || '';
      const stateMatch = stateZip.match(/([A-Z]{2})\s*(\d{5})?/);
      const R = 3958.8;
      const dLat = (place.geometry.location.lat - center.lat) * Math.PI / 180;
      const dLon = (place.geometry.location.lng - center.lng) * Math.PI / 180;
      const a = Math.sin(dLat/2)**2 + Math.cos(center.lat*Math.PI/180) * Math.cos(place.geometry.location.lat*Math.PI/180) * Math.sin(dLon/2)**2;
      const distanceMiles = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
      return {
        place_id: place.place_id, name: place.name,
        address: place.vicinity || place.formatted_address,
        city: city || center.city, state: stateMatch?.[1] || center.state, zip: stateMatch?.[2] || null,
        lat: place.geometry.location.lat, lng: place.geometry.location.lng,
        rating: place.rating, distance_miles: Math.round(distanceMiles*10)/10,
        already_tracked: existing.includes(place.name.toLowerCase()), rates_published: false,
      };
    }).filter(p => p.distance_miles <= radiusMiles).sort((a,b) => a.distance_miles - b.distance_miles);
    res.json({ found: discovered.length, results: discovered, center_name: center.name, radius_miles: radiusMiles });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Food Pricing ──────────────────────────────────────────────────────────────

app.get('/api/vendors', requireAuth, async (req, res) => {
  try { res.json(await db.prepare('SELECT * FROM vendors ORDER BY name').all()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/vendors', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, type, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'Vendor name required' });
    const r = await db.prepare('INSERT INTO vendors (name,type,notes) VALUES (?,?,?)').run(name, type||'grocery', notes||null);
    res.json(await db.prepare('SELECT * FROM vendors WHERE id = ?').get(r.lastInsertRowid));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/vendors/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await db.prepare('DELETE FROM vendors WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/ingredients', requireAuth, async (req, res) => {
  try {
    const ingredients = await db.prepare('SELECT * FROM ingredients ORDER BY name').all();
    const prices = await db.prepare('SELECT ip.*, v.name as vendor_name FROM ingredient_prices ip JOIN vendors v ON v.id = ip.vendor_id').all();
    const priceMap = {};
    prices.forEach(p => { if (!priceMap[p.ingredient_id]) priceMap[p.ingredient_id] = []; priceMap[p.ingredient_id].push(p); });
    res.json(ingredients.map(i => ({ ...i, prices: priceMap[i.id] || [] })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/ingredients', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, category, unit } = req.body;
    if (!name) return res.status(400).json({ error: 'Ingredient name required' });
    const r = await db.prepare('INSERT INTO ingredients (name,category,unit) VALUES (?,?,?) ON CONFLICT DO NOTHING').run(name, category||'general', unit||'each');
    if (!r.lastInsertRowid) {
      const existing = await db.prepare('SELECT * FROM ingredients WHERE LOWER(name) = LOWER(?)').get(name);
      return res.status(409).json({ error: 'Ingredient already exists', existing });
    }
    res.json(await db.prepare('SELECT * FROM ingredients WHERE id = ?').get(r.lastInsertRowid));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/ingredients/:id/prices', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { prices } = req.body;
    if (!Array.isArray(prices)) return res.status(400).json({ error: 'prices must be an array' });
    for (const p of prices) {
      await db.prepare('DELETE FROM ingredient_prices WHERE ingredient_id=? AND vendor_id=? AND center_id IS NOT DISTINCT FROM ?').run(req.params.id, p.vendor_id, p.center_id||null);
      await db.prepare('INSERT INTO ingredient_prices (ingredient_id,vendor_id,center_id,price,unit) VALUES (?,?,?,?,?)').run(req.params.id, p.vendor_id, p.center_id||null, p.price, p.unit||'each');
    }
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/ingredients/compare', requireAuth, async (req, res) => {
  try {
    const rows = await db.prepare(`
      SELECT i.name as ingredient, i.unit as default_unit, v.name as vendor, ip.price, ip.unit, ip.recorded_at
      FROM ingredient_prices ip
      JOIN ingredients i ON i.id = ip.ingredient_id
      JOIN vendors v ON v.id = ip.vendor_id
      ORDER BY i.name, ip.price ASC
    `).all();
    const grouped = {};
    rows.forEach(r => {
      if (!grouped[r.ingredient]) grouped[r.ingredient] = { ingredient: r.ingredient, vendors: [] };
      grouped[r.ingredient].vendors.push({ vendor: r.vendor, price: r.price, unit: r.unit });
    });
    res.json(Object.values(grouped));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/centers/:centerId/menus', requireAuth, requireCenterAccess, async (req, res) => {
  try {
    const menus = await db.prepare('SELECT * FROM weekly_menus WHERE center_id = ? ORDER BY week_start DESC').all(req.params.centerId);
    const items = await db.prepare('SELECT * FROM menu_items WHERE menu_id IN (SELECT id FROM weekly_menus WHERE center_id = ?)').all(req.params.centerId);
    const itemMap = {};
    items.forEach(i => { if (!itemMap[i.menu_id]) itemMap[i.menu_id] = []; itemMap[i.menu_id].push(i); });
    res.json(menus.map(m => ({ ...m, items: itemMap[m.id] || [] })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/centers/:centerId/menus', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { week_label, week_start, week_end, items } = req.body;
    if (!week_start) return res.status(400).json({ error: 'week_start required' });
    const r = await db.prepare('INSERT INTO weekly_menus (center_id,week_label,week_start,week_end) VALUES (?,?,?,?)').run(req.params.centerId, week_label||`Week of ${week_start}`, week_start, week_end||week_start);
    if (Array.isArray(items)) {
      for (const i of items) {
        await db.prepare('INSERT INTO menu_items (menu_id,day_of_week,meal_type,items) VALUES (?,?,?,?)').run(r.lastInsertRowid, i.day_of_week, i.meal_type, i.items);
      }
    }
    res.json({ id: r.lastInsertRowid, week_label, week_start, week_end });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Dashboard ─────────────────────────────────────────────────────────────────

app.get('/api/dashboard', requireAuth, async (req, res) => {
  try {
    const centers = req.user.role === 'admin'
      ? await db.prepare('SELECT * FROM centers').all()
      : await db.prepare('SELECT c.* FROM centers c JOIN user_centers uc ON c.id = uc.center_id WHERE uc.user_id = ?').all(req.user.id);
    const today = new Date().toISOString().slice(0, 10);
    const nextWeek = new Date(Date.now() + 7*86400000).toISOString().slice(0, 10);
    const upcomingEvents = await db.prepare('SELECT * FROM calendar_events WHERE start_date BETWEEN ? AND ? ORDER BY start_date ASC LIMIT 10').all(today, nextWeek);
    res.json({ centers, upcomingEvents, stats: {} });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Staff ─────────────────────────────────────────────────────────────────────

app.get('/api/staff', requireAuth, async (req, res) => {
  try {
    const { center_id } = req.query;
    const rows = center_id
      ? await db.prepare('SELECT * FROM staff WHERE center_id = ? ORDER BY name').all(center_id)
      : req.user.role === 'admin'
        ? await db.prepare('SELECT s.*, c.name as center_name FROM staff s LEFT JOIN centers c ON c.id = s.center_id ORDER BY s.name').all()
        : await db.prepare('SELECT s.*, c.name as center_name FROM staff s LEFT JOIN centers c ON c.id = s.center_id JOIN user_centers uc ON uc.center_id = s.center_id WHERE uc.user_id = ? ORDER BY s.name').all(req.user.id);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/staff', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, title, email, phone, hire_date, center_id, status } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const r = await db.prepare('INSERT INTO staff (name,title,email,phone,hire_date,center_id,status) VALUES (?,?,?,?,?,?,?)').run(name, title||null, email||null, phone||null, hire_date||null, center_id||null, status||'active');
    await db.prepare('INSERT INTO staff_pto_balances (staff_id) VALUES (?) ON CONFLICT DO NOTHING').run(r.lastInsertRowid);
    res.json(await db.prepare('SELECT * FROM staff WHERE id = ?').get(r.lastInsertRowid));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/staff/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, title, email, phone, hire_date, center_id, status } = req.body;
    await db.prepare('UPDATE staff SET name=?,title=?,email=?,phone=?,hire_date=?,center_id=?,status=? WHERE id=?').run(name, title||null, email||null, phone||null, hire_date||null, center_id||null, status||'active', req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/staff/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await db.prepare('DELETE FROM staff WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Compliance ────────────────────────────────────────────────────────────────

app.get('/api/compliance/requirements', requireAuth, async (req, res) => {
  try { res.json(await db.prepare('SELECT * FROM compliance_requirements ORDER BY sort_order, name').all()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/compliance/staff/:staffId', requireAuth, async (req, res) => {
  try {
    res.json(await db.prepare('SELECT sc.*, cr.name as req_name, cr.recurs, cr.description FROM staff_compliance sc JOIN compliance_requirements cr ON cr.id = sc.requirement_id WHERE sc.staff_id = ?').all(req.params.staffId));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/compliance/center/:centerId', requireAuth, requireCenterAccess, async (req, res) => {
  try {
    const staff = await db.prepare("SELECT * FROM staff WHERE center_id = ? AND status = 'active'").all(req.params.centerId);
    const reqs = await db.prepare('SELECT * FROM compliance_requirements ORDER BY name').all();
    const records = await db.prepare('SELECT sc.* FROM staff_compliance sc JOIN staff s ON s.id = sc.staff_id WHERE s.center_id = ?').all(req.params.centerId);
    const today = new Date().toISOString().slice(0, 10);
    const matrix = staff.map(s => ({
      staff: s,
      compliance: reqs.map(r => {
        const rec = records.find(x => x.staff_id === s.id && x.requirement_id === r.id);
        let statusVal = 'missing';
        if (rec?.completed_date) {
          statusVal = (!rec.expiry_date || rec.expiry_date >= today) ? 'current' : 'expired';
        }
        return { requirement: r, record: rec||null, status: statusVal };
      }),
    }));
    res.json({ staff, requirements: reqs, matrix });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/compliance', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { staff_id, requirement_id, completed_date, expiry_date, notes } = req.body;
    await db.prepare('DELETE FROM staff_compliance WHERE staff_id=? AND requirement_id=?').run(staff_id, requirement_id);
    await db.prepare('INSERT INTO staff_compliance (staff_id,requirement_id,completed_date,expiry_date,notes) VALUES (?,?,?,?,?)').run(staff_id, requirement_id, completed_date||null, expiry_date||null, notes||null);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Time Off ─────────────────────────────────────────────────────────────────

app.get('/api/timeoff', requireAuth, async (req, res) => {
  try {
    const { center_id, staff_id, status } = req.query;
    let q = 'SELECT tor.*, s.name as staff_name, s.title as staff_title FROM time_off_requests tor JOIN staff s ON s.id = tor.staff_id WHERE 1=1';
    const params = [];
    if (center_id) { q += ' AND tor.center_id = ?'; params.push(center_id); }
    if (staff_id) { q += ' AND tor.staff_id = ?'; params.push(staff_id); }
    if (status) { q += ' AND tor.status = ?'; params.push(status); }
    q += ' ORDER BY tor.start_date DESC';
    res.json(await db.prepare(q).all(...params));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/timeoff', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { staff_id, center_id, type, start_date, end_date, hours, notes } = req.body;
    if (!staff_id || !type || !start_date || !end_date) return res.status(400).json({ error: 'staff_id, type, start_date, end_date required' });
    const r = await db.prepare('INSERT INTO time_off_requests (staff_id,center_id,type,start_date,end_date,hours,notes,status) VALUES (?,?,?,?,?,?,?,?)').run(staff_id, center_id||null, type, start_date, end_date, hours||null, notes||null, 'approved');
    res.json(await db.prepare('SELECT * FROM time_off_requests WHERE id = ?').get(r.lastInsertRowid));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/timeoff/:id/status', requireAuth, requireAdmin, async (req, res) => {
  try {
    await db.prepare('UPDATE time_off_requests SET status = ? WHERE id = ?').run(req.body.status, req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/timeoff/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await db.prepare('DELETE FROM time_off_requests WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/staff/:id/pto', requireAuth, async (req, res) => {
  try {
    const bal = await db.prepare('SELECT * FROM staff_pto_balances WHERE staff_id = ?').get(req.params.id);
    res.json(bal || { staff_id: req.params.id, vacation_hrs: 0, sick_hrs: 0, personal_hrs: 0 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/staff/:id/pto', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { vacation_hrs, sick_hrs, personal_hrs, as_of_date } = req.body;
    await db.prepare('DELETE FROM staff_pto_balances WHERE staff_id = ?').run(req.params.id);
    await db.prepare('INSERT INTO staff_pto_balances (staff_id,vacation_hrs,sick_hrs,personal_hrs,as_of_date) VALUES (?,?,?,?,?)').run(req.params.id, vacation_hrs||0, sick_hrs||0, personal_hrs||0, as_of_date||new Date().toISOString().slice(0,10));
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Schedule ─────────────────────────────────────────────────────────────────

app.get('/api/centers/:centerId/schedule', requireAuth, requireCenterAccess, async (req, res) => {
  try {
    const { week_start } = req.query;
    let q = 'SELECT ss.*, s.name as staff_name, s.title FROM schedule_shifts ss JOIN staff s ON s.id = ss.staff_id WHERE ss.center_id = ?';
    const params = [req.params.centerId];
    if (week_start) {
      const end = new Date(week_start); end.setDate(end.getDate() + 6);
      q += ' AND ss.shift_date BETWEEN ? AND ?';
      params.push(week_start, end.toISOString().slice(0, 10));
    }
    q += ' ORDER BY ss.shift_date, ss.start_time';
    res.json(await db.prepare(q).all(...params));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/centers/:centerId/schedule', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { staff_id, shift_date, start_time, end_time, role, notes } = req.body;
    if (!staff_id || !shift_date || !start_time || !end_time) return res.status(400).json({ error: 'staff_id, shift_date, start_time, end_time required' });
    const r = await db.prepare('INSERT INTO schedule_shifts (staff_id,center_id,shift_date,start_time,end_time,role,notes) VALUES (?,?,?,?,?,?,?)').run(staff_id, req.params.centerId, shift_date, start_time, end_time, role||null, notes||null);
    res.json(await db.prepare('SELECT ss.*, s.name as staff_name FROM schedule_shifts ss JOIN staff s ON s.id = ss.staff_id WHERE ss.id = ?').get(r.lastInsertRowid));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/schedule/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await db.prepare('DELETE FROM schedule_shifts WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Financials ───────────────────────────────────────────────────────────────

app.get('/api/centers/:centerId/financials', requireAuth, requireCenterAccess, async (req, res) => {
  try {
    res.json(await db.prepare('SELECT * FROM financial_snapshots WHERE center_id = ? ORDER BY period_start DESC').all(req.params.centerId));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/centers/:centerId/financials', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { period_label, period_start, period_end, revenue, expenses, payroll, food_costs, supplies, utilities, other_exp, notes } = req.body;
    if (!period_start) return res.status(400).json({ error: 'period_start required' });
    const r = await db.prepare('INSERT INTO financial_snapshots (center_id,period_label,period_start,period_end,revenue,expenses,payroll,food_costs,supplies,utilities,other_exp,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)')
      .run(req.params.centerId, period_label||`${period_start} period`, period_start, period_end||period_start, revenue||0, expenses||0, payroll||0, food_costs||0, supplies||0, utilities||0, other_exp||0, notes||null);
    res.json(await db.prepare('SELECT * FROM financial_snapshots WHERE id = ?').get(r.lastInsertRowid));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/financials/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { period_label, period_start, period_end, revenue, expenses, payroll, food_costs, supplies, utilities, other_exp, notes } = req.body;
    await db.prepare('UPDATE financial_snapshots SET period_label=?,period_start=?,period_end=?,revenue=?,expenses=?,payroll=?,food_costs=?,supplies=?,utilities=?,other_exp=?,notes=? WHERE id=?')
      .run(period_label, period_start, period_end, revenue||0, expenses||0, payroll||0, food_costs||0, supplies||0, utilities||0, other_exp||0, notes||null, req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/financials/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await db.prepare('DELETE FROM financial_snapshots WHERE id = ?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Kroger Pricing ───────────────────────────────────────────────────────────

let krogerToken = null, krogerTokenExpiry = 0;
async function getKrogerToken() {
  if (krogerToken && Date.now() < krogerTokenExpiry) return krogerToken;
  const clientId = process.env.KROGER_CLIENT_ID, clientSecret = process.env.KROGER_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  try {
    const https = require('https');
    return new Promise((resolve) => {
      const creds = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
      const body = 'grant_type=client_credentials&scope=product.compact';
      const req = https.request({ hostname: 'api.kroger.com', path: '/v1/connect/oauth2/token', method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'Authorization': `Basic ${creds}`, 'Content-Length': Buffer.byteLength(body) }
      }, res => {
        let d = ''; res.on('data', c => d += c);
        res.on('end', () => { try { const j = JSON.parse(d); krogerToken = j.access_token; krogerTokenExpiry = Date.now() + ((j.expires_in||1800)-60)*1000; resolve(krogerToken); } catch { resolve(null); } });
      });
      req.on('error', () => resolve(null)); req.write(body); req.end();
    });
  } catch { return null; }
}

app.post('/api/ingredients/lookup', requireAuth, async (req, res) => {
  const { query } = req.body;
  if (!query) return res.status(400).json({ error: 'query required' });
  const token = await getKrogerToken();
  if (!token) return res.json({ source: 'unavailable', message: 'Kroger API not configured.', products: [] });
  try {
    const https = require('https');
    const data = await new Promise((resolve) => {
      const path = `/v1/products?filter.term=${encodeURIComponent(query)}&filter.locationId=01400943&filter.limit=5`;
      const req = https.request({ hostname: 'api.kroger.com', path, method: 'GET', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' } }, res => {
        let d = ''; res.on('data', c => d += c); res.on('end', () => { try { resolve(JSON.parse(d)); } catch { resolve({}); } });
      });
      req.on('error', () => resolve({})); req.end();
    });
    const products = (data.data||[]).map(p => ({ name: p.description, brand: p.brand, size: p.items?.[0]?.size, price: p.items?.[0]?.price?.regular, sale_price: p.items?.[0]?.price?.promo }));
    res.json({ source: 'kroger', products });
  } catch (e) { res.json({ source: 'error', message: e.message, products: [] }); }
});

app.post('/api/ingredients/parse-list', requireAuth, async (req, res) => {
  try {
    const { text } = req.body;
    if (!text) return res.status(400).json({ error: 'text required' });
    const lines = text.split(/\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
    const items = lines.map(line => {
      const match = line.match(/^(\d+\.?\d*)\s*(lb[s]?|oz|gallon[s]?|quart[s]?|pint[s]?|each|case|bag[s]?|box(?:es)?|can[s]?|jar[s]?|dozen|pack[s]?|ct|count)\.?\s+(.+)$/i);
      if (match) return { qty: parseFloat(match[1]), unit: match[2].toLowerCase().replace(/s$/,''), name: match[3].trim() };
      return { qty: null, unit: null, name: line.replace(/^[\d.,]+\s*/, '').trim() };
    });
    for (const item of items) {
      if (item.name) await db.prepare('INSERT INTO ingredients (name) VALUES (?) ON CONFLICT DO NOTHING').run(item.name);
    }
    res.json({ items, count: items.length });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Price Auto-Refresh ────────────────────────────────────────────────────────

const PRICE_REFRESH_LOCATION = 'Appleton WI';
const PRICE_REFRESH_COOLDOWN_HOURS = 24;

async function getSetting(key) {
  const row = await db.prepare('SELECT value FROM settings WHERE key=?').get(key);
  return row?.value || null;
}
async function setSetting(key, val) {
  await db.prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value').run(key, val);
}

app.get('/api/ingredients/refresh-status', requireAuth, async (req, res) => {
  try {
    const status = await getSetting('price_refresh_status') || 'idle';
    const last   = await getSetting('last_price_refresh');
    const summary = await getSetting('price_refresh_summary');
    const hoursAgo = last ? (Date.now() - new Date(last).getTime()) / 3600000 : null;
    const canRefresh = !last || hoursAgo >= PRICE_REFRESH_COOLDOWN_HOURS;
    res.json({ status, lastRefresh: last, canRefresh, hoursUntilNext: canRefresh ? 0 : Math.ceil(PRICE_REFRESH_COOLDOWN_HOURS - hoursAgo), summary: summary ? JSON.parse(summary) : null });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/ingredients/refresh-prices', requireAuth, requireAdmin, async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'ANTHROPIC_API_KEY not set in Railway env vars.' });
  if (!process.env.BRAVE_SEARCH_API_KEY) return res.status(503).json({ error: 'BRAVE_SEARCH_API_KEY not set in Railway env vars.' });
  try {
    const force = req.query.force === 'true';
    const last = await getSetting('last_price_refresh');
    const status = await getSetting('price_refresh_status');
    if (status === 'running') return res.status(429).json({ error: 'A price refresh is already in progress.' });
    if (!force && last) {
      const hoursAgo = (Date.now() - new Date(last).getTime()) / 3600000;
      if (hoursAgo < PRICE_REFRESH_COOLDOWN_HOURS)
        return res.status(429).json({ error: `Prices were refreshed ${Math.round(hoursAgo)}h ago. Next refresh in ${Math.ceil(PRICE_REFRESH_COOLDOWN_HOURS - hoursAgo)}h.`, lastRefresh: last });
    }
    await setSetting('price_refresh_status', 'running');
    res.json({ status: 'started' });
    runPriceRefresh().catch(async err => { console.error('Price refresh error:', err); await setSetting('price_refresh_status', 'error'); });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

async function runPriceRefresh() {
  const ingredients = await db.prepare('SELECT * FROM ingredients ORDER BY name').all();
  const vendors = await db.prepare('SELECT * FROM vendors ORDER BY name').all();
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  let updated = 0, failed = 0, skipped = 0;

  for (const ingredient of ingredients) {
    for (const vendor of vendors) {
      try {
        // Targeted search: vendor name + ingredient — finds actual listed prices instead of guessing
        const q = encodeURIComponent(`"${vendor.name}" ${ingredient.name} price per ${ingredient.unit||'unit'}`);
        const searchRes = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${q}&count=5`, {
          headers: { 'Accept': 'application/json', 'X-Subscription-Token': process.env.BRAVE_SEARCH_API_KEY }
        });
        const searchData = await searchRes.json();
        const snippets = (searchData.web?.results||[]).slice(0,5).map(r => `${r.title}: ${r.description}`).join('\n');

        if (!snippets) { skipped++; continue; }

        const msg = await anthropic.messages.create({
          model: 'claude-haiku-4-5', max_tokens: 64,
          system: `Extract the price of "${ingredient.name}" sold by "${vendor.name}" from these search results.\nReturn ONLY valid JSON: {"price": 1.29, "unit": "lb"} — or {"price": null} if no confident price is found.\nDo NOT estimate or guess. Only return a price if it appears in the search results. No markdown.`,
          messages: [{ role: 'user', content: snippets }]
        });

        const raw = msg.content[0].text.replace(/^```(?:json)?\s*/i,'').replace(/\s*```\s*$/,'').trim();
        const result = JSON.parse(raw);

        if (result.price !== null && result.price !== undefined && !isNaN(Number(result.price))) {
          // Only overwrite if we found a real price — leaves manual entries intact when price is not found
          await db.prepare('DELETE FROM ingredient_prices WHERE ingredient_id=? AND vendor_id=? AND center_id IS NULL').run(ingredient.id, vendor.id);
          await db.prepare('INSERT INTO ingredient_prices (ingredient_id,vendor_id,center_id,price,unit,recorded_at) VALUES (?,?,NULL,?,?,CURRENT_DATE)').run(
            ingredient.id, vendor.id, Number(result.price), result.unit || ingredient.unit || 'each'
          );
          updated++;
        } else {
          skipped++; // No price found — manual entry (if any) is preserved
        }
      } catch (err) {
        console.error(`Price refresh failed for ${ingredient.name} @ ${vendor.name}:`, err.message);
        failed++;
      }
      await new Promise(r => setTimeout(r, 400)); // Respect Brave rate limits
    }
  }

  await setSetting('last_price_refresh', new Date().toISOString());
  await setSetting('price_refresh_status', 'done');
  await setSetting('price_refresh_summary', JSON.stringify({ updated, failed, skipped, total: ingredients.length * vendors.length }));
}

// ─── Recipes ──────────────────────────────────────────────────────────────────

app.post('/api/recipes/parse-document', requireAuth, requireAdmin, upload.single('file'), async (req, res) => {
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ error: 'AI parsing not configured — add ANTHROPIC_API_KEY to Railway env vars.' });
  if (!req.file) return res.status(400).json({ error: 'No file uploaded.' });
  try {
    let text = '';
    const mime = req.file.mimetype, name = req.file.originalname.toLowerCase();
    if (mime === 'application/pdf' || name.endsWith('.pdf')) {
      text = (await pdfParse(req.file.buffer)).text;
    } else if (mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || name.endsWith('.docx')) {
      text = (await mammoth.extractRawText({ buffer: req.file.buffer })).value;
    } else if (name.endsWith('.doc')) {
      return res.status(400).json({ error: 'Legacy .doc not supported. Save as .docx and try again.' });
    } else {
      return res.status(400).json({ error: 'Unsupported file type. Upload PDF or Word document.' });
    }
    if (!text.trim()) return res.status(400).json({ error: 'Could not extract text from document.' });
    const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5', max_tokens: 1024,
      system: `You are a recipe parser for a childcare company's food program. Extract recipe data and return ONLY valid JSON:\n{"name":"...","category":"Breakfast|Lunch|Dinner|Snack|Dessert or null","servings":N,"ingredients":[{"quantity":"1","unit":"cup","name":"flour"}],"steps":["Step 1"],"notes":"... or null"}\nIf multiple recipes, return only the first. No markdown.`,
      messages: [{ role: 'user', content: text.slice(0, 8000) }]
    });
    const raw = message.content[0].text.replace(/^```(?:json)?\s*/i,'').replace(/\s*```\s*$/,'').trim();
    res.json(JSON.parse(raw));
  } catch (err) { console.error('Recipe parse error:', err); res.status(500).json({ error: 'Failed to parse document: ' + err.message }); }
});

app.get('/api/recipes', requireAuth, async (req, res) => {
  try {
    const { center_id } = req.query;
    const rows = center_id
      ? await db.prepare('SELECT * FROM recipes WHERE center_id IS NULL OR center_id = ? ORDER BY name').all(center_id)
      : await db.prepare('SELECT * FROM recipes ORDER BY name').all();
    res.json(rows.map(r => ({ ...r, ingredients: JSON.parse(r.ingredients||'[]'), steps: JSON.parse(r.steps||'[]') })));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

async function syncRecipeIngredients(ingredients) {
  for (const ing of (ingredients||[])) {
    const n = (ing.name||'').trim();
    if (n) await db.prepare('INSERT INTO ingredients (name) VALUES (?) ON CONFLICT DO NOTHING').run(n);
  }
}

app.post('/api/recipes', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { center_id, name, category, servings, ingredients, steps, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const r = await db.prepare('INSERT INTO recipes (center_id,name,category,servings,ingredients,steps,notes) VALUES (?,?,?,?,?,?,?)').run(center_id||null, name, category||null, servings||1, JSON.stringify(ingredients||[]), JSON.stringify(steps||[]), notes||null);
    await syncRecipeIngredients(ingredients);
    res.json(await db.prepare('SELECT * FROM recipes WHERE id=?').get(r.lastInsertRowid));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/recipes/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, category, servings, ingredients, steps, notes } = req.body;
    await db.prepare('UPDATE recipes SET name=?,category=?,servings=?,ingredients=?,steps=?,notes=?,updated_at=NOW() WHERE id=?').run(name, category||null, servings||1, JSON.stringify(ingredients||[]), JSON.stringify(steps||[]), notes||null, req.params.id);
    await syncRecipeIngredients(ingredients);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/recipes/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await db.prepare('DELETE FROM recipes WHERE id=?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Center Compliance ────────────────────────────────────────────────────────

app.get('/api/centers/:centerId/center-compliance', requireAuth, requireCenterAccess, async (req, res) => {
  try { res.json(await db.prepare('SELECT * FROM center_compliance WHERE center_id=? ORDER BY due_date ASC').all(req.params.centerId)); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/centers/:centerId/center-compliance', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, type, description, state, due_date, completed_date, recurs, notes } = req.body;
    if (!name) return res.status(400).json({ error: 'Name required' });
    const r = await db.prepare('INSERT INTO center_compliance (center_id,name,type,description,state,due_date,completed_date,recurs,notes) VALUES (?,?,?,?,?,?,?,?,?)').run(req.params.centerId, name, type||'licensing', description||null, state||null, due_date||null, completed_date||null, recurs||'annual', notes||null);
    res.json(await db.prepare('SELECT * FROM center_compliance WHERE id=?').get(r.lastInsertRowid));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/center-compliance/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { name, type, description, state, due_date, completed_date, recurs, notes } = req.body;
    await db.prepare('UPDATE center_compliance SET name=?,type=?,description=?,state=?,due_date=?,completed_date=?,recurs=?,notes=?,updated_at=NOW() WHERE id=?').run(name, type||'licensing', description||null, state||null, due_date||null, completed_date||null, recurs||'annual', notes||null, req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/center-compliance/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await db.prepare('DELETE FROM center_compliance WHERE id=?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Staff Points ─────────────────────────────────────────────────────────────

app.get('/api/staff/:id/points', requireAuth, async (req, res) => {
  try {
    const rows = await db.prepare('SELECT sp.*, u.name as recorded_by_name FROM staff_points sp LEFT JOIN users u ON sp.recorded_by=u.id WHERE sp.staff_id=? ORDER BY sp.event_date DESC, sp.created_at DESC').all(req.params.id);
    res.json({ history: rows, total: rows.reduce((sum, r) => sum + r.points, 0) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/staff/:id/points', requireAuth, async (req, res) => {
  try {
    const { type, points, notes, event_date } = req.body;
    if (!type || points == null) return res.status(400).json({ error: 'type and points required' });
    const r = await db.prepare('INSERT INTO staff_points (staff_id,type,points,notes,recorded_by,event_date) VALUES (?,?,?,?,?,?)').run(req.params.id, type, points, notes||null, req.user.id, event_date||new Date().toISOString().split('T')[0]);
    res.json(await db.prepare('SELECT * FROM staff_points WHERE id=?').get(r.lastInsertRowid));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/points/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await db.prepare('DELETE FROM staff_points WHERE id=?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Staff Reviews ────────────────────────────────────────────────────────────

app.get('/api/reviews', requireAuth, async (req, res) => {
  try {
    let rows;
    if (req.user.role === 'admin') {
      rows = await db.prepare('SELECT sr.*, s.name as staff_name, s.title as staff_title, s.center_id, u.name as reviewer_name FROM staff_reviews sr JOIN staff s ON sr.staff_id=s.id LEFT JOIN users u ON sr.reviewed_by=u.id ORDER BY sr.created_at DESC').all();
    } else {
      const centers = (await db.prepare('SELECT center_id FROM user_centers WHERE user_id=?').all(req.user.id)).map(r => r.center_id);
      if (!centers.length) return res.json([]);
      const placeholders = centers.map((_,i) => `$${i+1}`).join(',');
      const { rows: r2 } = await db.pool.query(`SELECT sr.*, s.name as staff_name, s.title as staff_title, u.name as reviewer_name FROM staff_reviews sr JOIN staff s ON sr.staff_id=s.id LEFT JOIN users u ON sr.reviewed_by=u.id WHERE s.center_id IN (${placeholders}) ORDER BY sr.created_at DESC`, centers);
      rows = r2;
    }
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/reviews', requireAuth, async (req, res) => {
  try {
    const { staff_id, review_period, positives, growth_areas, focus_areas, notes } = req.body;
    if (!staff_id || !review_period) return res.status(400).json({ error: 'staff_id and review_period required' });
    const r = await db.prepare('INSERT INTO staff_reviews (staff_id,review_period,positives,growth_areas,focus_areas,notes,reviewed_by) VALUES (?,?,?,?,?,?,?)').run(staff_id, review_period, positives||null, growth_areas||null, focus_areas||null, notes||null, req.user.id);
    res.json(await db.prepare('SELECT * FROM staff_reviews WHERE id=?').get(r.lastInsertRowid));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.put('/api/reviews/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { review_period, positives, growth_areas, focus_areas, notes } = req.body;
    await db.prepare('UPDATE staff_reviews SET review_period=?,positives=?,growth_areas=?,focus_areas=?,notes=?,updated_at=NOW() WHERE id=?').run(review_period, positives||null, growth_areas||null, focus_areas||null, notes||null, req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/staff/:id/reviews', requireAuth, async (req, res) => {
  try {
    res.json(await db.prepare('SELECT sr.*, u.name as reviewer_name FROM staff_reviews sr LEFT JOIN users u ON sr.reviewed_by=u.id WHERE sr.staff_id=? ORDER BY sr.created_at DESC').all(req.params.id));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Handbooks ────────────────────────────────────────────────────────────────

app.get('/api/handbooks', requireAuth, async (req, res) => {
  try { res.json(await db.prepare('SELECT * FROM handbook_documents ORDER BY type, updated_at DESC').all()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/handbooks', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { type, title, file_url, notes } = req.body;
    if (!type || !title) return res.status(400).json({ error: 'type and title required' });
    const r = await db.prepare('INSERT INTO handbook_documents (type,title,file_url,notes) VALUES (?,?,?,?)').run(type, title, file_url||null, notes||null);
    res.json(await db.prepare('SELECT * FROM handbook_documents WHERE id=?').get(r.lastInsertRowid));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.delete('/api/handbooks/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    await db.prepare('DELETE FROM handbook_documents WHERE id=?').run(req.params.id);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Catch-all ────────────────────────────────────────────────────────────────

if (fs.existsSync(FRONTEND_BUILD)) {
  app.get('*', (req, res) => res.sendFile(path.join(FRONTEND_BUILD, 'index.html')));
}

app.listen(PORT, () => console.log(`OMH Portal running on port ${PORT}`));
