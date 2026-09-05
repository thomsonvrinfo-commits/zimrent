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
    title?: string;
    property_type?: string;
    description?: string;
    address?: string;
    city?: string;
    suburb?: string;
    bedrooms?: number;
    bathrooms?: number;
    monthly_rent?: number;
    deposit?: number;
    currency?: string;
    furnished?: boolean;
    pets_allowed?: boolean;
    gated?: boolean;
    utilities_included?: string;
    security_features?: string;
    rules?: string;
    latitude?: number;
    longitude?: number;
    location_precision?: string;
    video_url?: string;
  }>();

  if (!body.title?.trim()) {
    return c.json({ message: "Property title is required" }, 400);
  }

  if (!body.city?.trim()) {
    return c.json({ message: "City is required" }, 400);
  }

  if (!body.monthly_rent || body.monthly_rent <= 0) {
    return c.json({ message: "Monthly rent must be greater than zero" }, 400);
  }

  const propertyId = crypto.randomUUID();
  const now = new Date().toISOString();

  await c.env.DB
    .prepare(`
      INSERT INTO properties (
        id,
        created_by_id,
        title,
        property_type,
        description,
        address,
        city,
        suburb,
        bedrooms,
        bathrooms,
        monthly_rent,
        deposit,
        currency,
        furnished,
        pets_allowed,
        gated,
        utilities_included,
        security_features,
        rules,
        latitude,
        longitude,
        location_precision,
        verification_status,
        authority_status,
        video_url,
        media_updated_at,
        created_date,
        updated_date
      )
      VALUES (
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
      )
    `)
    .bind(
      propertyId,
      userId,
      body.title.trim(),
      body.property_type?.trim() || null,
      body.description?.trim() || null,
      body.address?.trim() || null,
      body.city.trim(),
      body.suburb?.trim() || null,
      body.bedrooms ?? null,
      body.bathrooms ?? null,
      body.monthly_rent,
      body.deposit ?? null,
      body.currency?.trim() || "USD",
      body.furnished ? 1 : 0,
      body.pets_allowed ? 1 : 0,
      body.gated ? 1 : 0,
      body.utilities_included?.trim() || null,
      body.security_features?.trim() || null,
      body.rules?.trim() || null,
      body.latitude ?? null,
      body.longitude ?? null,
      body.location_precision?.trim() || null,
      "unverified",
      "unverified",
      body.video_url?.trim() || null,
      body.video_url ? now : null,
      now,
      now
    )
    .run();

  const property = await c.env.DB
    .prepare(`
      SELECT *
      FROM properties
      WHERE id = ?
    `)
    .bind(propertyId)
    .first();

  return c.json(property, 201);
});

export default create;