import { Hono } from "hono";
import { createAccessToken, verifyPassword } from "../../services/auth";

type Env = {
  Bindings: {
    DB: D1Database;
    APP_ENV: string;
    JWT_SECRET?: string;
  };
};

const login = new Hono<Env>();

login.post("/", async (c) => {
  const body = await c.req.json<{
    email?: string;
    password?: string;
  }>();

  const email = body.email?.trim().toLowerCase();
  const password = body.password;

  if (!email || !password) {
    return c.json(
      { message: "Email and password are required" },
      400
    );
  }

  const user = await c.env.DB
    .prepare(`
      SELECT
        id,
        email,
        password_hash,
        display_name,
        role,
        email_verified
      FROM users
      WHERE email = ?
    `)
    .bind(email)
    .first<{
      id: string;
      email: string;
      password_hash: string | null;
      display_name: string | null;
      role: string;
      email_verified: number;
    }>();

  if (!user || !user.password_hash) {
    return c.json(
      { message: "Invalid email or password" },
      401
    );
  }

  const validPassword = await verifyPassword(
    password,
    user.password_hash
  );

  if (!validPassword) {
    return c.json(
      { message: "Invalid email or password" },
      401
    );
  }

  const access_token = await createAccessToken(
    {
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      role: user.role,
      email_verified: Boolean(user.email_verified),
    },
    c.env
  );

  return c.json({
    access_token,
    user: {
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      role: user.role,
      email_verified: Boolean(user.email_verified),
    },
  });
});

export default login;