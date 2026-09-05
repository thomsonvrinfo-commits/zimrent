import { Hono } from "hono";
import { requireAuth } from "../../middleware/auth";

type Env = {
  Bindings: {
    DB: D1Database;
    APP_ENV: string;
    JWT_SECRET?: string;
  };
  Variables: {
    userId: string;
  };
};

const me = new Hono<Env>();

me.use("/*", requireAuth);

me.get("/", async (c) => {
  const userId = c.get("userId");

  const user = await c.env.DB
    .prepare(`
      SELECT
        id,
        email,
        display_name,
        role,
        email_verified
      FROM users
      WHERE id = ?
    `)
    .bind(userId)
    .first<{
      id: string;
      email: string;
      display_name: string | null;
      role: string;
      email_verified: number;
    }>();

  if (!user) {
    return c.json({ message: "User not found" }, 404);
  }

  return c.json({
    id: user.id,
    email: user.email,
    display_name: user.display_name,
    role: user.role,
    email_verified: Boolean(user.email_verified),
  });
});

export default me;