import { Hono } from "hono";
import { requireAuth } from "../../middleware/auth";
import {
  hasCapability,
  hasApprovedAuthority,
} from "../../services/capabilities";

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

const manage = new Hono<Env>();

manage.use("/*", requireAuth);

// GET /listings — the current user's own listings
manage.get("/", async (c) => {
  const userId = c.get("userId");

  const result = await c.env.DB
    .prepare(`
      SELECT *
      FROM listings
      WHERE created_by_id = ?
      ORDER BY created_date DESC
    `)
    .bind(userId)
    .all();

  return c.json({
    data: result.results,
    count: result.results.length,
  });
});

// PATCH /listings/:id
manage.patch("/:id", async (c) => {
  const userId = c.get("userId");
  const listingId = c.req.param("id");

  // Managing a listing requires the listing capability.
  const canList = await hasCapability(
    c.env.DB,
    userId,
    "listing"
  );

  if (!canList) {
    return c.json(
      { message: "Listing capability is required" },
      403
    );
  }

  const existing = await c.env.DB
    .prepare(`
      SELECT
        l.id,
        l.created_by_id,
        l.property_id
      FROM listings l
      WHERE l.id = ?
      LIMIT 1
    `)
    .bind(listingId)
    .first<{
      id: string;
      created_by_id: string;
      property_id: string;
    }>();

  if (!existing) {
    return c.json(
      { message: "Listing not found" },
      404
    );
  }

  // Property authority is the source of truth for managing
  // the listing's underlying property.
  const authorized = await hasApprovedAuthority(
    c.env.DB,
    userId,
    existing.property_id
  );

  if (!authorized) {
    return c.json(
      {
        message:
          "Approved property authority is required",
      },
      403
    );
  }

  const body = await c.req.json<{
    status?: string;
    available_from?: string;
  }>();

  const fields: string[] = [];
  const values: unknown[] = [];

  const allowedOwnerStatuses = [
    "draft",
    "pending_verification",
    "inactive",
  ] as const;

  if (body.status !== undefined) {
    if (!allowedOwnerStatuses.includes(body.status as typeof allowedOwnerStatuses[number])) {
      return c.json(
        {
          message:
            "You cannot set that listing status",
        },
        403
      );
    }

    fields.push("status = ?");
    values.push(body.status);

    // Only an authorized verification flow may establish
    // availability confirmation / active status.
    fields.push("availability_confirmed_at = ?");
    values.push(null);
  }

  if (body.available_from !== undefined) {
    fields.push("available_from = ?");
    values.push(
      body.available_from.trim() || null
    );
  }

  if (fields.length === 0) {
    return c.json(
      { message: "No fields to update" },
      400
    );
  }

  fields.push("updated_date = ?");
  values.push(new Date().toISOString());

  values.push(listingId);

  await c.env.DB
    .prepare(`
      UPDATE listings
      SET ${fields.join(", ")}
      WHERE id = ?
    `)
    .bind(...values)
    .run();

  const updated = await c.env.DB
    .prepare(`
      SELECT *
      FROM listings
      WHERE id = ?
    `)
    .bind(listingId)
    .first();

  return c.json({
    data: updated,
  });
});

export default manage;