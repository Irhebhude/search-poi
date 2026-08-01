-- SEARCH-POI ENGINE v1 — Cloudflare D1 schema
-- Apply with: wrangler d1 execute search-poi-db --remote --file=./migrations/0001_init.sql

-- ---------------------------------------------------------------- auth
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT,
  image TEXT,
  password_hash TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,
  provider_account_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  UNIQUE (provider, provider_account_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);

CREATE TABLE IF NOT EXISTS password_resets (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS user_roles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('admin','moderator','user')),
  created_at TEXT NOT NULL,
  UNIQUE (user_id, role)
);

-- ------------------------------------------------------------ profiles
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  username TEXT,
  display_name TEXT,
  avatar_url TEXT,
  referral_code TEXT NOT NULL UNIQUE,
  referred_by TEXT REFERENCES profiles(id),
  email_verified INTEGER NOT NULL DEFAULT 1,
  search_count INTEGER NOT NULL DEFAULT 0,
  signup_ip TEXT,
  is_premium INTEGER NOT NULL DEFAULT 0,
  premium_since TEXT,
  poi_points INTEGER NOT NULL DEFAULT 0,
  lite_mode INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- ------------------------------------------------------------ referrals
CREATE TABLE IF NOT EXISTS referrals (
  id TEXT PRIMARY KEY,
  referrer_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referred_id TEXT NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  verified_at TEXT
);

CREATE TABLE IF NOT EXISTS referral_rewards (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reward_type TEXT NOT NULL DEFAULT 'premium_month',
  referral_batch INTEGER NOT NULL,
  activated_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  UNIQUE (user_id, referral_batch)
);

-- --------------------------------------------------------------- search
CREATE TABLE IF NOT EXISTS search_activity (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  query TEXT NOT NULL,
  search_mode TEXT NOT NULL DEFAULT 'default',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS trending_searches (
  id TEXT PRIMARY KEY,
  query TEXT NOT NULL,
  search_count INTEGER NOT NULL DEFAULT 1,
  last_searched_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_trending_query ON trending_searches(lower(query));

CREATE TABLE IF NOT EXISTS trending_content (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  content TEXT NOT NULL,
  category TEXT NOT NULL,
  keywords TEXT,
  view_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS shared_searches (
  id TEXT PRIMARY KEY,
  user_id TEXT,
  query TEXT NOT NULL,
  answer TEXT NOT NULL,
  search_mode TEXT NOT NULL DEFAULT 'default',
  sources TEXT,
  slug TEXT NOT NULL UNIQUE,
  view_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

-- ------------------------------------------------------- knowledge vaults
CREATE TABLE IF NOT EXISTS knowledge_vaults (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  slug TEXT NOT NULL UNIQUE,
  is_public INTEGER NOT NULL DEFAULT 0,
  view_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS knowledge_vault_items (
  id TEXT PRIMARY KEY,
  vault_id TEXT NOT NULL REFERENCES knowledge_vaults(id) ON DELETE CASCADE,
  user_id TEXT,
  query TEXT NOT NULL,
  answer TEXT,
  sources TEXT,
  created_at TEXT NOT NULL
);

-- ----------------------------------------------------------- businesses
CREATE TABLE IF NOT EXISTS businesses (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL,
  phone TEXT,
  whatsapp TEXT,
  email TEXT,
  website TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  country TEXT NOT NULL DEFAULT 'Nigeria',
  is_verified INTEGER NOT NULL DEFAULT 0,
  verified_at TEXT,
  trust_score INTEGER NOT NULL DEFAULT 50,
  logo_url TEXT,
  inventory_csv_url TEXT,
  member_discount_percent REAL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- ---------------------------------------------------------- POI points
CREATE TABLE IF NOT EXISTS poi_tasks (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  points_reward INTEGER NOT NULL DEFAULT 10,
  task_type TEXT NOT NULL DEFAULT 'general',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS poi_task_completions (
  id TEXT PRIMARY KEY,
  task_id TEXT NOT NULL REFERENCES poi_tasks(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  proof_data TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS poi_points_log (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  points INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- -------------------------------------------------------- developer API
CREATE TABLE IF NOT EXISTS api_keys (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  key_hash TEXT NOT NULL UNIQUE,
  key_prefix TEXT NOT NULL,
  name TEXT NOT NULL,
  credits_remaining INTEGER NOT NULL DEFAULT 100,
  total_calls INTEGER NOT NULL DEFAULT 0,
  is_active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  last_used_at TEXT
);

CREATE TABLE IF NOT EXISTS api_usage_log (
  id TEXT PRIMARY KEY,
  api_key_id TEXT NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
  query TEXT NOT NULL,
  mode TEXT NOT NULL DEFAULT 'default',
  tokens_used INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

-- ------------------------------------------------------------ deal room
CREATE TABLE IF NOT EXISTS deal_documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_size INTEGER,
  mime_type TEXT,
  uploaded_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS deal_access_requests (
  id TEXT PRIMARY KEY,
  document_id TEXT REFERENCES deal_documents(id) ON DELETE CASCADE,
  buyer_name TEXT NOT NULL,
  buyer_email TEXT NOT NULL,
  message TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  download_token TEXT,
  token_expires_at TEXT,
  approved_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS deal_visitor_logs (
  id TEXT PRIMARY KEY,
  event_type TEXT NOT NULL,
  buyer_email TEXT,
  document_id TEXT REFERENCES deal_documents(id) ON DELETE SET NULL,
  user_agent TEXT,
  created_at TEXT NOT NULL
);

-- ------------------------------------------------------- inbound forms
CREATE TABLE IF NOT EXISTS contact_messages (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  subject TEXT NOT NULL,
  message TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS feedback (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  message TEXT NOT NULL,
  ai_response TEXT,
  rating INTEGER,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS waitlist (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  company TEXT,
  use_case TEXT,
  created_at TEXT NOT NULL
);
