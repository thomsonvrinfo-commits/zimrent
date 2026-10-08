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

const mine = new Hono<Env>();

mine.use("/*", requireAuth);

// GET /properties/mine
//
// Every property the signed-in user owns or holds a property_authority
// record for — regardless of whether a listing exists yet. GET /properties
// (Discover) only returns properties with an ACTIVE listing, so an owner
// whose authority is pending/approved and who has not listed yet would
// otherwise have no way to see, or continue with, their own property.
//
// The caller's own authority status is aliased to my_authority_status
// because properties already has a legacy authority_status column.
mine.get("/", async (c) => {
  const userId = c.get("userId");

  const result = await c.env.DB
    .prepare(`
      SELECT
        p.*,
        pa.id AS my_authority_id,
        pa.status AS my_authority_status,
        l.id AS listing_id,
        l.status AS listing_status,
        l.available_from,
        l.availability_confirmed_at
      FROM properties p
      LEFT JOIN property_authority pa
        ON pa.property_id = p.id
       AND pa.user_id = ?
      LEFT JOIN listings l
        ON l.property_id = p.id
      WHERE p.created_by_id = ?
         OR pa.id IS NOT NULL
      ORDER BY p.created_date DESC
    `)
    .bind(userId, userId)
    .all();

  return c.json({
    data: result.results,
    count: result.results.length,
  });
});

export default mine;
