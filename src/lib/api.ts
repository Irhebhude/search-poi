/**
 * SEARCH-POI Cloudflare API client.
 *
 * Talks only to this project's own endpoints (Cloudflare Pages Functions ->
 * Workers -> D1 / KV / R2). There is no third-party database SDK in the
 * browser bundle: every call below is a plain `fetch` to `/api/*`.
 */

const API_BASE = (import.meta.env.VITE_API_BASE_URL || "").replace(/\/$/, "");

export const apiUrl = (path: string) => `${API_BASE}${path}`;

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(apiUrl(path), {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    ...init,
  });
  const text = await res.text();
  let body: any = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { error: text };
  }
  if (!res.ok) throw new Error(body?.error || `Request failed (${res.status})`);
  return body as T;
}

/* -------------------------------------------------------------------------- */
/* Types                                                                       */
/* -------------------------------------------------------------------------- */

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  created_at: string;
}

export interface AuthSession {
  user: AuthUser;
  expires_at: string;
}

export interface Result<T> {
  data: T | null;
  error: { message: string } | null;
}

type Filter = { column: string; op: string; value: unknown };

/* -------------------------------------------------------------------------- */
/* Query builder -> POST /api/db/:table/:action (D1 prepared statements)       */
/* -------------------------------------------------------------------------- */

class Query<T = any> implements PromiseLike<Result<T>> {
  private filters: Filter[] = [];
  private columns = "*";
  private orderBy: { column: string; ascending: boolean } | null = null;
  private limitCount: number | null = null;
  private rowMode: "many" | "single" | "maybeSingle" = "many";
  private action: "select" | "insert" | "update" | "delete" = "select";
  private payload: unknown = null;
  private returnRows = false;

  constructor(private table: string) {}

  select(columns = "*") {
    this.columns = columns;
    if (this.action !== "select") this.returnRows = true;
    else this.action = "select";
    return this;
  }
  insert(values: unknown) {
    this.action = "insert";
    this.payload = values;
    return this;
  }
  update(values: unknown) {
    this.action = "update";
    this.payload = values;
    return this;
  }
  delete() {
    this.action = "delete";
    return this;
  }
  eq(column: string, value: unknown) {
    this.filters.push({ column, op: "eq", value });
    return this;
  }
  neq(column: string, value: unknown) {
    this.filters.push({ column, op: "neq", value });
    return this;
  }
  gt(column: string, value: unknown) {
    this.filters.push({ column, op: "gt", value });
    return this;
  }
  gte(column: string, value: unknown) {
    this.filters.push({ column, op: "gte", value });
    return this;
  }
  lt(column: string, value: unknown) {
    this.filters.push({ column, op: "lt", value });
    return this;
  }
  lte(column: string, value: unknown) {
    this.filters.push({ column, op: "lte", value });
    return this;
  }
  like(column: string, value: string) {
    this.filters.push({ column, op: "like", value });
    return this;
  }
  ilike(column: string, value: string) {
    this.filters.push({ column, op: "like", value });
    return this;
  }
  in(column: string, value: unknown[]) {
    this.filters.push({ column, op: "in", value });
    return this;
  }
  is(column: string, value: unknown) {
    this.filters.push({ column, op: "is", value });
    return this;
  }
  order(column: string, opts?: { ascending?: boolean }) {
    this.orderBy = { column, ascending: opts?.ascending !== false };
    return this;
  }
  limit(count: number) {
    this.limitCount = count;
    return this;
  }
  single() {
    this.rowMode = "single";
    return this;
  }
  maybeSingle() {
    this.rowMode = "maybeSingle";
    return this;
  }

  private async run(): Promise<Result<T>> {
    try {
      const data = await request<{ data: T }>(`/api/db/${this.table}/${this.action}`, {
        method: "POST",
        body: JSON.stringify({
          columns: this.columns,
          filters: this.filters,
          order: this.orderBy,
          limit: this.limitCount,
          rowMode: this.rowMode,
          values: this.payload,
          returning: this.action !== "select" ? this.returnRows : true,
        }),
      });
      return { data: data.data, error: null };
    } catch (e) {
      return { data: null, error: { message: e instanceof Error ? e.message : "Request failed" } };
    }
  }

  then<R1 = Result<T>, R2 = never>(
    onfulfilled?: ((value: Result<T>) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): PromiseLike<R1 | R2> {
    return this.run().then(onfulfilled, onrejected);
  }
}

/* -------------------------------------------------------------------------- */
/* Realtime replacement: lightweight polling channels                          */
/* -------------------------------------------------------------------------- */

class Channel {
  private handlers: Array<() => void> = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private intervalMs = 15000;

  on(_event: string, _filter: unknown, handler: () => void) {
    this.handlers.push(handler);
    return this;
  }
  subscribe() {
    if (this.timer) return this;
    this.timer = setInterval(() => this.handlers.forEach((h) => h()), this.intervalMs);
    return this;
  }
  unsubscribe() {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
  }
}

/* -------------------------------------------------------------------------- */
/* Auth (Google OAuth + email/password, sessions in secure HttpOnly cookies)   */
/* -------------------------------------------------------------------------- */

type AuthListener = (event: string, session: AuthSession | null) => void;
const listeners = new Set<AuthListener>();
let currentSession: AuthSession | null = null;

function emit(event: string, session: AuthSession | null) {
  currentSession = session;
  listeners.forEach((l) => l(event, session));
}

const auth = {
  async getSession(): Promise<{ data: { session: AuthSession | null } }> {
    try {
      const res = await request<{ session: AuthSession | null }>("/api/auth/get-session");
      currentSession = res.session;
      return { data: { session: res.session } };
    } catch {
      return { data: { session: null } };
    }
  },

  async getUser(): Promise<{ data: { user: AuthUser | null } }> {
    const { data } = await auth.getSession();
    return { data: { user: data.session?.user ?? null } };
  },

  onAuthStateChange(cb: AuthListener) {
    listeners.add(cb);
    // Deliver the current session as soon as it is known.
    auth.getSession().then(({ data }) => cb("INITIAL_SESSION", data.session));
    return {
      data: {
        subscription: {
          unsubscribe: () => listeners.delete(cb),
        },
      },
    };
  },

  async signUp(params: { email: string; password: string; options?: { data?: Record<string, unknown> } }) {
    try {
      const res = await request<{ session: AuthSession }>("/api/auth/sign-up/email", {
        method: "POST",
        body: JSON.stringify({
          email: params.email,
          password: params.password,
          name: (params.options?.data as any)?.display_name ?? null,
        }),
      });
      emit("SIGNED_IN", res.session);
      return { data: { user: res.session.user, session: res.session }, error: null };
    } catch (e) {
      return { data: { user: null, session: null }, error: { message: (e as Error).message } };
    }
  },

  async signInWithPassword(params: { email: string; password: string }) {
    try {
      const res = await request<{ session: AuthSession }>("/api/auth/sign-in/email", {
        method: "POST",
        body: JSON.stringify(params),
      });
      emit("SIGNED_IN", res.session);
      return { data: { user: res.session.user, session: res.session }, error: null };
    } catch (e) {
      return { data: { user: null, session: null }, error: { message: (e as Error).message } };
    }
  },

  /** Redirects the browser to Google's consent screen via our own Worker. */
  async signInWithGoogle(callbackPath = "/") {
    const url = apiUrl(`/api/auth/sign-in/social?provider=google&callbackURL=${encodeURIComponent(callbackPath)}`);
    window.location.href = url;
  },

  async signOut() {
    try {
      await request("/api/auth/sign-out", { method: "POST" });
    } finally {
      emit("SIGNED_OUT", null);
    }
    return { error: null };
  },

  async resetPasswordForEmail(email: string, opts?: { redirectTo?: string }) {
    try {
      await request("/api/auth/request-password-reset", {
        method: "POST",
        body: JSON.stringify({ email, redirectTo: opts?.redirectTo }),
      });
      return { data: {}, error: null };
    } catch (e) {
      return { data: null, error: { message: (e as Error).message } };
    }
  },

  async updateUser(values: { password?: string; data?: Record<string, unknown> }) {
    try {
      const params = new URLSearchParams(window.location.search);
      const token = params.get("token") || window.location.hash.replace(/^#/, "");
      const res = await request<{ session: AuthSession | null }>("/api/auth/update-user", {
        method: "POST",
        body: JSON.stringify({ ...values, token }),
      });
      if (res.session) emit("USER_UPDATED", res.session);
      return { data: { user: res.session?.user ?? null }, error: null };
    } catch (e) {
      return { data: { user: null }, error: { message: (e as Error).message } };
    }
  },

  get session() {
    return currentSession;
  },
};

/* -------------------------------------------------------------------------- */
/* Storage (Cloudflare R2)                                                     */
/* -------------------------------------------------------------------------- */

const storage = {
  from(bucket: string) {
    return {
      async upload(path: string, file: File | Blob) {
        try {
          const form = new FormData();
          form.append("file", file);
          form.append("path", path);
          const res = await fetch(apiUrl(`/api/storage/${bucket}/upload`), {
            method: "POST",
            credentials: "include",
            body: form,
          });
          if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || "Upload failed");
          return { data: await res.json(), error: null };
        } catch (e) {
          return { data: null, error: { message: (e as Error).message } };
        }
      },
      getPublicUrl(path: string) {
        return { data: { publicUrl: apiUrl(`/api/storage/${bucket}/object/${path}`) } };
      },
      async remove(paths: string[]) {
        try {
          await request(`/api/storage/${bucket}/remove`, {
            method: "POST",
            body: JSON.stringify({ paths }),
          });
          return { data: {}, error: null };
        } catch (e) {
          return { data: null, error: { message: (e as Error).message } };
        }
      },
    };
  },
};

/* -------------------------------------------------------------------------- */
/* Public client                                                               */
/* -------------------------------------------------------------------------- */

export const api = {
  from: <T = any>(table: string) => new Query<T>(table),

  async rpc<T = any>(name: string, args?: Record<string, unknown>): Promise<Result<T>> {
    try {
      const res = await request<{ data: T }>(`/api/rpc/${name}`, {
        method: "POST",
        body: JSON.stringify(args ?? {}),
      });
      return { data: res.data, error: null };
    } catch (e) {
      return { data: null, error: { message: (e as Error).message } };
    }
  },

  functions: {
    async invoke<T = any>(name: string, opts?: { body?: unknown }): Promise<Result<T>> {
      try {
        const res = await request<T>(`/api/fn/${name}`, {
          method: "POST",
          body: JSON.stringify(opts?.body ?? {}),
        });
        return { data: res, error: null };
      } catch (e) {
        return { data: null, error: { message: (e as Error).message } };
      }
    },
  },

  channel: (_name: string) => new Channel(),
  removeChannel: (channel: Channel) => channel.unsubscribe(),

  auth,
  storage,
};

/* Convenience REST helpers required by the public API surface. */
export const places = {
  list: (params?: Record<string, string>) =>
    request<{ data: any[] }>(`/api/places${params ? `?${new URLSearchParams(params)}` : ""}`),
  get: (id: string) => request<{ data: any }>(`/api/place/${id}`),
  create: (values: Record<string, unknown>) =>
    request<{ data: any }>("/api/places", { method: "POST", body: JSON.stringify(values) }),
  update: (id: string, values: Record<string, unknown>) =>
    request<{ data: any }>(`/api/places/${id}`, { method: "PUT", body: JSON.stringify(values) }),
  remove: (id: string) => request<{ data: any }>(`/api/places/${id}`, { method: "DELETE" }),
  search: (q: string) => request<{ data: any[] }>(`/api/search?q=${encodeURIComponent(q)}`),
};

export default api;
