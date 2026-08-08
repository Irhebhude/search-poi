/**
 * Typed client for the SEARCH-POI enterprise API surface
 * (organizations, RAG knowledge base, live support, analytics & reports).
 *
 * Every call is a same-origin `fetch` to /api/* with the session cookie.
 */

const BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

async function call<T>(path: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json: payload, ...rest } = init ?? {};
  const res = await fetch(`${BASE}${path}`, {
    credentials: "include",
    headers: payload ? { "Content-Type": "application/json" } : undefined,
    body: payload ? JSON.stringify(payload) : undefined,
    ...rest,
  });
  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { error: text };
  }
  if (!res.ok) throw new Error(body?.error || `Request failed (${res.status})`);
  return (body?.data ?? body) as T;
}

/* --------------------------------- types ---------------------------------- */

export type OrgRole = "owner" | "admin" | "member" | "viewer";

export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: string;
  logo_url: string | null;
  primary_color: string | null;
  brand_name: string | null;
  custom_domain: string | null;
  role?: OrgRole;
  created_at: string;
}

export interface OrgMember {
  id: string;
  user_id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: OrgRole;
  status: string;
  created_at: string;
}

export interface AuditEntry {
  id: string;
  action: string;
  actor_email: string | null;
  resource_type: string | null;
  resource_id: string | null;
  metadata: string;
  created_at: string;
}

export interface Collection {
  id: string;
  name: string;
  description: string | null;
  is_public: number;
  document_count: number;
  created_at: string;
}

export interface KbDocument {
  id: string;
  title: string;
  source_url: string | null;
  status: string;
  chunk_count: number;
  created_at: string;
}

export interface Citation {
  n: number;
  title: string;
  source_url: string | null;
  document_id: string;
  score: number;
  cited: boolean;
}

export interface RagAnswer {
  conversation_id: string;
  answer: string;
  citations: Citation[];
  grounded: boolean;
  confidence: number;
}

export interface SupportConversation {
  id: string;
  user_name: string | null;
  user_email: string | null;
  subject: string | null;
  status: "open" | "pending" | "closed";
  assigned_agent_name: string | null;
  device: string | null;
  browser: string | null;
  message_count?: number;
  last_message_at: string;
  started_at: string;
}

export interface SupportMessage {
  id: string;
  sender_role: "user" | "agent" | "system" | "note";
  sender_name: string | null;
  body: string;
  attachment_url: string | null;
  attachment_name: string | null;
  created_at: string;
}

export interface ForecastResult {
  metric: string;
  history: Array<{ date: string; value: number }>;
  forecast: Array<{ date: string; value: number; lower: number; upper: number }>;
  anomalies: Array<{ date: string; value: number; expected: number; z: number }>;
}

/* --------------------------------- orgs ----------------------------------- */

export const orgs = {
  list: () => call<Organization[]>("/api/orgs"),
  create: (name: string) => call<Organization>("/api/orgs", { method: "POST", json: { name } }),
  get: (id: string) => call<Organization>(`/api/orgs/${id}`),
  update: (id: string, patch: Partial<Organization>) => call<Organization>(`/api/orgs/${id}`, { method: "PUT", json: patch }),
  members: (id: string) => call<OrgMember[]>(`/api/orgs/${id}/members`),
  invite: (id: string, email: string, role: OrgRole) =>
    call<{ token: string; email: string }>(`/api/orgs/${id}/invites`, { method: "POST", json: { email, role } }),
  acceptInvite: (token: string) => call<{ org_id: string }>("/api/orgs/accept-invite", { method: "POST", json: { token } }),
  setRole: (id: string, userId: string, role: OrgRole) =>
    call(`/api/orgs/${id}/members/${userId}`, { method: "PUT", json: { role } }),
  removeMember: (id: string, userId: string) => call(`/api/orgs/${id}/members/${userId}`, { method: "DELETE" }),
  teams: (id: string) => call<any[]>(`/api/orgs/${id}/teams`),
  createTeam: (id: string, name: string, description?: string) =>
    call(`/api/orgs/${id}/teams`, { method: "POST", json: { name, description } }),
  audit: (id: string) => call<AuditEntry[]>(`/api/orgs/${id}/audit`),
  usage: (id: string) => call<{ period: string; plan: string; metrics: Array<{ metric: string; used: number; quota: number }> }>(`/api/orgs/${id}/usage`),
};

/* ---------------------------- knowledge base ------------------------------ */

export const kb = {
  collections: (orgId?: string) => call<Collection[]>(`/api/rag/collections${orgId ? `?org_id=${orgId}` : ""}`),
  createCollection: (name: string, opts?: { description?: string; org_id?: string; is_public?: boolean }) =>
    call<Collection>("/api/rag/collections", { method: "POST", json: { name, ...opts } }),
  documents: (collectionId: string) => call<KbDocument[]>(`/api/rag/documents?collection_id=${collectionId}`),
  ingest: (payload: { collection_id: string; title?: string; content?: string; source_url?: string; metadata?: Record<string, unknown> }) =>
    call<{ id: string; chunks: number; deduplicated: boolean }>("/api/rag/documents", { method: "POST", json: payload }),
  deleteDocument: (id: string) => call(`/api/rag/documents/${id}`, { method: "DELETE" }),
  search: (query: string, collectionId?: string, topK = 6) =>
    call<any[]>("/api/rag/search", { method: "POST", json: { query, collection_id: collectionId, top_k: topK } }),
  ask: (query: string, opts?: { collection_id?: string; conversation_id?: string }) =>
    call<RagAnswer>("/api/rag/chat", { method: "POST", json: { query, ...opts } }),
  conversations: () => call<any[]>("/api/rag/conversations"),
  messages: (id: string) => call<any[]>(`/api/rag/conversations/${id}`),
};

/* -------------------------------- support --------------------------------- */

export const support = {
  start: (payload: { name?: string; email?: string; subject?: string; message?: string; org_id?: string }) =>
    call<{ id: string }>("/api/support/conversations", { method: "POST", json: payload }),
  list: (status?: string) => call<SupportConversation[]>(`/api/support/conversations${status ? `?status=${status}` : ""}`),
  get: (id: string) => call<SupportConversation>(`/api/support/conversations/${id}`),
  messages: async (id: string, since?: string) => {
    const res = await fetch(`${BASE}/api/support/conversations/${id}/messages${since ? `?since=${encodeURIComponent(since)}` : ""}`, {
      credentials: "include",
    });
    if (!res.ok) throw new Error("Could not load messages");
    return res.json() as Promise<{ data: SupportMessage[]; presence: Array<{ actor: string; typing: boolean }>; server_time: string }>;
  },
  send: (id: string, body: string, attachment?: { url: string; name: string; type: string }) =>
    call<SupportMessage>(`/api/support/conversations/${id}/messages`, { method: "POST", json: { body, attachment } }),
  typing: (id: string, typing: boolean) => call(`/api/support/conversations/${id}/typing`, { method: "POST", json: { typing } }),
  assign: (id: string) => call(`/api/support/conversations/${id}/assign`, { method: "POST", json: {} }),
  close: (id: string) => call<{ transcript_emailed_to: string }>(`/api/support/conversations/${id}/close`, { method: "POST", json: {} }),
  transcript: (id: string) => call<{ transcript: string }>(`/api/support/conversations/${id}/transcript`),
  upload: async (file: File) => {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${BASE}/api/support/upload`, { method: "POST", credentials: "include", body: form });
    if (!res.ok) throw new Error("Upload failed");
    return (await res.json()).data as { url: string; name: string; type: string };
  },
};

/* -------------------------- analytics + reports ---------------------------- */

export const insights = {
  report: (type: string, opts?: { org_id?: string; from?: string; to?: string }) => {
    const q = new URLSearchParams({ type, ...(opts?.org_id ? { org_id: opts.org_id } : {}), ...(opts?.from ? { from: opts.from } : {}), ...(opts?.to ? { to: opts.to } : {}) });
    return call<any>(`/api/analytics/report?${q}`);
  },
  forecast: (metric = "searches", horizon = 14, orgId?: string) =>
    call<ForecastResult>(`/api/analytics/forecast?metric=${metric}&horizon=${horizon}${orgId ? `&org_id=${orgId}` : ""}`),
  heatmap: (path: string) => call<any[]>(`/api/analytics/heatmap?path=${encodeURIComponent(path)}`),
  journeys: () => call<any[]>("/api/analytics/journeys"),
};

export { call as apiCall };
