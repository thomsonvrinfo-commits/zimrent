import { Hono } from "hono";
import { hashPassword } from "../../services/auth";

type Env = {
  Bindings: {
    DB: D1Database;
    APP_ENV: string;
    JWT_SECRET?: string;
  };
};

async function sha256Hex(value: string) {
  const data = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const resetPassword = new Hono<Env>();

resetPassword.post("/", async (c) => {
  const body = await c.req.json<{ token?: string; password?: string }>().catch(() => ({}));
  const token = body.token;
  const password = body.password;

  if (!token || !password) {
    return c.json({ message: "Token and new password are required" }, 400);
  }

  if (password.length < 8) {
    return c.json({ message: "Password must be at least 8 characters" }, 400);
  }

  const tokenHash = await sha256Hex(token);

  const record = await c.env.DB.prepare(
    `SELECT id, user_id, expires_at, used_at
     FROM password_reset_tokens WHERE token_hash = ?`
  )
    .bind(tokenHash)
    .first<{
      id: string;
      user_id: string;
      expires_at: string;
      used_at: string | null;
    }>();

  const now = new Date();

  if (
    !record ||
    record.used_at ||
    new Date(record.expires_at).getTime() < now.getTime()
  ) {
    return c.json({ message: "This reset link is invalid or has expired" }, 400);
  }

  const passwordHash = await hashPassword(password);
  const nowIso = now.toISOString();

  await c.env.DB.prepare(
    `UPDATE users SET password_hash = ?, updated_date = ? WHERE id = ?`
  )
    .bind(passwordHash, nowIso, record.user_id)
    .run();

  await c.env.DB.prepare(
    `UPDATE password_reset_tokens SET used_at = ? WHERE id = ?`
  )
    .bind(nowIso, record.id)
    .run();

  return c.json({ message: "Password updated. You can now log in." }, 200);
});

export default resetPassword;
