-- 1. USERS - for Google Login
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY, -- Google sub ID
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  picture TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. POIS - Places of Interest
CREATE TABLE IF NOT EXISTS pois (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT, -- restaurant, hospital, etc
  address TEXT,
  lat REAL NOT NULL,
  lng REAL NOT NULL,
  image_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 3. REVIEWS
CREATE TABLE IF NOT EXISTS reviews (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  poi_id INTEGER NOT NULL,
  user_id TEXT NOT NULL,
  rating INTEGER CHECK(rating >= 1 AND rating <= 5),
  comment TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (poi_id) REFERENCES pois(id) ON DELETE CASCADE,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 4. BOOKMARKS / FAVORITES
CREATE TABLE IF NOT EXISTS bookmarks (
  user_id TEXT NOT NULL,
  poi_id INTEGER NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (user_id, poi_id),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  FOREIGN KEY (poi_id) REFERENCES pois(id) ON DELETE CASCADE
);

-- Index for fast location search
CREATE INDEX IF NOT EXISTS idx_pois_location ON pois(lat, lng);
