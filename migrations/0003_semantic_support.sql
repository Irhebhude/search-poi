-- SEARCH-POI Engine v1 — semantic search + support/analytics tables.
-- Safe to re-run: everything is IF NOT EXISTS, and the pois.embedding column
-- is created as part of the table definition for fresh databases.
--
-- If `pois` already exists without the column, run once:
--   ALTER TABLE pois ADD COLUMN embedding TEXT;

CREATE TABLE IF NOT EXISTS pois (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  category     TEXT,
  address      TEXT,
  phone        TEXT,
  website      TEXT,
  lat          REAL,
  lon          REAL,
  city         TEXT,
  country      TEXT,
  source       TEXT DEFAULT 'osm',
  trust_score  INTEGER DEFAULT 70,
  embedding    TEXT,
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pois_city ON pois(city);
CREATE INDEX IF NOT EXISTS idx_pois_category ON pois(category);

CREATE TABLE IF NOT EXISTS support_tickets (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  email      TEXT,
  message    TEXT,
  status     TEXT DEFAULT 'open',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS analytics (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  path      TEXT,
  user_id   TEXT,
  timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_analytics_path ON analytics(path);
CREATE INDEX IF NOT EXISTS idx_support_status ON support_tickets(status);
