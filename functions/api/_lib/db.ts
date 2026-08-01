/**
 * D1 access layer for the SEARCH-POI REST API.
 *
 * Exposes a small, strictly-allowlisted query compiler so the browser can run
 * table reads/writes without ever sending raw SQL. Every identifier is checked
 * against the table config below; every value is bound as a parameter.
 */

export interface TableRule {
  /** Columns clients may read. `*` means all. */
  select: "*" | string[];
  /** Columns clients may write. Empty array = writes disabled. */
  write: string[];
  /** Column holding the owning user id, if the table is user-scoped. */
  ownerColumn?: string;
  /** Reads allowed without a session. */
  publicRead?: boolean;
  /** Inserts allowed without a session. */
  publicInsert?: boolean;
  /** Only admins may read. */
  adminRead?: boolean;
  /** Extra SQL predicate applied to public reads. */
  publicReadWhere?: string;
}

export const TABLES: Record<string, TableRule> = {
  profiles: {
    select: "*",
    write: ["display_name", "username", "avatar_url", "lite_mode", "is_premium", "signup_ip"],
    ownerColumn: "id",
    publicRead: true,
  },
  user_roles: { select: "*", write: [], ownerColumn: "user_id" },
  businesses: {
    select: "*",
    write: [
      "name", "description", "category", "phone", "whatsapp", "email", "website",
      "address", "city", "state", "country", "logo_url", "inventory_csv_url",
      "member_discount_percent",
    ],
    ownerColumn: "owner_id",
    publicRead: true,
  },
  knowledge_vaults: {
    select: "*",
    write: ["name", "description", "slug", "is_public"],
    ownerColumn: "user_id",
    publicRead: true,
    publicReadWhere: "is_public = 1",
  },
  knowledge_vault_items: {
    select: "*",
    write: ["vault_id", "query", "answer", "sources"],
    ownerColumn: "user_id",
    publicRead: true,
  },
  shared_searches: {
    select: "*",
    write: ["query", "answer", "search_mode", "sources", "slug"],
    ownerColumn: "user_id",
    publicRead: true,
    publicInsert: true,
  },
  trending_searches: { select: "*", write: [], publicRead: true },
  trending_content: { select: "*", write: ["view_count"], publicRead: true },
  search_activity: { select: "*", write: [], publicRead: true },
  contact_messages: {
    select: "*",
    write: ["full_name", "email", "subject", "message"],
    adminRead: true,
    publicInsert: true,
  },
  feedback: {
    select: "*",
    write: ["full_name", "email", "category", "message", "ai_response", "rating"],
    adminRead: true,
    publicInsert: true,
  },
  waitlist: {
    select: "*",
    write: ["full_name", "email", "company", "use_case"],
    adminRead: true,
    publicInsert: true,
  },
  referrals: { select: "*", write: [], ownerColumn: "referrer_id" },
  referral_rewards: { select: "*", write: [], ownerColumn: "user_id" },
  poi_tasks: { select: "*", write: [], publicRead: true },
  poi_task_completions: {
    select: "*",
    write: ["task_id", "proof_data", "status"],
    ownerColumn: "user_id",
  },
  poi_points_log: { select: "*", write: [], ownerColumn: "user_id" },
  api_keys: {
    select: "*",
    write: ["name", "is_active"],
    ownerColumn: "user_id",
  },
  api_usage_log: { select: "*", write: [], adminRead: true },
  deal_documents: {
    select: "*",
    write: ["title", "description", "category", "file_path", "file_name", "file_size", "mime_type"],
    adminRead: true,
  },
  deal_access_requests: {
    select: "*",
    write: ["document_id", "buyer_name", "buyer_email", "message", "status", "download_token", "token_expires_at", "approved_at"],
    adminRead: true,
    publicInsert: true,
  },
  deal_visitor_logs: {
    select: "*",
    write: ["event_type", "buyer_email", "document_id", "user_agent"],
    adminRead: true,
    publicInsert: true,
  },
};

const IDENT = /^[a-z_][a-z0-9_]*$/i;

export interface QueryBody {
  columns?: string;
  filters?: Array<{ column: string; op: string; value: unknown }>;
  order?: { column: string; ascending: boolean } | null;
  limit?: number | null;
  rowMode?: "many" | "single" | "maybeSingle";
  values?: Record<string, unknown> | Array<Record<string, unknown>> | null;
  returning?: boolean;
}

const OPS: Record<string, string> = {
  eq: "=", neq: "!=", gt: ">", gte: ">=", lt: "<", lte: "<=", like: "LIKE",
};

function ident(name: string): string {
  if (!IDENT.test(name)) throw new Error(`Invalid identifier: ${name}`);
  return `"${name}"`;
}

function projection(rule: TableRule, columns?: string): string {
  if (!columns || columns.trim() === "*") {
    return rule.select === "*" ? "*" : rule.select.map(ident).join(", ");
  }
  const wanted = columns.split(",").map((c) => c.trim()).filter(Boolean);
  const allowed = wanted.filter((c) => rule.select === "*" || rule.select.includes(c));
  if (!allowed.length) throw new Error("No readable columns requested");
  return allowed.map(ident).join(", ");
}

function buildWhere(filters: QueryBody["filters"], binds: unknown[]): string[] {
  const clauses: string[] = [];
  for (const f of filters ?? []) {
    const col = ident(f.column);
    if (f.op === "in") {
      const arr = Array.isArray(f.value) ? f.value : [];
      if (!arr.length) { clauses.push("0 = 1"); continue; }
      clauses.push(`${col} IN (${arr.map(() => "?").join(", ")})`);
      binds.push(...arr.map(normalize));
      continue;
    }
    if (f.op === "is") {
      clauses.push(f.value === null ? `${col} IS NULL` : `${col} IS NOT NULL`);
      continue;
    }
    const sqlOp = OPS[f.op];
    if (!sqlOp) throw new Error(`Unsupported operator: ${f.op}`);
    clauses.push(`${col} ${sqlOp} ?`);
    binds.push(normalize(f.value));
  }
  return clauses;
}

function normalize(v: unknown): unknown {
  if (v === undefined) return null;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (v !== null && typeof v === "object") return JSON.stringify(v);
  return v;
}

/** Parses JSON-ish text columns back into objects for the client. */
function hydrate(row: Record<string, unknown> | null) {
  if (!row) return row;
  for (const [k, v] of Object.entries(row)) {
    if (typeof v === "string" && (k === "sources" || k === "proof_data" || k === "keywords")) {
      try { row[k] = JSON.parse(v); } catch { /* leave as text */ }
    }
    if (typeof v === "number" && /^(is_|email_verified|lite_mode)/.test(k)) {
      row[k] = Boolean(v);
    }
  }
  return row;
}

export interface Actor {
  userId: string | null;
  isAdmin: boolean;
}

export async function runTableQuery(
  db: D1Database,
  table: string,
  action: "select" | "insert" | "update" | "delete",
  body: QueryBody,
  actor: Actor,
) {
  const rule = TABLES[table];
  if (!rule) throw new Error(`Unknown table: ${table}`);

  if (action === "select") {
    if (rule.adminRead && !actor.isAdmin) {
      if (!rule.ownerColumn) throw new Error("Not authorised to read this table");
    }
    const binds: unknown[] = [];
    const clauses = buildWhere(body.filters, binds);

    if (!actor.isAdmin) {
      if (rule.ownerColumn && !rule.publicRead) {
        if (!actor.userId) throw new Error("Authentication required");
        clauses.push(`${ident(rule.ownerColumn)} = ?`);
        binds.push(actor.userId);
      } else if (rule.publicReadWhere && !actor.userId) {
        clauses.push(rule.publicReadWhere);
      } else if (rule.adminRead) {
        if (!actor.userId) throw new Error("Authentication required");
        clauses.push(`${ident(rule.ownerColumn!)} = ?`);
        binds.push(actor.userId);
      }
    }

    let sql = `SELECT ${projection(rule, body.columns)} FROM ${ident(table)}`;
    if (clauses.length) sql += ` WHERE ${clauses.join(" AND ")}`;
    if (body.order) sql += ` ORDER BY ${ident(body.order.column)} ${body.order.ascending ? "ASC" : "DESC"}`;
    const single = body.rowMode === "single" || body.rowMode === "maybeSingle";
    if (body.limit) sql += ` LIMIT ${Math.min(Number(body.limit) || 50, 500)}`;
    else if (single) sql += " LIMIT 1";

    const stmt = db.prepare(sql).bind(...binds);
    if (single) {
      const row = await stmt.first<Record<string, unknown>>();
      if (!row && body.rowMode === "single") throw new Error("No rows found");
      return hydrate(row);
    }
    const res = await stmt.all<Record<string, unknown>>();
    return (res.results || []).map((r) => hydrate(r));
  }

  if (action === "insert") {
    if (!rule.write.length) throw new Error("Inserts are disabled for this table");
    if (!actor.userId && !rule.publicInsert) throw new Error("Authentication required");
    const rows = Array.isArray(body.values) ? body.values : [body.values || {}];
    const inserted: unknown[] = [];
    for (const raw of rows) {
      const record: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(raw)) {
        if (rule.write.includes(k)) record[k] = normalize(v);
      }
      if (rule.ownerColumn && actor.userId) record[rule.ownerColumn] = actor.userId;
      record.id = (raw as any).id || crypto.randomUUID();
      record.created_at = new Date().toISOString();
      if (!Object.keys(record).length) throw new Error("No writable columns supplied");
      const cols = Object.keys(record);
      const sql = `INSERT INTO ${ident(table)} (${cols.map(ident).join(", ")}) VALUES (${cols.map(() => "?").join(", ")}) RETURNING *`;
      const row = await db.prepare(sql).bind(...cols.map((c) => record[c])).first<Record<string, unknown>>();
      inserted.push(hydrate(row));
    }
    return Array.isArray(body.values) ? inserted : inserted[0];
  }

  if (action === "update") {
    if (!rule.write.length) throw new Error("Updates are disabled for this table");
    const patch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries((body.values as Record<string, unknown>) || {})) {
      if (rule.write.includes(k)) patch[k] = normalize(v);
    }
    if (!Object.keys(patch).length) throw new Error("No writable columns supplied");
    const binds: unknown[] = Object.values(patch);
    const clauses = buildWhere(body.filters, binds);
    if (!actor.isAdmin) {
      if (!actor.userId) throw new Error("Authentication required");
      if (rule.ownerColumn) {
        clauses.push(`${ident(rule.ownerColumn)} = ?`);
        binds.push(actor.userId);
      } else if (!rule.publicInsert) {
        throw new Error("Not authorised to update this table");
      }
    }
    if (!clauses.length) throw new Error("Updates require a filter");
    const sql = `UPDATE ${ident(table)} SET ${Object.keys(patch).map((c) => `${ident(c)} = ?`).join(", ")} WHERE ${clauses.join(" AND ")} RETURNING *`;
    const res = await db.prepare(sql).bind(...binds).all<Record<string, unknown>>();
    return (res.results || []).map((r) => hydrate(r));
  }

  // delete
  if (!rule.write.length && !rule.ownerColumn) throw new Error("Deletes are disabled for this table");
  const binds: unknown[] = [];
  const clauses = buildWhere(body.filters, binds);
  if (!actor.isAdmin) {
    if (!actor.userId || !rule.ownerColumn) throw new Error("Not authorised to delete from this table");
    clauses.push(`${ident(rule.ownerColumn)} = ?`);
    binds.push(actor.userId);
  }
  if (!clauses.length) throw new Error("Deletes require a filter");
  await db.prepare(`DELETE FROM ${ident(table)} WHERE ${clauses.join(" AND ")}`).bind(...binds).run();
  return [];
}
