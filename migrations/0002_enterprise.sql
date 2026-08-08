-- SEARCH-POI Engine V1 — Enterprise migration (D1)
-- Adds: multi-tenancy + RBAC, RAG/vector store, behaviour analytics,
-- developer platform (webhooks, OAuth2 clients), reporting, live support.
-- Backward compatible: no existing table is dropped or renamed.

/* ============================ 1. Multi-tenancy ============================ */

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  plan TEXT NOT NULL DEFAULT 'free',           -- free | pro | business | enterprise
  logo_url TEXT,
  primary_color TEXT,
  brand_name TEXT,
  custom_domain TEXT,
  sso_provider TEXT,                            -- google | saml | oidc
  sso_metadata TEXT,                            -- JSON
  settings TEXT NOT NULL DEFAULT '{}',          -- JSON
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_org_owner ON organizations(owner_id);

CREATE TABLE IF NOT EXISTS org_roles (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,                           -- owner | admin | member | viewer | custom
  permissions TEXT NOT NULL DEFAULT '[]',       -- JSON array of permission keys
  is_system INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  UNIQUE (org_id, name)
);

CREATE TABLE IF NOT EXISTS org_members (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  role_id TEXT REFERENCES org_roles(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'active',        -- active | suspended
  created_at TEXT NOT NULL,
  UNIQUE (org_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_org_members_user ON org_members(user_id);

CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS team_members (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TEXT NOT NULL,
  UNIQUE (team_id, user_id)
);

CREATE TABLE IF NOT EXISTS workspaces (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  team_id TEXT REFERENCES teams(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  settings TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  UNIQUE (org_id, slug)
);

CREATE TABLE IF NOT EXISTS org_invites (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  token TEXT NOT NULL UNIQUE,
  invited_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'pending',       -- pending | accepted | revoked | expired
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_invites_email ON org_invites(email);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  org_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
  actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  actor_email TEXT,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  ip TEXT,
  user_agent TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_audit_org_time ON audit_logs(org_id, created_at DESC);

CREATE TABLE IF NOT EXISTS org_quotas (
  id TEXT PRIMARY KEY,
  org_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  period TEXT NOT NULL,                         -- YYYY-MM
  metric TEXT NOT NULL,                         -- searches | api_calls | documents | storage_bytes | support_chats
  used INTEGER NOT NULL DEFAULT 0,
  quota INTEGER NOT NULL DEFAULT 0,             -- 0 = unlimited
  updated_at TEXT NOT NULL,
  UNIQUE (org_id, period, metric)
);

/* ============================== 2. RAG store ============================== */

CREATE TABLE IF NOT EXISTS collections (
  id TEXT PRIMARY KEY,
  org_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  slug TEXT NOT NULL,
  description TEXT,
  is_public INTEGER NOT NULL DEFAULT 0,
  embedding_model TEXT NOT NULL DEFAULT '@cf/baai/bge-base-en-v1.5',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_collections_org ON collections(org_id);

CREATE TABLE IF NOT EXISTS documents (
  id TEXT PRIMARY KEY,
  collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  org_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  source_url TEXT,
  mime_type TEXT,
  content TEXT NOT NULL,
  content_hash TEXT,
  metadata TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'indexed',       -- pending | indexed | failed
  chunk_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_documents_collection ON documents(collection_id);
CREATE INDEX IF NOT EXISTS idx_documents_hash ON documents(content_hash);

CREATE TABLE IF NOT EXISTS document_chunks (
  id TEXT PRIMARY KEY,
  document_id TEXT NOT NULL REFERENCES documents(id) ON DELETE CASCADE,
  collection_id TEXT NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
  org_id TEXT,
  chunk_index INTEGER NOT NULL,
  content TEXT NOT NULL,
  token_estimate INTEGER NOT NULL DEFAULT 0,
  embedding TEXT,                               -- JSON float array (fallback store)
  vector_id TEXT,                               -- Vectorize id when available
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_chunks_collection ON document_chunks(collection_id);
CREATE INDEX IF NOT EXISTS idx_chunks_document ON document_chunks(document_id);

CREATE TABLE IF NOT EXISTS rag_conversations (
  id TEXT PRIMARY KEY,
  collection_id TEXT REFERENCES collections(id) ON DELETE SET NULL,
  org_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  title TEXT NOT NULL DEFAULT 'New conversation',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rag_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES rag_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL,                           -- user | assistant | system
  content TEXT NOT NULL,
  citations TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_rag_messages_conv ON rag_messages(conversation_id);

/* ======================== 3. Behaviour + analytics ======================== */

CREATE TABLE IF NOT EXISTS user_events (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  org_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,                     -- search | click | view | dwell | abandon | convert | nav
  query TEXT,
  target_url TEXT,
  position INTEGER,
  dwell_ms INTEGER,
  path TEXT,
  referrer TEXT,
  device TEXT,
  browser TEXT,
  os TEXT,
  country TEXT,
  city TEXT,
  viewport_w INTEGER,
  viewport_h INTEGER,
  x INTEGER,
  y INTEGER,
  metadata TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_events_type_time ON user_events(event_type, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_events_session ON user_events(session_id);
CREATE INDEX IF NOT EXISTS idx_events_query ON user_events(query);

-- Aggregated click-through signal consumed by the AI ranking engine.
CREATE TABLE IF NOT EXISTS ranking_signals (
  id TEXT PRIMARY KEY,
  query_norm TEXT NOT NULL,
  target_url TEXT NOT NULL,
  impressions INTEGER NOT NULL DEFAULT 0,
  clicks INTEGER NOT NULL DEFAULT 0,
  dwell_total_ms INTEGER NOT NULL DEFAULT 0,
  last_seen TEXT NOT NULL,
  UNIQUE (query_norm, target_url)
);

CREATE TABLE IF NOT EXISTS forecasts (
  id TEXT PRIMARY KEY,
  org_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
  metric TEXT NOT NULL,
  horizon_days INTEGER NOT NULL,
  points TEXT NOT NULL,                         -- JSON [{date, value, lower, upper}]
  method TEXT NOT NULL DEFAULT 'holt-linear',
  created_at TEXT NOT NULL
);

/* ====================== 4. Developer platform tables ====================== */

CREATE TABLE IF NOT EXISTS oauth_clients (
  id TEXT PRIMARY KEY,
  org_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  client_id TEXT NOT NULL UNIQUE,
  client_secret_hash TEXT NOT NULL,
  redirect_uris TEXT NOT NULL DEFAULT '[]',
  scopes TEXT NOT NULL DEFAULT 'search:read',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS oauth_tokens (
  id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  access_token TEXT NOT NULL UNIQUE,
  refresh_token TEXT UNIQUE,
  scopes TEXT NOT NULL DEFAULT '',
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS webhooks (
  id TEXT PRIMARY KEY,
  org_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  events TEXT NOT NULL DEFAULT '[]',
  secret TEXT NOT NULL,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id TEXT PRIMARY KEY,
  webhook_id TEXT NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
  event TEXT NOT NULL,
  payload TEXT NOT NULL,
  status_code INTEGER,
  error TEXT,
  attempts INTEGER NOT NULL DEFAULT 0,
  delivered_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS rate_limit_buckets (
  id TEXT PRIMARY KEY,                          -- key:window
  hits INTEGER NOT NULL DEFAULT 0,
  window_start TEXT NOT NULL
);

/* ============================== 5. Reporting ============================= */

CREATE TABLE IF NOT EXISTS report_definitions (
  id TEXT PRIMARY KEY,
  org_id TEXT REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,                           -- search | user | organization | performance | revenue | usage
  filters TEXT NOT NULL DEFAULT '{}',
  schedule TEXT,                                -- daily | weekly | monthly | null
  recipients TEXT NOT NULL DEFAULT '[]',
  format TEXT NOT NULL DEFAULT 'pdf',           -- pdf | xlsx | csv
  last_run_at TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS report_runs (
  id TEXT PRIMARY KEY,
  report_id TEXT REFERENCES report_definitions(id) ON DELETE CASCADE,
  org_id TEXT,
  type TEXT NOT NULL,
  range_from TEXT,
  range_to TEXT,
  rows INTEGER NOT NULL DEFAULT 0,
  payload TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL
);

/* ============================ 6. Live support ============================ */

CREATE TABLE IF NOT EXISTS support_conversations (
  id TEXT PRIMARY KEY,
  org_id TEXT REFERENCES organizations(id) ON DELETE SET NULL,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  user_name TEXT,
  user_email TEXT,
  subject TEXT,
  status TEXT NOT NULL DEFAULT 'open',          -- open | pending | closed
  assigned_agent_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  assigned_agent_name TEXT,
  tags TEXT NOT NULL DEFAULT '[]',
  device TEXT,
  browser TEXT,
  os TEXT,
  ip TEXT,
  started_at TEXT NOT NULL,
  closed_at TEXT,
  last_message_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_support_status ON support_conversations(status, last_message_at DESC);

CREATE TABLE IF NOT EXISTS support_messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES support_conversations(id) ON DELETE CASCADE,
  sender_role TEXT NOT NULL,                    -- user | agent | system | note
  sender_id TEXT,
  sender_name TEXT,
  body TEXT NOT NULL DEFAULT '',
  attachment_url TEXT,
  attachment_name TEXT,
  attachment_type TEXT,
  read_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_support_messages_conv ON support_messages(conversation_id, created_at);

CREATE TABLE IF NOT EXISTS support_presence (
  id TEXT PRIMARY KEY,                          -- conversation_id:actor
  conversation_id TEXT NOT NULL,
  actor TEXT NOT NULL,
  typing INTEGER NOT NULL DEFAULT 0,
  online INTEGER NOT NULL DEFAULT 1,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS support_transcripts (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES support_conversations(id) ON DELETE CASCADE,
  transcript TEXT NOT NULL,
  html TEXT,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS email_queue (
  id TEXT PRIMARY KEY,
  to_address TEXT NOT NULL,
  subject TEXT NOT NULL,
  body_text TEXT NOT NULL,
  body_html TEXT,
  status TEXT NOT NULL DEFAULT 'pending',       -- pending | sent | failed
  attempts INTEGER NOT NULL DEFAULT 0,
  last_error TEXT,
  next_attempt_at TEXT,
  sent_at TEXT,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_email_queue_status ON email_queue(status, next_attempt_at);

/* ====================== 7. Extend existing API tables ==================== */
-- api_keys gains org scoping + scopes. SQLite ignores duplicates only if the
-- column is missing, so these run once on a fresh DB and are safe to skip on
-- re-run (wrap in your migration runner's try/catch).
-- ALTER TABLE api_keys ADD COLUMN org_id TEXT;
-- ALTER TABLE api_keys ADD COLUMN scopes TEXT NOT NULL DEFAULT 'search:read';
