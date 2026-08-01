/**
 * Server-side RPCs (the D1 replacements for the old database functions).
 * Each one enforces its own authorisation; the client can never pass raw SQL.
 */

import type { Env } from "./auth";

export interface Actor {
  userId: string | null;
  isAdmin: boolean;
}

const now = () => new Date().toISOString();

async function verifyReferral(env: Env, userId: string) {
  const pending = await env.DB.prepare(
    `SELECT * FROM referrals WHERE referred_id = ? AND status = 'pending'`,
  ).bind(userId).first<Record<string, any>>();
  if (!pending) return;

  const referredIp = (await env.DB.prepare(`SELECT signup_ip FROM profiles WHERE id = ?`)
    .bind(userId).first<{ signup_ip: string | null }>())?.signup_ip;
  const referrerIp = (await env.DB.prepare(`SELECT signup_ip FROM profiles WHERE id = ?`)
    .bind(pending.referrer_id).first<{ signup_ip: string | null }>())?.signup_ip;

  // Anti-fraud: same signup IP on both sides is flagged, never rewarded.
  if (referredIp && referrerIp && referredIp === referrerIp) {
    await env.DB.prepare(
      `UPDATE referrals SET status = 'flagged', verified_at = ? WHERE referred_id = ? AND status = 'pending'`,
    ).bind(now(), userId).run();
    return;
  }

  await env.DB.prepare(
    `UPDATE referrals SET status = 'verified', verified_at = ? WHERE referred_id = ? AND status = 'pending'`,
  ).bind(now(), userId).run();

  const counted = await env.DB.prepare(
    `SELECT COUNT(*) AS c FROM referrals WHERE referrer_id = ? AND status IN ('verified','rewarded')`,
  ).bind(pending.referrer_id).first<{ c: number }>();

  const batch = Math.floor((counted?.c || 0) / 10);
  if (batch > 0) {
    await env.DB.prepare(
      `INSERT OR IGNORE INTO referral_rewards (id, user_id, reward_type, referral_batch, activated_at, expires_at)
       VALUES (?, ?, 'premium_month', ?, ?, ?)`,
    ).bind(
      crypto.randomUUID(), pending.referrer_id, batch, now(),
      new Date(Date.now() + 30 * 86400_000).toISOString(),
    ).run();

    await env.DB.prepare(
      `UPDATE referrals SET status = 'rewarded'
        WHERE referrer_id = ? AND status = 'verified'`,
    ).bind(pending.referrer_id).run();

    await env.DB.prepare(`UPDATE profiles SET is_premium = 1, premium_since = ? WHERE id = ?`)
      .bind(now(), pending.referrer_id).run();
  }
}

export async function runRpc(
  name: string,
  args: Record<string, any>,
  env: Env,
  actor: Actor,
): Promise<unknown> {
  const requireUser = () => {
    if (!actor.userId) throw new Error("Authentication required");
    return actor.userId;
  };
  const requireAdmin = () => {
    if (!actor.isAdmin) throw new Error("Forbidden: admin only");
  };

  switch (name) {
    case "process_referral": {
      const uid = requireUser();
      const code = String(args.referral_code_input || "").trim();
      if (!code) return false;
      const referrer = await env.DB.prepare(
        `SELECT id FROM profiles WHERE referral_code = ? AND id != ?`,
      ).bind(code, uid).first<{ id: string }>();
      if (!referrer) return false;

      await env.DB.prepare(`UPDATE profiles SET referred_by = ? WHERE id = ?`).bind(referrer.id, uid).run();
      await env.DB.prepare(
        `INSERT OR IGNORE INTO referrals (id, referrer_id, referred_id, status, created_at)
         VALUES (?, ?, ?, 'pending', ?)`,
      ).bind(crypto.randomUUID(), referrer.id, uid, now()).run();
      return true;
    }

    case "update_signup_ip": {
      const uid = requireUser();
      const ip = String(args.ip_address || "").slice(0, 64);
      if (!ip) return null;
      await env.DB.prepare(`UPDATE profiles SET signup_ip = ? WHERE id = ? AND signup_ip IS NULL`)
        .bind(ip, uid).run();
      return null;
    }

    case "increment_search_count": {
      const uid = requireUser();
      await env.DB.prepare(`UPDATE profiles SET search_count = search_count + 1, updated_at = ? WHERE id = ?`)
        .bind(now(), uid).run();
      const p = await env.DB.prepare(`SELECT search_count FROM profiles WHERE id = ?`)
        .bind(uid).first<{ search_count: number }>();
      if ((p?.search_count || 0) >= 1) await verifyReferral(env, uid);
      return null;
    }

    case "log_search_activity": {
      const query = String(args.search_query || "").slice(0, 300);
      const mode = String(args.search_mode || "default").slice(0, 40);
      if (!query) return null;
      await env.DB.prepare(
        `INSERT INTO search_activity (id, user_id, query, search_mode, created_at) VALUES (?, ?, ?, ?, ?)`,
      ).bind(crypto.randomUUID(), actor.userId, query, mode, now()).run();

      const existing = await env.DB.prepare(`SELECT id FROM trending_searches WHERE lower(query) = lower(?)`)
        .bind(query).first<{ id: string }>();
      if (existing) {
        await env.DB.prepare(
          `UPDATE trending_searches SET search_count = search_count + 1, last_searched_at = ? WHERE id = ?`,
        ).bind(now(), existing.id).run();
      } else {
        await env.DB.prepare(
          `INSERT INTO trending_searches (id, query, search_count, last_searched_at, created_at) VALUES (?, ?, 1, ?, ?)`,
        ).bind(crypto.randomUUID(), query, now(), now()).run();
      }

      // Keep the activity feed bounded.
      await env.DB.prepare(
        `DELETE FROM search_activity WHERE id NOT IN (SELECT id FROM search_activity ORDER BY created_at DESC LIMIT 500)`,
      ).run();
      return null;
    }

    case "increment_shared_view": {
      const id = String(args.search_id || "");
      if (!id) return null;
      await env.DB.prepare(`UPDATE shared_searches SET view_count = view_count + 1 WHERE id = ?`).bind(id).run();
      return null;
    }

    case "get_referral_details": {
      const uid = requireUser();
      const target = String(args.referrer_uid || uid);
      if (target !== uid && !actor.isAdmin) throw new Error("Forbidden");
      const me = await env.DB.prepare(`SELECT signup_ip FROM profiles WHERE id = ?`)
        .bind(target).first<{ signup_ip: string | null }>();
      const rows = await env.DB.prepare(
        `SELECT r.referred_id, p.display_name AS referred_display_name, p.signup_ip AS referred_ip,
                r.status, r.created_at
           FROM referrals r JOIN profiles p ON p.id = r.referred_id
          WHERE r.referrer_id = ? ORDER BY r.created_at DESC`,
      ).bind(target).all<Record<string, any>>();
      return (rows.results || []).map((r) => ({
        ...r,
        referrer_ip: me?.signup_ip ?? null,
        is_flagged: Boolean(r.referred_ip && me?.signup_ip && r.referred_ip === me.signup_ip),
      }));
    }

    case "award_poi_points": {
      const uid = requireUser();
      const target = String(args.target_user_id || uid);
      const reason = String(args.point_reason || "task").slice(0, 120);
      let amount = Math.trunc(Number(args.amount) || 0);

      if (!actor.isAdmin) {
        if (target !== uid) throw new Error("Forbidden");
        // Non-admins can only be credited once per reason, capped at the task reward.
        const cap = await env.DB.prepare(`SELECT MAX(points_reward) AS m FROM poi_tasks WHERE is_active = 1`)
          .first<{ m: number | null }>();
        amount = Math.max(0, Math.min(amount, cap?.m || 0));
        const already = await env.DB.prepare(
          `SELECT 1 FROM poi_points_log WHERE user_id = ? AND reason = ?`,
        ).bind(uid, reason).first();
        if (already) throw new Error("Points already awarded for this task");
      }
      if (amount <= 0) throw new Error("Invalid points amount");

      await env.DB.batch([
        env.DB.prepare(
          `INSERT INTO poi_points_log (id, user_id, points, reason, created_at) VALUES (?, ?, ?, ?, ?)`,
        ).bind(crypto.randomUUID(), target, amount, reason, now()),
        env.DB.prepare(`UPDATE profiles SET poi_points = poi_points + ? WHERE id = ?`).bind(amount, target),
      ]);
      return null;
    }

    case "get_public_deal_documents": {
      const rows = await env.DB.prepare(
        `SELECT id, title, description, category, file_name, file_size, created_at
           FROM deal_documents ORDER BY created_at DESC`,
      ).all<Record<string, any>>();
      return rows.results || [];
    }

    case "get_admin_users_list": {
      requireAdmin();
      const rows = await env.DB.prepare(
        `SELECT id AS user_id, display_name, email_verified, search_count, referral_code,
                signup_ip, created_at, updated_at
           FROM profiles ORDER BY created_at DESC`,
      ).all<Record<string, any>>();
      return rows.results || [];
    }

    case "get_admin_user_stats": {
      requireAdmin();
      const cutoff = new Date(Date.now() - 30 * 86400_000).toISOString();
      const row = await env.DB.prepare(
        `SELECT COUNT(*) AS total_users,
                SUM(CASE WHEN search_count > 0 OR updated_at > ? THEN 1 ELSE 0 END) AS active_users,
                SUM(CASE WHEN search_count = 0 AND updated_at <= ? THEN 1 ELSE 0 END) AS inactive_users
           FROM profiles`,
      ).bind(cutoff, cutoff).first<Record<string, any>>();
      return [row];
    }

    default:
      throw new Error(`Unknown function: ${name}`);
  }
}
