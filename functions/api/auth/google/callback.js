export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get('code');

  // 1. Exchange code for tokens
  const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      code,
      grant_type: 'authorization_code',
      redirect_uri: 'https://search-poi.pages.dev/api/auth/google/callback'
    })
  });
  const tokens = await tokenRes.json();

  // 2. Get user info
  const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
    headers: { Authorization: `Bearer ${tokens.access_token}` }
  });
  const user = await userRes.json();

  // 3. Save to D1
  await env.DB.prepare(
    "INSERT OR IGNORE INTO users (id, email, name, picture) VALUES (?, ?, ?, ?)"
  ).bind(user.id, user.email, user.name, user.picture).run();

  // 4. Redirect to app
  return Response.redirect('https://search-poi.pages.dev/dashboard', 302);
}
