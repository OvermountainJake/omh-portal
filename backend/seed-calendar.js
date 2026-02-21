/**
 * Seed the calendar with 2026 YCDC events extracted from Dave's email attachments.
 * Run: node seed-calendar.js
 */
const db = require('./database');

const CENTER_ID = 1; // YCDC Appleton

const events = [
  // ── January ──────────────────────────────────────────────────────────────
  { date: '2026-01-01', title: 'Closed — New Year\'s Day', category: 'management' },
  { date: '2026-01-02', title: 'Census Day — Possible Closure', category: 'management' },
  { date: '2026-01-06', title: 'PJ Jam Family Night', desc: '5:30–6:30 PM', category: 'family' },
  { date: '2026-01-07', title: 'Family Connection Kit Goes Home', category: 'family' },
  { date: '2026-01-14', title: 'Guide and Grow Kit Goes Home', category: 'family' },
  { date: '2026-01-19', title: 'Closed — MLK Day / Staff Training Day', category: 'management' },
  { date: '2026-01-27', title: 'Hot Cocoa Night', desc: '5:30–7:30 PM', category: 'family' },

  // ── February ─────────────────────────────────────────────────────────────
  { date: '2026-02-10', title: 'Pyramid Model Scavenger Hunt at Pick-Up', category: 'family' },
  { date: '2026-02-11', title: 'Family Connection Kit Goes Home', category: 'family' },
  { date: '2026-02-13', title: 'Wear Red, White & Pink Day', category: 'family' },
  { date: '2026-02-15', title: 'January Portfolio Checks', category: 'management' },
  { date: '2026-02-16', title: 'Close at 3 PM — NAMI Training', category: 'management' },
  { date: '2026-02-18', title: 'Guide and Grow Kit Goes Home', category: 'family' },

  // ── March ────────────────────────────────────────────────────────────────
  { date: '2026-03-11', title: 'Family Connection Kit Goes Home', category: 'family' },
  { date: '2026-03-15', title: 'February Portfolio Checks', category: 'management' },
  { date: '2026-03-16', title: 'Close at 3 PM — CCRR Behavior Management', category: 'management' },
  { date: '2026-03-18', title: 'Guide and Grow Kit Goes Home', category: 'family' },
  { date: '2026-03-19', title: 'Tucker Emotion Bingo Family Night', desc: '5:30–6:30 PM', category: 'family' },
  { date: '2026-03-30', title: 'ASQ\'s for Parents / Teacher Conference Forms Out', category: 'management' },

  // ── April ────────────────────────────────────────────────────────────────
  { date: '2026-04-03', title: 'Closed — Good Friday', category: 'management' },
  { date: '2026-04-08', title: 'Family Connection Kit Goes Home', category: 'family' },
  { date: '2026-04-10', title: 'Teacher Conference Forms Due', category: 'management' },
  { date: '2026-04-15', title: 'Guide and Grow Kit Goes Home', category: 'family' },
  { date: '2026-04-19', title: 'March Portfolio Checks', category: 'management' },
  { date: '2026-04-20', title: 'Close at 3 PM — Parent/Teacher Conferences', desc: '2:00–5:00 PM', category: 'management' },

  // ── May ──────────────────────────────────────────────────────────────────
  { date: '2026-05-13', title: 'Family Connection Kit Goes Home', category: 'family' },
  { date: '2026-05-17', title: 'April Portfolio Checks', category: 'management' },
  { date: '2026-05-18', title: 'Close at 3 PM — Tucker Tours the Town Family Night', desc: '3:30–6:30 PM', category: 'family' },
  { date: '2026-05-20', title: 'Guide and Grow Kit Goes Home', category: 'family' },
  { date: '2026-05-25', title: 'Closed — Memorial Day', category: 'management' },
  { date: '2026-05-26', title: 'Tie Dye Family Night', desc: '5:30–7:30 PM — Center Sunscreen Starts', category: 'family' },

  // ── June ─────────────────────────────────────────────────────────────────
  { date: '2026-06-08', title: 'Summer Camp Starts', category: 'management' },
  { date: '2026-06-09', title: 'Family Connection Kit Goes Home', category: 'family' },
  { date: '2026-06-15', title: 'Close at 3 PM — Strategic Planning', category: 'management' },
  { date: '2026-06-17', title: 'Guide and Grow Kit Goes Home', category: 'family' },
  { date: '2026-06-21', title: 'May Portfolio Checks', category: 'management' },
  { date: '2026-06-23', title: 'Park Night', desc: '5:30–6:30 PM', category: 'family' },

  // ── July ─────────────────────────────────────────────────────────────────
  { date: '2026-07-03', title: 'Closed — 4th of July', category: 'management' },
  { date: '2026-07-08', title: 'Family Connection Kit Goes Home', category: 'family' },
  { date: '2026-07-15', title: 'Guide and Grow Kit Goes Home', category: 'family' },
  { date: '2026-07-19', title: 'June Portfolio Checks', category: 'management' },
  { date: '2026-07-20', title: 'Close at 3 PM — Water Night', desc: '3:30–6:30 PM', category: 'family' },

  // ── August ───────────────────────────────────────────────────────────────
  { date: '2026-08-12', title: 'Family Connection Kit Goes Home', category: 'family' },
  { date: '2026-08-13', title: 'Park Night', desc: '5:30–6:30 PM', category: 'family' },
  { date: '2026-08-16', title: 'July Portfolio Checks', category: 'management' },
  { date: '2026-08-17', title: 'Closed — Staff Training Day', category: 'management' },
  { date: '2026-08-18', title: 'Fall Parent Paperwork Goes Out', category: 'management' },
  { date: '2026-08-19', title: 'Guide and Grow Kit Goes Home', category: 'family' },
  { date: '2026-08-21', title: 'Summer Camp Ends', category: 'management' },

  // ── September ────────────────────────────────────────────────────────────
  { date: '2026-09-01', title: 'Fall Paperwork Due', category: 'management' },
  { date: '2026-09-02', title: 'Last Park Night of the Year', desc: '5:30–6:30 PM', category: 'family' },
  { date: '2026-09-04', title: 'Center Sunscreen Ends', category: 'management' },
  { date: '2026-09-07', title: 'Closed — Labor Day', category: 'management' },
  { date: '2026-09-09', title: 'Family Connection Kit Goes Home', category: 'family' },
  { date: '2026-09-16', title: 'Guide and Grow Kit Goes Home', category: 'family' },
  { date: '2026-09-17', title: 'Pirate Scavenger Hunt', category: 'family' },
  { date: '2026-09-20', title: 'August Portfolio Checks', category: 'management' },
  { date: '2026-09-21', title: 'Close at 3 PM', category: 'management' },

  // ── October ──────────────────────────────────────────────────────────────
  { date: '2026-10-14', title: 'Family Connection Kit Goes Home', category: 'family' },
  { date: '2026-10-18', title: 'September Portfolio Checks', category: 'management' },
  { date: '2026-10-19', title: 'Close at 3 PM — Fall Harvest Party', desc: '3:30–5:00 PM', category: 'family' },
  { date: '2026-10-21', title: 'Guide and Grow Kit Goes Home', category: 'family' },
  { date: '2026-10-26', title: 'ASQ\'s for Parents / Teacher Conference Forms Out', category: 'management' },

  // ── November ─────────────────────────────────────────────────────────────
  { date: '2026-11-06', title: 'Teacher Conference Forms Due', category: 'management' },
  { date: '2026-11-11', title: 'Family Connection Kit Goes Home', category: 'family' },
  { date: '2026-11-15', title: 'October Portfolio Checks', category: 'management' },
  { date: '2026-11-16', title: 'Close at 3 PM — Parent/Teacher Conferences', category: 'management' },
  { date: '2026-11-17', title: 'Giving Tree Set Up / Amazon Wishlists Due', category: 'management' },
  { date: '2026-11-18', title: 'Guide and Grow Kit Goes Home', category: 'family' },
  { date: '2026-11-26', title: 'Closed — Thanksgiving', category: 'management' },
  { date: '2026-11-27', title: 'Closed — Thanksgiving', category: 'management' },

  // ── December ─────────────────────────────────────────────────────────────
  { date: '2026-12-09', title: 'Family Connection Kit Goes Home', category: 'family' },
  { date: '2026-12-11', title: 'Christmas Holiday Party (Tentative)', category: 'family' },
  { date: '2026-12-16', title: 'Guide and Grow Kit Goes Home', category: 'family' },
  { date: '2026-12-20', title: 'November Portfolio Checks', category: 'management' },
  { date: '2026-12-21', title: 'Close at 3 PM — No Staff Meeting', category: 'management' },
  { date: '2026-12-24', title: 'Closed — Christmas Eve', category: 'management' },
  { date: '2026-12-25', title: 'Closed — Christmas Day', category: 'management' },
  { date: '2026-12-31', title: 'Closed — New Year\'s Eve', category: 'management' },
];

const insert = db.prepare(`
  INSERT OR IGNORE INTO calendar_events (center_id, title, description, start_date, category)
  VALUES (?, ?, ?, ?, ?)
`);

const tx = db.transaction(() => {
  let count = 0;
  for (const e of events) {
    insert.run(CENTER_ID, e.title, e.desc || null, e.date, e.category);
    count++;
  }
  return count;
});

const n = tx();
console.log(`✓ Seeded ${n} calendar events for YCDC 2026`);
