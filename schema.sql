-- Cloudflare D1 schema for SEARCH-POI add-on modules (13-20).
-- Run: wrangler d1 execute search-poi-db --file=./schema.sql

CREATE TABLE IF NOT EXISTS trips (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  origin TEXT,
  destination TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS expenses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  amount REAL,
  note TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ratings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  poi_id TEXT,
  score INTEGER,
  comment TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  home_address TEXT,
  work_address TEXT,
  updated_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sos_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT,
  lat REAL,
  lon REAL,
  created_at TEXT DEFAULT (datetime('now'))
);
