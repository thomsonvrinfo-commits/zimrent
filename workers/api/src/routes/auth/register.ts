import { Hono } from "hono";
import { hashPassword, createAccessToken } from "../../services/auth";

type Env = {
  Bindings: {
    DB: D1Database;
    APP_ENV: string;
    JWT_SECRET?: string;
  };
};

const register = new Hono<Env>();

register.post("/", async (c) => {
  const body = await c.req.json<{
    email?: string;
    password?: string;
    display_name?: string;
  }>();

  const email = body.email?.trim().toLowerCase();
  const password = body.password;

  if (!email || !password) {
    return c.json(
      { message: "Email and password are required" },
      400
    );
  }

  if (password.length < 8) {
    return c.json(
      { message: "Password must be at least 8 characters" },
      400
    );
  }

  const existing = await c.env.DB
    .prepare("SELECT id FROM users WHERE email = ?")
    .bind(email)
    .first();

  if (existing) {
    return c.json(
      { message: "An account with this email already exists" },
      409
    );
  }

  const userId = crypto.randomUUID();
  const now = new Date().toISOString();
  const passwordHash = await hashPassword(password);

  await c.env.DB
    .prepare(`
      INSERT INTO users (
        id,
        email,
        password_hash,
        display_name,
        role,
        email_verified,
        created_date,
        updated_date
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      userId,
      email,
      passwordHash,
      body.display_name?.trim() || null,
      "tenant",
      0,
      now,
      now
    )
    .run();

  await c.env.DB
    .prepare(`
      INSERT INTO profiles (
        id,
        created_by_id,
        display_name,
        created_date,
        updated_date
      )
      VALUES (?, ?, ?, ?, ?)
    `)
    .bind(
      crypto.randomUUID(),
      userId,
      body.display_name?.trim() || null,
      now,
      now
    )
    .run();

  const access_token = await createAccessToken(
    {
      id: userId,
      email,
      display_name: body.display_name?.trim() || null,
      role: "tenant",
      email_verified: false,
    },
    c.env
  );

  return c.json(
    {
      access_token,
      user: {
        id: userId,
        email,
        display_name: body.display_name?.trim() || null,
        role: "tenant",
        email_verified: false,
      },
    },
    201
  );
});

export default register;