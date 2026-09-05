import { Hono } from "hono";

type Env = {
  Bindings: {
    DB: D1Database;
    APP_ENV: string;
  };
};

const list = new Hono<Env>();

list.get("/", async (c) => {
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

  const conditions: string[] = [
    "l.status = 'active'",
  ];

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

export default list;