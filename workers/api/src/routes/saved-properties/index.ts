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

const savedProperties = new Hono<Env>();

savedProperties.use("/*", requireAuth);

// GET /saved-properties — the current user's saved property ids
savedProperties.get("/", async (c) => {
  const userId = c.get("userId");

  const result = await c.env.DB.prepare(
    `SELECT * FROM saved_properties WHERE user_id = ? ORDER BY created_date DESC`
  )
    .bind(userId)
    .all();

  return c.json({ data: result.results, count: result.results.length });
});

// POST /saved-properties { property_id }
savedProperties.post("/", async (c) => {
  const userId = c.get("userId");
  const body = await c.req.json<{ property_id?: string }>();
  const propertyId = body.property_id?.trim();

  if (!propertyId) {
    return c.json({ message: "property_id is required" }, 400);
  }

  const existing = await c.env.DB.prepare(
    `SELECT * FROM saved_properties WHERE user_id = ? AND property_id = ?`
  )
    .bind(userId, propertyId)
    .first();

  if (existing) {
    return c.json({ data: existing }, 200);
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `INSERT INTO saved_properties (id, user_id, property_id, created_date)
     VALUES (?, ?, ?, ?)`
  )
    .bind(id, userId, propertyId, now)
    .run();

  const created = await c.env.DB.prepare(
    `SELECT * FROM saved_properties WHERE id = ?`
  )
    .bind(id)
    .first();

  return c.json({ data: created }, 201);
});

// DELETE /saved-properties/:propertyId
savedProperties.delete("/:propertyId", async (c) => {
  const userId = c.get("userId");
  const propertyId = c.req.param("propertyId");

  await c.env.DB.prepare(
    `DELETE FROM saved_properties WHERE user_id = ? AND property_id = ?`
  )
    .bind(userId, propertyId)
    .run();

  return c.json({ success: true });
});

export default savedProperties;
