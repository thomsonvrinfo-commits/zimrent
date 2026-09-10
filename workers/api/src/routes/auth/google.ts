import { Hono } from "hono";
import { createAccessToken } from "../../services/auth";
import {
  buildGoogleAuthUrl,
  createOAuthState,
  verifyOAuthState,
  exchangeCodeForIdToken,
  verifyGoogleIdToken,
  sanitizeReturnTo,
} from "../../services/googleOAuth";

type Env = {
  Bindings: {
    DB: D1Database;
    APP_ENV: string;
    JWT_SECRET?: string;
    GOOGLE_CLIENT_ID?: string;
    GOOGLE_CLIENT_SECRET?: string;
    GOOGLE_REDIRECT_URI?: string;
    FRONTEND_URL?: string;
  };
};

const STATE_COOKIE = "zr_oauth_state";

const google = new Hono<Env>();

function frontendRedirect(
  env: Env["Bindings"],
  path: string,
  extraParams?: Record<string, string>
) {
  const base = env.FRONTEND_URL || "https://zimrent.pages.dev";
  const url = new URL(path, base);
  if (extraParams) {
    for (const [key, value] of Object.entries(extraParams)) {
      url.searchParams.set(key, value);
    }
  }
  return url.toString();
}

function stateCookieAttrs(maxAgeSeconds: number) {
  // Path scoped to /auth/google so this cookie is never sent anywhere else.
  return `Path=/auth/google; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
}

// GET /auth/google — start the flow, redirect to Google.
google.get("/", async (c) => {
  if (!c.env.GOOGLE_CLIENT_ID || !c.env.GOOGLE_CLIENT_SECRET || !c.env.GOOGLE_REDIRECT_URI) {
    return c.json({ message: "Google sign-in is not configured" }, 503);
  }

  const returnTo = sanitizeReturnTo(c.req.query("returnTo"));
  const nonce = crypto.randomUUID();

  let state: string;
  try {
    state = await createOAuthState(nonce, returnTo, c.env);
  } catch {
    return c.json({ message: "Google sign-in is not configured" }, 503);
  }

  c.header("Set-Cookie", `${STATE_COOKIE}=${nonce}; ${stateCookieAttrs(600)}`);
  return c.redirect(buildGoogleAuthUrl(state, c.env), 302);
});

// GET /auth/google/callback — Google redirects the browser back here.
google.get("/callback", async (c) => {
  const error = c.req.query("error");
  const code = c.req.query("code");
  const state = c.req.query("state");

  const cookieHeader = c.req.header("Cookie") || "";
  const cookieNonce = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${STATE_COOKIE}=`))
    ?.slice(STATE_COOKIE.length + 1);

  // Single-use state cookie: clear it no matter how this request resolves.
  c.header("Set-Cookie", `${STATE_COOKIE}=; ${stateCookieAttrs(0)}`);

  if (error || !code || !state) {
    return c.redirect(
      frontendRedirect(c.env, "/login", { error: "google_oauth_failed" }),
      302
    );
  }

  if (!cookieNonce) {
    return c.redirect(
      frontendRedirect(c.env, "/login", { error: "google_oauth_expired" }),
      302
    );
  }

  let statePayload: { nonce: string; returnTo: string };
  try {
    statePayload = await verifyOAuthState(state, c.env);
  } catch {
    return c.redirect(
      frontendRedirect(c.env, "/login", { error: "google_oauth_invalid_state" }),
      302
    );
  }

  // Signature alone proves the token wasn't forged; this comparison proves
  // *this browser* is the one that started the flow (blocks login CSRF).
  if (statePayload.nonce !== cookieNonce) {
    return c.redirect(
      frontendRedirect(c.env, "/login", { error: "google_oauth_invalid_state" }),
      302
    );
  }

  const returnTo = sanitizeReturnTo(statePayload.returnTo);

  let profile;
  try {
    const idToken = await exchangeCodeForIdToken(code, c.env);
    profile = await verifyGoogleIdToken(idToken, c.env);
  } catch {
    return c.redirect(
      frontendRedirect(c.env, "/login", { error: "google_oauth_failed" }),
      302
    );
  }

  if (!profile.emailVerified) {
    return c.redirect(
      frontendRedirect(c.env, "/login", { error: "google_email_unverified" }),
      302
    );
  }

  const now = new Date().toISOString();

  type DbUser = {
    id: string;
    email: string;
    display_name: string | null;
    role: string;
    email_verified: number;
  };

  let user = await c.env.DB.prepare(
    `SELECT id, email, display_name, role, email_verified FROM users WHERE google_id = ?`
  )
    .bind(profile.sub)
    .first<DbUser>();

  if (!user) {
    const existingByEmail = await c.env.DB.prepare(
      `SELECT id, email, display_name, role, email_verified FROM users WHERE email = ?`
    )
      .bind(profile.email)
      .first<DbUser>();

    if (existingByEmail) {
      // Link an existing email/password account to this Google identity.
      // Google has just proven this email, so it's safe to mark it verified.
      await c.env.DB.prepare(
        `UPDATE users SET google_id = ?, email_verified = 1, updated_date = ? WHERE id = ?`
      )
        .bind(profile.sub, now, existingByEmail.id)
        .run();

      user = { ...existingByEmail, email_verified: 1 };
    } else {
      const userId = crypto.randomUUID();

      await c.env.DB.prepare(
        `INSERT INTO users (
          id, email, password_hash, display_name, role, email_verified,
          google_id, created_date, updated_date
        ) VALUES (?, ?, NULL, ?, 'tenant', 1, ?, ?, ?)`
      )
        .bind(userId, profile.email, profile.name, profile.sub, now, now)
        .run();

      await c.env.DB.prepare(
        `INSERT INTO profiles (
          id, created_by_id, display_name, avatar_url, created_date, updated_date
        ) VALUES (?, ?, ?, ?, ?, ?)`
      )
        .bind(crypto.randomUUID(), userId, profile.name, profile.picture, now, now)
        .run();

      user = {
        id: userId,
        email: profile.email,
        display_name: profile.name,
        role: "tenant",
        email_verified: 1,
      };
    }
  }

  const access_token = await createAccessToken(
    {
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      role: user.role,
      email_verified: true,
    },
    c.env
  );

  // Worker (workers.dev) and frontend (pages.dev) are different origins, so
  // a cookie set here can't carry the session to the frontend — the token
  // has to travel once via this redirect URL. The frontend (app-params.js)
  // reads it, stores it, and strips it from the address bar immediately.
  return c.redirect(frontendRedirect(c.env, returnTo, { access_token }), 302);
});

export default google;
