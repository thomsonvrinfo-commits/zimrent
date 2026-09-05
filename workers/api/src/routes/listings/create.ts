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

const create = new Hono<Env>();

create.use("/*", requireAuth);

create.post("/", async (c) => {
  const userId = c.get("userId");

  const body = await c.req.json<{
    property_id?: string;
    available_from?: string;
  }>();

  const propertyId = body.property_id?.trim();

  if (!propertyId) {
    return c.json({ message: "property_id is required" }, 400);
  }

  const property = await c.env.DB
    .prepare(`
      SELECT id, created_by_id
      FROM properties
      WHERE id = ?
    `)
    .bind(propertyId)
    .first<{
      id: string;
      created_by_id: string;
    }>();

  if (!property) {
    return c.json({ message: "Property not found" }, 404);
  }

  if (property.created_by_id !== userId) {
    return c.json(
      { message: "You do not own this property" },
      403
    );
  }

  const existing = await c.env.DB
    .prepare(`
      SELECT id, status
      FROM listings
      WHERE property_id = ?
      LIMIT 1
    `)
    .bind(propertyId)
    .first<{
      id: string;
      status: string;
    }>();

  if (existing) {
    return c.json(
      {
        message: "A listing already exists for this property",
        listing: existing,
      },
      409
    );
  }

  const listingId = crypto.randomUUID();
  const now = new Date().toISOString();

  await c.env.DB
    .prepare(`
      INSERT INTO listings (
        id,
        created_by_id,
        property_id,
        status,
        availability_confirmed_at,
        available_from,
        created_date,
        updated_date
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      listingId,
      userId,
      propertyId,
      "active",
      now,
      body.available_from?.trim() || null,
      now,
      now
    )
    .run();

  const listing = await c.env.DB
    .prepare(`
      SELECT *
      FROM listings
      WHERE id = ?
    `)
    .bind(listingId)
    .first();

  return c.json(listing, 201);
});

export default create;