/**
 * Seed menu data from Fall Winter 2025 Master.docx
 * Run: node seed-menus.js
 */
const db = require('./database');
const CENTER_ID = 1;

const menus = [
  {
    week_label: 'Week 1 — Dec 1–5, 2025',
    week_start: '2025-12-01', week_end: '2025-12-05',
    items: [
      { day: 'Monday',    meal: 'Breakfast', items: 'WG Cheerios, Pineapple, Milk' },
      { day: 'Monday',    meal: 'Lunch',     items: 'Cheesy Hamburger Rice, Carrots, Peaches, Milk' },
      { day: 'Monday',    meal: 'Snack',     items: 'Vanilla Wafers, Bananas, Water' },
      { day: 'Tuesday',   meal: 'Breakfast', items: 'Yogurt, Blueberries, Milk' },
      { day: 'Tuesday',   meal: 'Lunch',     items: 'Macaroni & Cheese, Corn, Pears, Milk' },
      { day: 'Tuesday',   meal: 'Snack',     items: 'WG Trail Mix, Apple Slices, Water' },
      { day: 'Wednesday', meal: 'Breakfast', items: 'Pancake, Applesauce, Milk' },
      { day: 'Wednesday', meal: 'Lunch',     items: 'Chicken Pot Pie w/ Biscuits, Green Beans, Pineapple, Milk' },
      { day: 'Wednesday', meal: 'Snack',     items: 'WG Baked Granola Bar, Milk' },
      { day: 'Thursday',  meal: 'Breakfast', items: 'Cornflakes, Pears, Milk' },
      { day: 'Thursday',  meal: 'Lunch',     items: 'Tomato Soup, WG Grilled Cheese, Mandarin Oranges, Milk' },
      { day: 'Thursday',  meal: 'Snack',     items: 'Animal Crackers, Yogurt, Water' },
      { day: 'Friday',    meal: 'Breakfast', items: 'Bagels w/ Cream Cheese, Peaches, Milk' },
      { day: 'Friday',    meal: 'Lunch',     items: 'Italian Dunkers w/ Marinara, Mixed Vegetables, Mixed Fruit, Milk' },
      { day: 'Friday',    meal: 'Snack',     items: 'WG Quick Bread, Milk' },
    ],
  },
  {
    week_label: 'Week 2 — Dec 8–12, 2025',
    week_start: '2025-12-08', week_end: '2025-12-12',
    items: [
      { day: 'Monday',    meal: 'Breakfast', items: 'Cornflakes, Peaches, Milk' },
      { day: 'Monday',    meal: 'Lunch',     items: 'Egg Fried Rice, Corn, Pears, Milk' },
      { day: 'Monday',    meal: 'Snack',     items: 'WG Baked Granola Bar, Milk' },
      { day: 'Tuesday',   meal: 'Breakfast', items: 'Cottage Cheese, Pears, Milk' },
      { day: 'Tuesday',   meal: 'Lunch',     items: 'Chicken Alfredo Pasta, Green Beans, Pineapple, Milk' },
      { day: 'Tuesday',   meal: 'Snack',     items: 'WG Trail Mix, Banana, Water' },
      { day: 'Wednesday', meal: 'Breakfast', items: 'Waffle, Applesauce, Milk' },
      { day: 'Wednesday', meal: 'Lunch',     items: 'English Muffin Cheese Pizza, Peas, Mandarin Oranges, Milk' },
      { day: 'Wednesday', meal: 'Snack',     items: 'WG Round Crackers, Fresh Veggies, Water' },
      { day: 'Thursday',  meal: 'Breakfast', items: 'WG Cheerios, Pineapple, Milk' },
      { day: 'Thursday',  meal: 'Lunch',     items: 'Lasagna Soup, Peaches, Milk' },
      { day: 'Thursday',  meal: 'Snack',     items: 'Cottage Cheese Dip, Apple Slices, Water' },
      { day: 'Friday',    meal: 'Breakfast', items: 'WG Muffin, Banana, Milk' },
      { day: 'Friday',    meal: 'Lunch',     items: 'Turkey Tacos, Mixed Vegetables, Mixed Fruit, Milk' },
      { day: 'Friday',    meal: 'Snack',     items: 'Crackers, Cheese Stick, Water' },
    ],
  },
  {
    week_label: 'Week 3 — Dec 15–19, 2025',
    week_start: '2025-12-15', week_end: '2025-12-19',
    items: [
      { day: 'Monday',    meal: 'Breakfast', items: 'WG Cheerios, Pears, Milk' },
      { day: 'Monday',    meal: 'Lunch',     items: 'Chicken Cordon Bleu Rice, Green Beans, Pineapple, Milk' },
      { day: 'Monday',    meal: 'Snack',     items: 'Vanilla Wafers, Bananas, Water' },
      { day: 'Tuesday',   meal: 'Breakfast', items: 'Yogurt, Strawberries, Milk' },
      { day: 'Tuesday',   meal: 'Lunch',     items: 'Hamburger Casserole, Peas, Mandarin Oranges, Milk' },
      { day: 'Tuesday',   meal: 'Snack',     items: 'WG Trail Mix, Apple Slices, Water' },
      { day: 'Wednesday', meal: 'Breakfast', items: 'Crumpet, Applesauce, Milk' },
      { day: 'Wednesday', meal: 'Lunch',     items: 'Hot Dog on a Bun, Carrots, Peaches, Milk' },
      { day: 'Wednesday', meal: 'Snack',     items: 'WG Baked Granola Bar, Milk' },
      { day: 'Thursday',  meal: 'Breakfast', items: 'Cornflakes, Peaches, Milk' },
      { day: 'Thursday',  meal: 'Lunch',     items: 'Chicken Noodle Soup, Pears, Milk' },
      { day: 'Thursday',  meal: 'Snack',     items: 'WG Graham Cracker, Yogurt, Water' },
      { day: 'Friday',    meal: 'Breakfast', items: 'Bagel w/ Cream Cheese, Pineapple, Milk' },
      { day: 'Friday',    meal: 'Lunch',     items: 'Bean & Cheese Burrito, Mixed Vegetables, Mixed Fruit, Milk' },
      { day: 'Friday',    meal: 'Snack',     items: 'WG Quick Bread, Milk' },
    ],
  },
  {
    week_label: 'Week 4 — Dec 22–26, 2025',
    week_start: '2025-12-22', week_end: '2025-12-26',
    items: [
      { day: 'Monday',    meal: 'Breakfast', items: 'Cornflakes, Pineapple, Milk' },
      { day: 'Monday',    meal: 'Lunch',     items: 'Chicken Broccoli Rice, Mandarin Oranges, Milk' },
      { day: 'Monday',    meal: 'Snack',     items: 'WG Baked Granola Bar, Milk' },
      { day: 'Tuesday',   meal: 'Breakfast', items: 'Cottage Cheese, Mixed Berries, Milk' },
      { day: 'Tuesday',   meal: 'Lunch',     items: 'Baked Ziti w/ Marinara, Carrots, Peaches, Milk' },
      { day: 'Tuesday',   meal: 'Snack',     items: 'WG Trail Mix, Banana, Water' },
      { day: 'Wednesday', meal: 'Breakfast', items: 'WG French Toast, Applesauce, Milk' },
      { day: 'Wednesday', meal: 'Lunch',     items: 'Chili with Noodles, Corn, Pears, Milk' },
      { day: 'Wednesday', meal: 'Snack',     items: 'Club Crackers, Fresh Veggies, Water' },
      { day: 'Thursday',  meal: 'Breakfast', items: 'WG Cheerios, Peaches, Milk' },
      { day: 'Thursday',  meal: 'Lunch',     items: 'Egg & Hashbrown Bake, WG Toast, Pineapple, Milk' },
      { day: 'Thursday',  meal: 'Snack',     items: 'Cottage Cheese Dip, Apple Slices, Water' },
      { day: 'Friday',    meal: 'Breakfast', items: 'WG Muffin, Pears, Milk' },
      { day: 'Friday',    meal: 'Lunch',     items: 'Cheese Quesadilla, Mixed Vegetables, Mixed Fruit, Milk' },
      { day: 'Friday',    meal: 'Snack',     items: 'Crackers, Cheese Stick, Water' },
    ],
  },
];

// Check if already seeded
const existing = db.prepare('SELECT COUNT(*) as n FROM weekly_menus WHERE center_id = ?').get(CENTER_ID).n;
if (existing > 0) { console.log(`Already have ${existing} menus, skipping seed`); process.exit(0); }

const insertMenu = db.prepare('INSERT INTO weekly_menus (center_id, week_label, week_start, week_end) VALUES (?,?,?,?)');
const insertItem = db.prepare('INSERT INTO menu_items (menu_id, day_of_week, meal_type, items) VALUES (?,?,?,?)');

const tx = db.transaction(() => {
  let total = 0;
  for (const menu of menus) {
    const r = insertMenu.run(CENTER_ID, menu.week_label, menu.week_start, menu.week_end);
    menu.items.forEach(item => { insertItem.run(r.lastInsertRowid, item.day, item.meal, item.items); total++; });
  }
  return total;
});

const n = tx();
console.log(`✓ Seeded ${menus.length} menus with ${n} items for YCDC`);
