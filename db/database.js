const initSqlJs = require('sql.js');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, 'autolead.db');
let db = null;

async function getDb() {
  if (db) return db;
  const SQL = await initSqlJs();
  if (fs.existsSync(DB_PATH)) {
    const buf = fs.readFileSync(DB_PATH);
    db = new SQL.Database(buf);
  } else {
    db = new SQL.Database();
  }
  initSchema();
  seedData();
  persist();
  return db;
}

function persist() {
  if (!db) return;
  fs.writeFileSync(DB_PATH, Buffer.from(db.export()));
}

function run(sql, params = []) {
  db.run(sql, params);
  persist();
}

function get(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  if (stmt.step()) {
    const cols = stmt.getColumnNames();
    const vals = stmt.get();
    stmt.free();
    const row = {};
    cols.forEach((c, i) => row[c] = vals[i]);
    return row;
  }
  stmt.free();
  return null;
}

function all(sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    const cols = stmt.getColumnNames();
    const vals = stmt.get();
    const row = {};
    cols.forEach((c, i) => row[c] = vals[i]);
    rows.push(row);
  }
  stmt.free();
  return rows;
}

function lastId() {
  const r = get('SELECT last_insert_rowid() as id');
  return r ? r.id : null;
}

function initSchema() {
  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL, fullName TEXT NOT NULL, role TEXT NOT NULL DEFAULT 'sales',
    supervisorId INTEGER, active INTEGER NOT NULL DEFAULT 1,
    createdAt TEXT NOT NULL DEFAULT (date('now'))
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS leads (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, phone TEXT NOT NULL,
    carType TEXT DEFAULT 'Tiggo 8 Comfort', source TEXT DEFAULT 'Walk-in',
    date TEXT NOT NULL DEFAULT (date('now')), status TEXT DEFAULT 'Hot',
    followUp TEXT, notes TEXT, createdBy TEXT NOT NULL,
    createdAt TEXT NOT NULL DEFAULT (date('now')),
    updatedAt TEXT, updatedBy TEXT
  )`);
  db.run(`CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`);
}

function seedData() {
  const row = get('SELECT COUNT(*) as c FROM users');
  if (row && row.c > 0) return;

  const h = pw => bcrypt.hashSync(pw, 10);
  const users = [
    [1,'admin',h('admin123'),'Nurul Hana','admin',null],
  ];
  users.forEach(u => db.run(
    'INSERT INTO users (id,username,password,fullName,role,supervisorId,active,createdAt) VALUES (?,?,?,?,?,?,1,?)',
    [...u, '2026-01-01']
  ));

  // No demo leads - start fresh

  const settings = {
    statuses: ['Hot','Warm','Cold','SPK','LOST'],
    sources: ['Walk-in','Social Media','Ads','Referral','Exhibition','Event','Movex'],
    carTypes: ['Tiggo 8 Comfort','Tiggo 8 Premium','Tiggo Cross Comfort','Tiggo Cross Premium','Tiggo Cross CSH','Chery E5','Chery C5 Z','Chery C5 RZ','Chery C5 CSH','J6 FWD','J6 IWD','J6T FWD','J6T IWD','Omoda GT FWD','Tiggo 9 CSH'],
    statusColors: {
      Hot:'#EF4444',Warm:'#F59E0B',Cold:'#3B82F6',SPK:'#22C55E',LOST:'#64748B'
    },
    sourceColors: {
      'Walk-in':'#3B82F6','Social Media':'#A78BFA',Ads:'#EF4444',
      Referral:'#F59E0B',Exhibition:'#EC4899',Event:'#06B6D4',Movex:'#22C55E'
    }
  };
  Object.entries(settings).forEach(([k, v]) =>
    db.run('INSERT OR IGNORE INTO settings (key,value) VALUES (?,?)', [k, JSON.stringify(v)])
  );

  console.log('✅ Admin account created (username: admin)');
}

module.exports = { getDb, run, get, all, lastId, persist };
