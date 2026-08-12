-- V2: fact-based document index + public search API keys.

CREATE TABLE IF NOT EXISTS documents (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  content TEXT NOT NULL,
  source TEXT DEFAULT 'web',
  price REAL DEFAULT NULL,
  location TEXT DEFAULT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_documents_title ON documents(title);
CREATE INDEX IF NOT EXISTS idx_documents_updated ON documents(updated_at);

-- Public search keys (the existing `api_keys` table belongs to the developer platform).
CREATE TABLE IF NOT EXISTS search_api_keys (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  key TEXT UNIQUE NOT NULL,
  owner_email TEXT NOT NULL,
  owner_name TEXT,
  requests_count INTEGER DEFAULT 0,
  period TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  is_active INTEGER DEFAULT 1
);

-- Backfill POIs into the document index.
INSERT INTO documents (title, url, content, source, location, updated_at)
SELECT
  name,
  COALESCE(website, 'https://www.openstreetmap.org/?mlat=' || COALESCE(lat, 0) || '&mlon=' || COALESCE(lon, 0)),
  COALESCE(name, '') || ' ' || COALESCE(address, '') || ' ' || COALESCE(city, ''),
  'poi',
  COALESCE(city, country),
  CURRENT_TIMESTAMP
FROM pois
WHERE NOT EXISTS (SELECT 1 FROM documents WHERE source = 'poi');
