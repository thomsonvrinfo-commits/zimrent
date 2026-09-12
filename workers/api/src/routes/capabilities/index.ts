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

const capabilities = new Hono<Env>();

capabilities.use("/*", requireAuth);

const ALLOWED_CAPABILITIES = ["renting", "listing"] as const;

type Capability = (typeof ALLOWED_CAPABILITIES)[number];

// GET /capabilities/me
capabilities.get("/me", async (c) => {
  const userId = c.get("userId");

  const result = await c.env.DB.prepare(
    `SELECT capability, granted_at
     FROM user_capabilities
     WHERE user_id = ?
     ORDER BY capability`
  )
    .bind(userId)
    .all();

  return c.json({ data: result.results });
});

// POST /capabilities
capabilities.post("/", async (c) => {
  const userId = c.get("userId");

  const body = await c.req.json<{ capability?: string }>();
  const capability = body.capability as Capability | undefined;

  if (
    !capability ||
    !ALLOWED_CAPABILITIES.includes(capability as Capability)
  ) {
    return c.json({ message: "Invalid capability" }, 400);
  }

  const existing = await c.env.DB.prepare(
    `SELECT id
     FROM user_capabilities
     WHERE user_id = ? AND capability = ?`
  )
    .bind(userId, capability)
    .first();

  if (!existing) {
    await c.env.DB.prepare(
      `INSERT INTO user_capabilities
       (id, user_id, capability, granted_at)
       VALUES (lower(hex(randomblob(16))), ?, ?, ?)`
    )
      .bind(userId, capability, new Date().toISOString())
      .run();
  }

  const result = await c.env.DB.prepare(
    `SELECT capability, granted_at
     FROM user_capabilities
     WHERE user_id = ?
     ORDER BY capability`
  )
    .bind(userId)
    .all();

  return c.json({ data: result.results });
});

// DELETE /capabilities/:capability
capabilities.delete("/:capability", async (c) => {
  const userId = c.get("userId");
  const capability = c.req.param("capability");

  if (
    !ALLOWED_CAPABILITIES.includes(capability as Capability)
  ) {
    return c.json({ message: "Invalid capability" }, 400);
  }

  const countResult = await c.env.DB.prepare(
    `SELECT COUNT(*) AS count
     FROM user_capabilities
     WHERE user_id = ?`
  )
    .bind(userId)
    .first<{ count: number }>();

  const capabilityCount = Number(countResult?.count || 0);

  if (capabilityCount <= 1) {
    return c.json(
      { message: "You must keep at least one capability" },
      400
    );
  }

  await c.env.DB.prepare(
    `DELETE FROM user_capabilities
     WHERE user_id = ? AND capability = ?`
  )
    .bind(userId, capability)
    .run();

  return c.json({ data: [] });
});

export default capabilities;