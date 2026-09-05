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

const properties = new Hono<Env>();

// PUBLIC: property discovery
properties.get("/", async (c) => {
  const city = c.req.query("city");
  const suburb = c.req.query("suburb");
  const propertyType = c.req.query("property_type");
  const minRent = c.req.query("min_rent");
  const maxRent = c.req.query("max_rent");
  const bedrooms = c.req.query("bedrooms");
  const petsAllowed = c.req.query("pets_allowed");
  const furnished = c.req.query("furnished");
  const gated = c.req.query("gated");

  const limitParam = Number(c.req.query("limit") || "20");
  const limit = Math.min(
    Math.max(Number.isFinite(limitParam) ? limitParam : 20, 1),
    50
  );

  const conditions = ["l.status = 'active'"];
  const bindings: unknown[] = [];

  if (city) {
    conditions.push("LOWER(p.city) = LOWER(?)");
    bindings.push(city.trim());
  }

  if (suburb) {
    conditions.push("LOWER(p.suburb) = LOWER(?)");
    bindings.push(suburb.trim());
  }

  if (propertyType) {
    conditions.push("LOWER(p.property_type) = LOWER(?)");
    bindings.push(propertyType.trim());
  }

  if (minRent) {
    const value = Number(minRent);
    if (Number.isFinite(value)) {
      conditions.push("p.monthly_rent >= ?");
      bindings.push(value);
    }
  }

  if (maxRent) {
    const value = Number(maxRent);
    if (Number.isFinite(value)) {
      conditions.push("p.monthly_rent <= ?");
      bindings.push(value);
    }
  }

  if (bedrooms) {
    const value = Number(bedrooms);
    if (Number.isFinite(value)) {
      conditions.push("p.bedrooms >= ?");
      bindings.push(value);
    }
  }

  if (petsAllowed === "true") {
    conditions.push("p.pets_allowed = 1");
  }

  if (furnished === "true") {
    conditions.push("p.furnished = 1");
  }

  if (gated === "true") {
    conditions.push("p.gated = 1");
  }

  const sql = `
    SELECT
      p.*,
      l.id AS listing_id,
      l.status AS listing_status,
      l.available_from,
      l.availability_confirmed_at
    FROM properties p
    INNER JOIN listings l
      ON l.property_id = p.id
    WHERE ${conditions.join(" AND ")}
    ORDER BY p.created_date DESC
    LIMIT ?
  `;

  bindings.push(limit);

  const result = await c.env.DB
    .prepare(sql)
    .bind(...bindings)
    .all();

  return c.json({
    data: result.results,
    count: result.results.length,
  });
});

// PUBLIC: property detail
properties.get("/:id", async (c) => {
  const propertyId = c.req.param("id");

  const property = await c.env.DB
    .prepare(`
      SELECT
        p.*,
        l.id AS listing_id,
        l.status AS listing_status,
        l.available_from,
        l.availability_confirmed_at
      FROM properties p
      LEFT JOIN listings l
        ON l.property_id = p.id
      WHERE p.id = ?
      LIMIT 1
    `)
    .bind(propertyId)
    .first();

  if (!property) {
    return c.json({ message: "Property not found" }, 404);
  }

  return c.json({ data: property });
});

// PROTECTED: property creation
properties.post("/", requireAuth, async (c) => {
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
    return c.json(
      { message: "Monthly rent must be greater than zero" },
      400
    );
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
    .prepare("SELECT * FROM properties WHERE id = ?")
    .bind(propertyId)
    .first();

  return c.json(property, 201);
});

// PROTECTED: property update — owner only
properties.patch("/:id", requireAuth, async (c) => {
  const userId = c.get("userId");
  const propertyId = c.req.param("id");

  const existing = await c.env.DB
    .prepare(`
      SELECT id, created_by_id
      FROM properties
      WHERE id = ?
      LIMIT 1
    `)
    .bind(propertyId)
    .first<{
      id: string;
      created_by_id: string;
    }>();

  if (!existing) {
    return c.json({ message: "Property not found" }, 404);
  }

  if (existing.created_by_id !== userId) {
    return c.json({ message: "Forbidden" }, 403);
  }

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

  const fields: string[] = [];
  const values: unknown[] = [];

  const add = (field: string, value: unknown) => {
    fields.push(`${field} = ?`);
    values.push(value);
  };

  if (body.title !== undefined) {
    add("title", body.title.trim());
  }

  if (body.property_type !== undefined) {
    add("property_type", body.property_type.trim());
  }

  if (body.description !== undefined) {
    add("description", body.description.trim());
  }

  if (body.address !== undefined) {
    add("address", body.address.trim());
  }

  if (body.city !== undefined) {
    add("city", body.city.trim());
  }

  if (body.suburb !== undefined) {
    add("suburb", body.suburb.trim());
  }

  if (body.bedrooms !== undefined) {
    add("bedrooms", body.bedrooms);
  }

  if (body.bathrooms !== undefined) {
    add("bathrooms", body.bathrooms);
  }

  if (body.monthly_rent !== undefined) {
    if (body.monthly_rent <= 0) {
      return c.json(
        { message: "Monthly rent must be greater than zero" },
        400
      );
    }

    add("monthly_rent", body.monthly_rent);
  }

  if (body.deposit !== undefined) {
    add("deposit", body.deposit);
  }

  if (body.currency !== undefined) {
    add("currency", body.currency.trim());
  }

  if (body.furnished !== undefined) {
    add("furnished", body.furnished ? 1 : 0);
  }

  if (body.pets_allowed !== undefined) {
    add("pets_allowed", body.pets_allowed ? 1 : 0);
  }

  if (body.gated !== undefined) {
    add("gated", body.gated ? 1 : 0);
  }

  if (body.utilities_included !== undefined) {
    add("utilities_included", body.utilities_included.trim());
  }

  if (body.security_features !== undefined) {
    add("security_features", body.security_features.trim());
  }

  if (body.rules !== undefined) {
    add("rules", body.rules.trim());
  }

  if (body.latitude !== undefined) {
    add("latitude", body.latitude);
  }

  if (body.longitude !== undefined) {
    add("longitude", body.longitude);
  }

  if (body.location_precision !== undefined) {
    add("location_precision", body.location_precision.trim());
  }

  if (body.video_url !== undefined) {
    add("video_url", body.video_url.trim() || null);
    add("media_updated_at", new Date().toISOString());
  }

  if (fields.length === 0) {
    return c.json({ message: "No fields to update" }, 400);
  }

  add("updated_date", new Date().toISOString());

  values.push(propertyId);

  await c.env.DB
    .prepare(`
      UPDATE properties
      SET ${fields.join(", ")}
      WHERE id = ?
    `)
    .bind(...values)
    .run();

  const updated = await c.env.DB
    .prepare("SELECT * FROM properties WHERE id = ?")
    .bind(propertyId)
    .first();

  return c.json({ data: updated });
});

// PROTECTED: property deletion — owner only
properties.delete("/:id", requireAuth, async (c) => {
  const userId = c.get("userId");
  const propertyId = c.req.param("id");

  const existing = await c.env.DB
    .prepare(`
      SELECT id, created_by_id
      FROM properties
      WHERE id = ?
      LIMIT 1
    `)
    .bind(propertyId)
    .first<{
      id: string;
      created_by_id: string;
    }>();

  if (!existing) {
    return c.json({ message: "Property not found" }, 404);
  }

  if (existing.created_by_id !== userId) {
    return c.json({ message: "Forbidden" }, 403);
  }

  await c.env.DB
    .prepare("DELETE FROM properties WHERE id = ?")
    .bind(propertyId)
    .run();

  return c.json({
    success: true,
    id: propertyId,
  });
});

export default properties;