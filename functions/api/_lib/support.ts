/**
 * Live support: conversations, messages, agent assignment, typing presence,
 * file attachments (R2) and transcript email on close.
 *
 * Transport is HTTP long-poll friendly (`?since=<iso>`), so it works on
 * Cloudflare Pages Functions without a WebSocket Durable Object.
 */

import { aiText } from "./ai";
import type { Env } from "./auth";
import { clientMeta, forbidden, HttpError, json, notFound, nowIso, uid, unauthorized } from "./util";

type User = { id: string; email: string; name?: string | null } | null | undefined;

export const SUPPORT_TRANSCRIPT_RECIPIENT = "prosperozoya50@gmail.com";

function isAgent(env: Env, user: User) {
  if (!user) return false;
  const admins = (env.ADMIN_EMAILS || "").split(",").map((e) => e.trim().toLowerCase()).filter(Boolean);
  return admins.includes(user.email.toLowerCase());
}

/* ------------------------------ conversations ----------------------------- */

export async function startConversation(env: Env, request: Request, user: User, body: any) {
  const meta = clientMeta(request);
  const id = uid();
  const ts = nowIso();
  await env.DB.prepare(
    `INSERT INTO support_conversations (id, org_id, user_id, user_name, user_email, subject, status, device, browser, os, ip, started_at, last_message_at, created_at)
     VALUES (?,?,?,?,?,?,'open',?,?,?,?,?,?,?)`,
  ).bind(
    id, body?.org_id ?? null, user?.id ?? null,
    body?.name ?? user?.name ?? "Visitor", body?.email ?? user?.email ?? null,
    body?.subject ?? "Support request", meta.device, meta.browser, meta.os, meta.ip, ts, ts, ts,
  ).run();

  if (body?.message) {
    await postMessage(env, id, { role: "user", name: body?.name ?? user?.name ?? "Visitor", senderId: user?.id, body: String(body.message) });
    await autoReply(env, id, String(body.message));
  }
  return { id, status: "open" };
}

export async function postMessage(
  env: Env,
  conversationId: string,
  msg: { role: "user" | "agent" | "system" | "note"; name?: string | null; senderId?: string | null; body: string; attachment?: { url: string; name: string; type: string } | null },
) {
  const ts = nowIso();
  const id = uid();
  await env.DB.batch([
    env.DB.prepare(
      `INSERT INTO support_messages (id, conversation_id, sender_role, sender_id, sender_name, body, attachment_url, attachment_name, attachment_type, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?)`,
    ).bind(id, conversationId, msg.role, msg.senderId ?? null, msg.name ?? null, msg.body ?? "", msg.attachment?.url ?? null, msg.attachment?.name ?? null, msg.attachment?.type ?? null, ts),
    env.DB.prepare(`UPDATE support_conversations SET last_message_at = ?, status = CASE WHEN status = 'closed' THEN 'open' ELSE status END WHERE id = ?`).bind(ts, conversationId),
  ]);
  return { id, created_at: ts };
}

/** First-response AI assistant so visitors are never left waiting. */
async function autoReply(env: Env, conversationId: string, question: string) {
  const answer = await aiText({
    env: env as any,
    chain: "fast",
    system:
      "You are the SEARCH-POI support assistant. Answer in 2-4 sentences, lead with the solution, and say a human agent will follow up if the issue needs account access. Never invent pricing or policies.",
    user: question,
    fallback: "Thanks for reaching out — a support agent will reply here shortly.",
  });
  await postMessage(env, conversationId, { role: "agent", name: "POI Assistant (AI)", body: answer });
}

export async function listMessages(env: Env, conversationId: string, since?: string | null) {
  const { results } = await env.DB.prepare(
    `SELECT * FROM support_messages WHERE conversation_id = ? AND created_at > ? ORDER BY created_at`,
  ).bind(conversationId, since ?? "1970-01-01T00:00:00.000Z").all();
  return results ?? [];
}

export async function setPresence(env: Env, conversationId: string, actor: string, typing: boolean) {
  await env.DB.prepare(
    `INSERT INTO support_presence (id, conversation_id, actor, typing, online, updated_at) VALUES (?,?,?,?,1,?)
     ON CONFLICT(id) DO UPDATE SET typing = excluded.typing, online = 1, updated_at = excluded.updated_at`,
  ).bind(`${conversationId}:${actor}`, conversationId, actor, typing ? 1 : 0, nowIso()).run();
  return { ok: true };
}

export async function getPresence(env: Env, conversationId: string) {
  const { results } = await env.DB.prepare(
    `SELECT actor, typing, updated_at FROM support_presence WHERE conversation_id = ?`,
  ).bind(conversationId).all<{ actor: string; typing: number; updated_at: string }>();
  const fresh = (results ?? []).filter((r) => Date.now() - new Date(r.updated_at).getTime() < 15000);
  return fresh.map((r) => ({ actor: r.actor, typing: !!r.typing }));
}

/* -------------------------------- transcripts ----------------------------- */

export function renderTranscript(conv: any, messages: any[]) {
  const lines = messages.map((m) => `[${new Date(m.created_at).toISOString().replace("T", " ").slice(0, 19)}] ${m.sender_name || m.sender_role}: ${m.body}${m.attachment_url ? ` (attachment: ${m.attachment_name})` : ""}`);
  const header = [
    `SEARCH-POI support transcript`,
    `Conversation: ${conv.id}`,
    `Visitor: ${conv.user_name ?? "Visitor"} <${conv.user_email ?? "unknown"}>`,
    `Started: ${conv.started_at}`,
    `Closed: ${conv.closed_at ?? nowIso()}`,
    `Agent: ${conv.assigned_agent_name ?? "unassigned"}`,
    `Device: ${conv.device} / ${conv.browser} / ${conv.os}`,
    "",
  ].join("\n");
  const text = header + lines.join("\n");
  const html = `<pre style="font:14px/1.5 ui-monospace,monospace;white-space:pre-wrap">${text.replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]!))}</pre>`;
  return { text, html };
}

/** Queues an email; sends immediately when an SMTP/HTTP provider key exists. */
export async function queueEmail(env: Env & { RESEND_API_KEY?: string; MAIL_FROM?: string }, to: string, subject: string, text: string, html?: string) {
  const id = uid();
  await env.DB.prepare(
    `INSERT INTO email_queue (id, to_address, subject, body_text, body_html, status, next_attempt_at, created_at) VALUES (?,?,?,?,?,'pending',?,?)`,
  ).bind(id, to, subject, text, html ?? null, nowIso(), nowIso()).run();
  await flushEmail(env, id);
  return id;
}

export async function flushEmail(env: Env & { RESEND_API_KEY?: string; MAIL_FROM?: string }, emailId?: string) {
  const rows = emailId
    ? [await env.DB.prepare(`SELECT * FROM email_queue WHERE id = ?`).bind(emailId).first<any>()].filter(Boolean)
    : ((await env.DB.prepare(`SELECT * FROM email_queue WHERE status = 'pending' AND attempts < 5 LIMIT 20`).all<any>()).results ?? []);

  for (const row of rows) {
    if (!env.RESEND_API_KEY) {
      await env.DB.prepare(`UPDATE email_queue SET attempts = attempts + 1, last_error = 'No mail provider configured' WHERE id = ?`).bind(row.id).run();
      continue;
    }
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          from: env.MAIL_FROM || "SEARCH-POI <support@search-poi.com>",
          to: [row.to_address],
          subject: row.subject,
          text: row.body_text,
          html: row.body_html ?? undefined,
        }),
      });
      if (res.ok) {
        await env.DB.prepare(`UPDATE email_queue SET status = 'sent', sent_at = ? WHERE id = ?`).bind(nowIso(), row.id).run();
      } else {
        await env.DB.prepare(`UPDATE email_queue SET attempts = attempts + 1, last_error = ? WHERE id = ?`).bind(`${res.status}: ${await res.text()}`.slice(0, 400), row.id).run();
      }
    } catch (e) {
      await env.DB.prepare(`UPDATE email_queue SET attempts = attempts + 1, last_error = ? WHERE id = ?`).bind(String(e).slice(0, 400), row.id).run();
    }
  }
}

export async function closeConversation(env: Env, conversationId: string, agent: User) {
  const conv = await env.DB.prepare(`SELECT * FROM support_conversations WHERE id = ?`).bind(conversationId).first<any>();
  if (!conv) throw notFound("Conversation not found");
  const messages = await listMessages(env, conversationId);
  const ts = nowIso();
  const { text, html } = renderTranscript({ ...conv, closed_at: ts }, messages as any[]);
  const duration = Math.round((new Date(ts).getTime() - new Date(conv.started_at).getTime()) / 1000);

  await env.DB.batch([
    env.DB.prepare(`UPDATE support_conversations SET status = 'closed', closed_at = ? WHERE id = ?`).bind(ts, conversationId),
    env.DB.prepare(`INSERT INTO support_transcripts (id, conversation_id, transcript, html, duration_seconds, created_at) VALUES (?,?,?,?,?,?)`)
      .bind(uid(), conversationId, text, html, duration, ts),
  ]);

  await queueEmail(
    env as any,
    SUPPORT_TRANSCRIPT_RECIPIENT,
    `[SEARCH-POI] Support transcript — ${conv.user_email ?? conv.user_name ?? "visitor"}`,
    text,
    html,
  );
  if (conv.user_email) {
    await queueEmail(env as any, conv.user_email, "Your SEARCH-POI support conversation", text, html);
  }
  return { ok: true, duration_seconds: duration, transcript_emailed_to: SUPPORT_TRANSCRIPT_RECIPIENT };
}

/* --------------------------------- routing -------------------------------- */

export async function handleSupportRoute(
  segments: string[],
  request: Request,
  env: Env,
  body: any,
  session: { user?: User },
): Promise<Response> {
  const user = session.user;
  const url = new URL(request.url);
  const method = request.method;
  const [first, second, third] = segments;

  if (first === "conversations" && !second) {
    if (method === "POST") return json({ data: await startConversation(env, request, user, body) }, 201);
    if (method === "GET") {
      if (isAgent(env, user)) {
        const status = url.searchParams.get("status");
        const { results } = await env.DB.prepare(
          `SELECT c.*, (SELECT COUNT(*) FROM support_messages m WHERE m.conversation_id = c.id) AS message_count
             FROM support_conversations c
            WHERE (? IS NULL OR c.status = ?) ORDER BY c.last_message_at DESC LIMIT 100`,
        ).bind(status, status).all();
        return json({ data: results ?? [] });
      }
      if (!user) throw unauthorized();
      const { results } = await env.DB.prepare(
        `SELECT * FROM support_conversations WHERE user_id = ? ORDER BY last_message_at DESC LIMIT 20`,
      ).bind(user.id).all();
      return json({ data: results ?? [] });
    }
  }

  if (first === "conversations" && second) {
    const convId = second;

    if (!third && method === "GET") {
      const conv = await env.DB.prepare(`SELECT * FROM support_conversations WHERE id = ?`).bind(convId).first();
      if (!conv) throw notFound("Conversation not found");
      return json({ data: conv });
    }

    if (third === "messages") {
      if (method === "GET") {
        return json({
          data: await listMessages(env, convId, url.searchParams.get("since")),
          presence: await getPresence(env, convId),
          server_time: nowIso(),
        });
      }
      if (method === "POST") {
        const role = isAgent(env, user) && body?.as_agent !== false ? "agent" : "user";
        if (role === "agent" && !isAgent(env, user)) throw forbidden("Agent access required");
        const message = await postMessage(env, convId, {
          role,
          name: body?.name ?? user?.name ?? (role === "agent" ? "Support agent" : "Visitor"),
          senderId: user?.id,
          body: String(body?.body ?? "").slice(0, 4000),
          attachment: body?.attachment ?? null,
        });
        if (role === "user" && body?.auto_reply !== false) {
          const open = await env.DB.prepare(
            `SELECT assigned_agent_id FROM support_conversations WHERE id = ?`,
          ).bind(convId).first<{ assigned_agent_id: string | null }>();
          if (!open?.assigned_agent_id) await autoReply(env, convId, String(body?.body ?? ""));
        }
        return json({ data: message }, 201);
      }
    }

    if (third === "typing" && method === "POST") {
      return json({ data: await setPresence(env, convId, isAgent(env, user) ? "agent" : "user", !!body?.typing) });
    }

    if (third === "assign" && method === "POST") {
      if (!isAgent(env, user)) throw forbidden("Agent access required");
      await env.DB.prepare(`UPDATE support_conversations SET assigned_agent_id = ?, assigned_agent_name = ?, status = 'pending' WHERE id = ?`)
        .bind(user!.id, user!.name ?? user!.email, convId).run();
      await postMessage(env, convId, { role: "system", name: "System", body: `${user!.name ?? user!.email} joined the conversation.` });
      return json({ data: { ok: true } });
    }

    if (third === "close" && method === "POST") {
      if (!isAgent(env, user)) throw forbidden("Agent access required");
      return json({ data: await closeConversation(env, convId, user) });
    }

    if (third === "transcript" && method === "GET") {
      if (!isAgent(env, user)) throw forbidden("Agent access required");
      const row = await env.DB.prepare(`SELECT * FROM support_transcripts WHERE conversation_id = ? ORDER BY created_at DESC LIMIT 1`).bind(convId).first();
      if (!row) throw notFound("No transcript yet — close the conversation first");
      return json({ data: row });
    }
  }

  if (first === "upload" && method === "POST") {
    if (!env.BUCKET) throw new HttpError(503, "File storage is not configured");
    const form = await request.formData();
    const file = form.get("file") as File | null;
    if (!file) throw new HttpError(400, "No file supplied");
    if (file.size > 10 * 1024 * 1024) throw new HttpError(413, "Attachments are limited to 10 MB");
    const key = `support/${uid()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
    await env.BUCKET.put(key, await file.arrayBuffer(), { httpMetadata: { contentType: file.type } });
    return json({ data: { url: `/api/storage/support/object/${key}`, name: file.name, type: file.type } }, 201);
  }

  if (first === "queue-flush" && method === "POST") {
    if (!isAgent(env, user)) throw forbidden("Agent access required");
    await flushEmail(env as any);
    return json({ data: { ok: true } });
  }

  throw notFound();
}
