/**
 * Multi-tenancy: organizations, teams, workspaces, RBAC, invitations,
 * usage quotas, white-label branding and the audit-log reader.
 *
 * Tenant isolation rule: every query below is scoped by `org_id` and the
 * caller's membership is verified before any read or write.
 */

import type { Env } from "./auth";
import { audit, forbidden, HttpError, json, notFound, nowIso, period, slugify, uid, unauthorized } from "./util";

export type Role = "owner" | "admin" | "member" | "viewer";

export const PERMISSIONS = [
  "org:read", "org:update", "org:delete", "org:billing",
  "members:read", "members:invite", "members:update", "members:remove",
  "teams:manage", "workspaces:manage",
  "search:read", "search:write",
  "documents:read", "documents:write",
  "api_keys:manage", "webhooks:manage",
  "reports:read", "reports:manage",
  "audit:read", "support:respond",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const ROLE_PERMISSIONS: Record<Role, Permission[] | "*"> = {
  owner: "*",
  admin: [
    "org:read", "org:update", "members:read", "members:invite", "members:update", "members:remove",
    "teams:manage", "workspaces:manage", "search:read", "search:write", "documents:read",
    "documents:write", "api_keys:manage", "webhooks:manage", "reports:read", "reports:manage",
    "audit:read", "support:respond",
  ],
  member: ["org:read", "members:read", "search:read", "search:write", "documents:read", "documents:write", "reports:read"],
  viewer: ["org:read", "members:read", "search:read", "documents:read", "reports:read"],
};

export function roleHas(role: Role, permission: Permission) {
  const set = ROLE_PERMISSIONS[role];
  return set === "*" || set.includes(permission);
}

export interface Membership {
  orgId: string;
  userId: string;
  role: Role;
  permissions: Permission[] | "*";
}

const PLAN_QUOTAS: Record<string, Record<string, number>> = {
  free: { searches: 500, api_calls: 1000, documents: 50, support_chats: 20 },
  pro: { searches: 20000, api_calls: 50000, documents: 2000, support_chats: 500 },
  business: { searches: 200000, api_calls: 500000, documents: 25000, support_chats: 5000 },
  enterprise: { searches: 0, api_calls: 0, documents: 0, support_chats: 0 },
};

/* ------------------------------ membership ------------------------------- */

export async function getMembership(env: Env, orgId: string, userId: string): Promise<Membership | null> {
  const row = await env.DB.prepare(
    `SELECT m.role, m.status, r.permissions
       FROM org_members m
       LEFT JOIN org_roles r ON r.id = m.role_id
      WHERE m.org_id = ? AND m.user_id = ?`,
  ).bind(orgId, userId).first<{ role: Role; status: string; permissions: string | null }>();
  if (!row || row.status !== "active") return null;
  const custom = row.permissions ? (JSON.parse(row.permissions) as Permission[]) : null;
  return {
    orgId,
    userId,
    role: row.role,
    permissions: custom?.length ? custom : ROLE_PERMISSIONS[row.role] ?? [],
  };
}

export async function requirePermission(
  env: Env,
  orgId: string,
  userId: string | undefined,
  permission: Permission,
): Promise<Membership> {
  if (!userId) throw unauthorized();
  const m = await getMembership(env, orgId, userId);
  if (!m) throw forbidden("You are not a member of this organization");
  const ok = m.permissions === "*" || m.permissions.includes(permission);
  if (!ok) throw forbidden(`Missing permission: ${permission}`);
  return m;
}

/* --------------------------------- quotas -------------------------------- */

export async function getPlan(env: Env, orgId: string) {
  const row = await env.DB.prepare(`SELECT plan FROM organizations WHERE id = ?`).bind(orgId).first<{ plan: string }>();
  return row?.plan ?? "free";
}

export async function consumeQuota(env: Env, orgId: string, metric: string, amount = 1) {
  const plan = await getPlan(env, orgId);
  const quota = PLAN_QUOTAS[plan]?.[metric] ?? 0;
  const p = period();
  await env.DB.prepare(
    `INSERT INTO org_quotas (id, org_id, period, metric, used, quota, updated_at)
     VALUES (?,?,?,?,?,?,?)
     ON CONFLICT(org_id, period, metric) DO UPDATE SET used = used + excluded.used, quota = excluded.quota, updated_at = excluded.updated_at`,
  ).bind(uid(), orgId, p, metric, amount, quota, nowIso()).run();

  const row = await env.DB.prepare(
    `SELECT used FROM org_quotas WHERE org_id = ? AND period = ? AND metric = ?`,
  ).bind(orgId, p, metric).first<{ used: number }>();
  const used = row?.used ?? amount;
  if (quota > 0 && used > quota) {
    throw new HttpError(429, `Monthly ${metric} quota reached for the ${plan} plan (${quota}). Upgrade to continue.`);
  }
  return { used, quota, plan };
}

export async function usageSummary(env: Env, orgId: string) {
  const { results } = await env.DB.prepare(
    `SELECT metric, used, quota FROM org_quotas WHERE org_id = ? AND period = ?`,
  ).bind(orgId, period()).all();
  return { period: period(), plan: await getPlan(env, orgId), metrics: results ?? [] };
}

/* ------------------------------- org CRUD -------------------------------- */

export async function createOrganization(env: Env, userId: string, name: string, request?: Request) {
  const id = uid();
  let slug = slugify(name);
  const clash = await env.DB.prepare(`SELECT id FROM organizations WHERE slug = ?`).bind(slug).first();
  if (clash) slug = `${slug}-${id.slice(0, 6)}`;
  const ts = nowIso();
  await env.DB.prepare(
    `INSERT INTO organizations (id, name, slug, plan, owner_id, settings, created_at, updated_at)
     VALUES (?,?,?,'free',?, '{}', ?, ?)`,
  ).bind(id, name, slug, userId, ts, ts).run();
  await env.DB.prepare(
    `INSERT INTO org_members (id, org_id, user_id, role, status, created_at) VALUES (?,?,?,'owner','active',?)`,
  ).bind(uid(), id, userId, ts).run();
  await audit(env, { env: undefined as never, orgId: id, actorId: userId, action: "org.created", resourceType: "organization", resourceId: id, request } as never);
  return { id, name, slug, plan: "free" };
}

export async function listOrganizations(env: Env, userId: string) {
  const { results } = await env.DB.prepare(
    `SELECT o.*, m.role FROM organizations o
       JOIN org_members m ON m.org_id = o.id
      WHERE m.user_id = ? AND m.status = 'active'
      ORDER BY o.created_at DESC`,
  ).bind(userId).all();
  return results ?? [];
}

export async function updateOrganization(env: Env, orgId: string, userId: string, patch: Record<string, unknown>, request?: Request) {
  await requirePermission(env, orgId, userId, "org:update");
  const allowed = ["name", "logo_url", "primary_color", "brand_name", "custom_domain", "plan", "settings", "sso_provider", "sso_metadata"];
  const entries = Object.entries(patch).filter(([k]) => allowed.includes(k));
  if (!entries.length) throw new HttpError(400, "No updatable fields supplied");
  const sql = `UPDATE organizations SET ${entries.map(([k]) => `${k} = ?`).join(", ")}, updated_at = ? WHERE id = ?`;
  await env.DB.prepare(sql).bind(...entries.map(([, v]) => (typeof v === "object" ? JSON.stringify(v) : v)), nowIso(), orgId).run();
  await audit(env, { orgId, actorId: userId, action: "org.updated", resourceType: "organization", resourceId: orgId, metadata: { fields: entries.map(([k]) => k) }, request });
  return env.DB.prepare(`SELECT * FROM organizations WHERE id = ?`).bind(orgId).first();
}

/* -------------------------------- members -------------------------------- */

export async function listMembers(env: Env, orgId: string, userId: string) {
  await requirePermission(env, orgId, userId, "members:read");
  const { results } = await env.DB.prepare(
    `SELECT m.id, m.role, m.status, m.created_at, u.id AS user_id, u.email, u.name, u.image
       FROM org_members m JOIN users u ON u.id = m.user_id
      WHERE m.org_id = ? ORDER BY m.created_at`,
  ).bind(orgId).all();
  return results ?? [];
}

export async function inviteMember(env: Env, orgId: string, userId: string, email: string, role: Role, request?: Request) {
  await requirePermission(env, orgId, userId, "members:invite");
  const token = crypto.randomUUID().replace(/-/g, "");
  const expires = new Date(Date.now() + 7 * 864e5).toISOString();
  await env.DB.prepare(
    `INSERT INTO org_invites (id, org_id, email, role, token, invited_by, status, expires_at, created_at)
     VALUES (?,?,?,?,?,?,'pending',?,?)`,
  ).bind(uid(), orgId, email.toLowerCase(), role, token, userId, expires, nowIso()).run();
  await audit(env, { orgId, actorId: userId, action: "member.invited", resourceType: "invite", metadata: { email, role }, request });
  return { token, email, role, expires_at: expires };
}

export async function acceptInvite(env: Env, token: string, userId: string, userEmail: string) {
  const invite = await env.DB.prepare(
    `SELECT * FROM org_invites WHERE token = ? AND status = 'pending'`,
  ).bind(token).first<any>();
  if (!invite) throw notFound("Invitation not found or already used");
  if (new Date(invite.expires_at) < new Date()) throw new HttpError(410, "This invitation has expired");
  if (invite.email.toLowerCase() !== userEmail.toLowerCase()) throw forbidden("This invitation was issued to a different email address");
  await env.DB.prepare(
    `INSERT INTO org_members (id, org_id, user_id, role, status, created_at) VALUES (?,?,?,?,'active',?)
     ON CONFLICT(org_id, user_id) DO UPDATE SET role = excluded.role, status = 'active'`,
  ).bind(uid(), invite.org_id, userId, invite.role, nowIso()).run();
  await env.DB.prepare(`UPDATE org_invites SET status = 'accepted' WHERE id = ?`).bind(invite.id).run();
  await audit(env, { orgId: invite.org_id, actorId: userId, action: "member.joined", resourceType: "organization", resourceId: invite.org_id });
  return { org_id: invite.org_id, role: invite.role };
}

export async function updateMemberRole(env: Env, orgId: string, actorId: string, memberUserId: string, role: Role, request?: Request) {
  await requirePermission(env, orgId, actorId, "members:update");
  const org = await env.DB.prepare(`SELECT owner_id FROM organizations WHERE id = ?`).bind(orgId).first<{ owner_id: string }>();
  if (org?.owner_id === memberUserId) throw forbidden("The organization owner's role cannot be changed");
  await env.DB.prepare(`UPDATE org_members SET role = ? WHERE org_id = ? AND user_id = ?`).bind(role, orgId, memberUserId).run();
  await audit(env, { orgId, actorId, action: "member.role_changed", resourceType: "member", resourceId: memberUserId, metadata: { role }, request });
  return { ok: true };
}

export async function removeMember(env: Env, orgId: string, actorId: string, memberUserId: string, request?: Request) {
  await requirePermission(env, orgId, actorId, "members:remove");
  const org = await env.DB.prepare(`SELECT owner_id FROM organizations WHERE id = ?`).bind(orgId).first<{ owner_id: string }>();
  if (org?.owner_id === memberUserId) throw forbidden("The organization owner cannot be removed");
  await env.DB.prepare(`DELETE FROM org_members WHERE org_id = ? AND user_id = ?`).bind(orgId, memberUserId).run();
  await audit(env, { orgId, actorId, action: "member.removed", resourceType: "member", resourceId: memberUserId, request });
  return { ok: true };
}

/* --------------------------- teams + workspaces --------------------------- */

export async function listTeams(env: Env, orgId: string, userId: string) {
  await requirePermission(env, orgId, userId, "org:read");
  const { results } = await env.DB.prepare(
    `SELECT t.*, (SELECT COUNT(*) FROM team_members tm WHERE tm.team_id = t.id) AS member_count
       FROM teams t WHERE t.org_id = ? ORDER BY t.created_at`,
  ).bind(orgId).all();
  return results ?? [];
}

export async function createTeam(env: Env, orgId: string, userId: string, name: string, description?: string) {
  await requirePermission(env, orgId, userId, "teams:manage");
  const id = uid();
  await env.DB.prepare(`INSERT INTO teams (id, org_id, name, description, created_at) VALUES (?,?,?,?,?)`)
    .bind(id, orgId, name, description ?? null, nowIso()).run();
  await env.DB.prepare(`INSERT INTO team_members (id, team_id, user_id, role, created_at) VALUES (?,?,?,'lead',?)`)
    .bind(uid(), id, userId, nowIso()).run();
  await audit(env, { orgId, actorId: userId, action: "team.created", resourceType: "team", resourceId: id, metadata: { name } });
  return { id, name };
}

export async function listAuditLogs(env: Env, orgId: string, userId: string, limit = 100) {
  await requirePermission(env, orgId, userId, "audit:read");
  const { results } = await env.DB.prepare(
    `SELECT * FROM audit_logs WHERE org_id = ? ORDER BY created_at DESC LIMIT ?`,
  ).bind(orgId, Math.min(limit, 500)).all();
  return results ?? [];
}

/* ------------------------------- public API ------------------------------- */

export async function handleOrgRoute(
  segments: string[],
  request: Request,
  env: Env,
  body: any,
  session: { user?: { id: string; email: string } | null },
): Promise<Response> {
  const user = session.user;
  const method = request.method;
  const [first, second, third] = segments;

  // /api/orgs            GET list, POST create
  if (!first) {
    if (!user) throw unauthorized();
    if (method === "GET") return json({ data: await listOrganizations(env, user.id) });
    if (method === "POST") {
      if (!body?.name) throw new HttpError(400, "Organization name is required");
      return json({ data: await createOrganization(env, user.id, String(body.name).slice(0, 80), request) }, 201);
    }
  }

  // /api/orgs/accept-invite
  if (first === "accept-invite" && method === "POST") {
    if (!user) throw unauthorized();
    return json({ data: await acceptInvite(env, String(body?.token ?? ""), user.id, user.email) });
  }

  const orgId = first;
  if (!orgId) throw notFound();
  if (!user) throw unauthorized();

  if (!second) {
    if (method === "GET") {
      await requirePermission(env, orgId, user.id, "org:read");
      const org = await env.DB.prepare(`SELECT * FROM organizations WHERE id = ?`).bind(orgId).first();
      if (!org) throw notFound("Organization not found");
      return json({ data: org });
    }
    if (method === "PUT" || method === "PATCH") return json({ data: await updateOrganization(env, orgId, user.id, body ?? {}, request) });
  }

  if (second === "members") {
    if (method === "GET") return json({ data: await listMembers(env, orgId, user.id) });
    if (method === "PUT" && third) return json({ data: await updateMemberRole(env, orgId, user.id, third, body?.role ?? "member", request) });
    if (method === "DELETE" && third) return json({ data: await removeMember(env, orgId, user.id, third, request) });
  }

  if (second === "invites" && method === "POST") {
    if (!body?.email) throw new HttpError(400, "Email is required");
    return json({ data: await inviteMember(env, orgId, user.id, String(body.email), body.role ?? "member", request) }, 201);
  }

  if (second === "teams") {
    if (method === "GET") return json({ data: await listTeams(env, orgId, user.id) });
    if (method === "POST") return json({ data: await createTeam(env, orgId, user.id, String(body?.name ?? "Team"), body?.description) }, 201);
  }

  if (second === "audit" && method === "GET") return json({ data: await listAuditLogs(env, orgId, user.id, Number(body?.limit) || 100) });

  if (second === "usage" && method === "GET") {
    await requirePermission(env, orgId, user.id, "org:read");
    return json({ data: await usageSummary(env, orgId) });
  }

  throw notFound();
}
