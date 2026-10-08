import { Hono } from "hono";
import { sendEmail } from "../../services/email";

type Env = {
  Bindings: {
    DB: D1Database;
    APP_ENV: string;
    JWT_SECRET?: string;
    FRONTEND_URL?: string;
    BREVO_API_KEY?: string;
    BREVO_FROM_EMAIL?: string;
    BREVO_FROM_NAME?: string;
  };
};

const GENERIC_RESPONSE = {
  message: "If an account exists for that email, a reset link has been sent.",
};

async function sha256Hex(value: string) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function randomToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const forgotPassword = new Hono<Env>();

forgotPassword.post("/", async (c) => {
  const body = await c.req.json<{ email?: string }>().catch(() => ({}));
  const email = body.email?.trim().toLowerCase();

  // Same generic response whether or not the email matches an account —
  // this must stay true regardless of what happens below.
  if (!email) {
    return c.json(GENERIC_RESPONSE, 200);
  }

  const user = await c.env.DB.prepare(
    `SELECT id, email FROM users WHERE email = ?`
  )
    .bind(email)
    .first<{ id: string; email: string }>();

  if (!user) {
    console.log(`forgot-password: no account for ${email}, not sending`);
    return c.json(GENERIC_RESPONSE, 200);
  }

  const rawToken = randomToken();
  const tokenHash = await sha256Hex(rawToken);
  const now = new Date();
  const expiresAt = new Date(now.getTime() + 15 * 60 * 1000); // 15 minutes

  await c.env.DB.prepare(
    `INSERT INTO password_reset_tokens (
      id, user_id, token_hash, expires_at, created_date
    ) VALUES (?, ?, ?, ?, ?)`
  )
    .bind(
      crypto.randomUUID(),
      user.id,
      tokenHash,
      expiresAt.toISOString(),
      now.toISOString()
    )
    .run();

  const frontendUrl = c.env.FRONTEND_URL || "https://zimrent.pages.dev";
  const resetUrl = `${frontendUrl}/reset-password?token=${rawToken}`;

  try {
    await sendEmail(
      user.email,
      "Reset your ZimRent password",
      `<p>Someone requested a password reset for this account.</p>
       <p><a href="${resetUrl}">Click here to reset your password</a>. This link expires in 1 hour.</p>
       <p>If you didn't request this, you can ignore this email.</p>`,
      c.env
    );
  } catch (err) {
    // Intentionally does not change the response — anti-enumeration — but
    // this MUST be visible in `wrangler tail`, unlike before this fix.
    console.error(`forgot-password: sendEmail failed for ${user.email}:`, err);
  }

  return c.json(GENERIC_RESPONSE, 200);
});

export default forgotPassword;
