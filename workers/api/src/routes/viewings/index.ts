import { Hono } from "hono";
import { requireAuth } from "../../middleware/auth";

type Env = {
  Bindings: {
    DB: D1Database;
    APP_ENV: string;
  };
  Variables: {
    user: {
      id: string;
      email: string;
      role: string;
    };
  };
};

const viewings = new Hono<Env>();

viewings.use("*", requireAuth);

// CREATE VIEWING
viewings.post("/", async (c) => {
  try {
    const user = c.get("user");
    const body = await c.req.json();

    const propertyId = String(body.property_id || "").trim();
    const scheduledAt = String(body.scheduled_at || "").trim();
    const notes = body.notes ? String(body.notes).trim() : null;
    const listingId = body.listing_id
      ? String(body.listing_id).trim()
      : null;

    if (!propertyId || !scheduledAt) {
      return c.json(
        { message: "property_id and scheduled_at are required" },
        400
      );
    }

    const property = await c.env.DB.prepare(`
      SELECT id, created_by_id
      FROM properties
      WHERE id = ?
    `).bind(propertyId).first<{
      id: string;
      created_by_id: string;
    }>();

    if (!property) {
      return c.json({ message: "Property not found" }, 404);
    }

    if (property.created_by_id === user.id) {
      return c.json(
        {
          message:
            "Property owners cannot request a viewing of their own property",
        },
        403
      );
    }

    if (listingId) {
      const listing = await c.env.DB.prepare(`
        SELECT id, property_id
        FROM listings
        WHERE id = ?
      `).bind(listingId).first<{
        id: string;
        property_id: string;
      }>();

      if (!listing) {
        return c.json({ message: "Listing not found" }, 404);
      }

      if (listing.property_id !== propertyId) {
        return c.json(
          { message: "Listing does not belong to this property" },
          400
        );
      }
    }

    const existing = await c.env.DB.prepare(`
      SELECT id
      FROM viewings
      WHERE property_id = ?
        AND tenant_id = ?
        AND scheduled_at = ?
        AND status IN ('requested', 'confirmed')
      LIMIT 1
    `).bind(propertyId, user.id, scheduledAt).first();

    if (existing) {
      return c.json(
        { message: "A viewing already exists for this time" },
        409
      );
    }

    const id = crypto.randomUUID();
    const now = new Date().toISOString();

    const insertResult = await c.env.DB.prepare(`
      INSERT INTO viewings (
        id,
        tenant_id,
        property_id,
        listing_id,
        scheduled_at,
        status,
        notes,
        created_date,
        updated_date
      )
      VALUES (?, ?, ?, ?, ?, 'requested', ?, ?, ?)
    `).bind(
      id,
      user.id,
      propertyId,
      listingId,
      scheduledAt,
      notes,
      now,
      now
    ).run();

    if (!insertResult.success) {
      return c.json(
        {
          message: "Failed to create viewing",
          error: "D1 insert returned unsuccessful",
        },
        500
      );
    }

    const viewing = await c.env.DB.prepare(`
      SELECT
        v.*,
        p.created_by_id AS landlord_id,
        p.title AS property_title
      FROM viewings v
      JOIN properties p ON p.id = v.property_id
      WHERE v.id = ?
    `).bind(id).first();

    if (!viewing) {
      return c.json(
        {
          message: "Viewing was created but could not be retrieved",
          viewing_id: id,
        },
        500
      );
    }

    return c.json(viewing, 201);
  } catch (error) {
    console.error("CREATE VIEWING ERROR:", error);

    return c.json(
      {
        message: "Failed to create viewing",
        error: error instanceof Error ? error.message : String(error),
      },
      500
    );
  }
});

// LIST VIEWINGS
viewings.get("/", async (c) => {
  const user = c.get("user");

  const rows = await c.env.DB.prepare(`
    SELECT
      v.*,
      p.created_by_id AS landlord_id,
      p.title AS property_title
    FROM viewings v
    JOIN properties p ON p.id = v.property_id
    WHERE v.tenant_id = ?
       OR p.created_by_id = ?
    ORDER BY v.scheduled_at ASC
  `).bind(user.id, user.id).all();

  return c.json(rows.results);
});

// GET VIEWING
viewings.get("/:id", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  const viewing = await c.env.DB.prepare(`
    SELECT
      v.*,
      p.created_by_id AS landlord_id,
      p.title AS property_title
    FROM viewings v
    JOIN properties p ON p.id = v.property_id
    WHERE v.id = ?
      AND (
        v.tenant_id = ?
        OR p.created_by_id = ?
      )
  `).bind(id, user.id, user.id).first();

  if (!viewing) {
    return c.json({ message: "Viewing not found" }, 404);
  }

  return c.json(viewing);
});

// ACCEPT VIEWING
viewings.post("/:id/accept", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  const viewing = await c.env.DB.prepare(`
    SELECT
      v.id,
      v.status,
      p.created_by_id AS landlord_id
    FROM viewings v
    JOIN properties p ON p.id = v.property_id
    WHERE v.id = ?
      AND p.created_by_id = ?
  `).bind(id, user.id).first<{
    id: string;
    status: string;
    landlord_id: string;
  }>();

  if (!viewing) {
    return c.json({ message: "Viewing not found" }, 404);
  }

  if (viewing.status !== "requested") {
    return c.json(
      { message: "Only requested viewings can be accepted" },
      409
    );
  }

  const now = new Date().toISOString();

  await c.env.DB.prepare(`
    UPDATE viewings
    SET status = 'confirmed',
        updated_date = ?
    WHERE id = ?
  `).bind(now, id).run();

  return c.json(
    await c.env.DB.prepare(`
      SELECT
        v.*,
        p.created_by_id AS landlord_id,
        p.title AS property_title
      FROM viewings v
      JOIN properties p ON p.id = v.property_id
      WHERE v.id = ?
    `).bind(id).first()
  );
});

// DECLINE VIEWING
viewings.post("/:id/decline", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  const viewing = await c.env.DB.prepare(`
    SELECT
      v.id,
      v.status,
      p.created_by_id AS landlord_id
    FROM viewings v
    JOIN properties p ON p.id = v.property_id
    WHERE v.id = ?
      AND p.created_by_id = ?
  `).bind(id, user.id).first<{
    id: string;
    status: string;
  }>();

  if (!viewing) {
    return c.json({ message: "Viewing not found" }, 404);
  }

  if (viewing.status !== "requested") {
    return c.json(
      { message: "Only requested viewings can be declined" },
      409
    );
  }

  const now = new Date().toISOString();

  await c.env.DB.prepare(`
    UPDATE viewings
    SET status = 'declined',
        updated_date = ?
    WHERE id = ?
  `).bind(now, id).run();

  return c.json(
    await c.env.DB.prepare(`
      SELECT
        v.*,
        p.created_by_id AS landlord_id,
        p.title AS property_title
      FROM viewings v
      JOIN properties p ON p.id = v.property_id
      WHERE v.id = ?
    `).bind(id).first()
  );
});

// CANCEL VIEWING
viewings.post("/:id/cancel", async (c) => {
  const user = c.get("user");
  const id = c.req.param("id");

  const viewing = await c.env.DB.prepare(`
    SELECT
      v.id,
      v.status,
      v.tenant_id,
      p.created_by_id AS landlord_id
    FROM viewings v
    JOIN properties p ON p.id = v.property_id
    WHERE v.id = ?
      AND (
        v.tenant_id = ?
        OR p.created_by_id = ?
      )
  `).bind(id, user.id, user.id).first<{
    id: string;
    status: string;
  }>();

  if (!viewing) {
    return c.json({ message: "Viewing not found" }, 404);
  }

  if (!["requested", "confirmed"].includes(viewing.status)) {
    return c.json(
      { message: "This viewing cannot be cancelled" },
      409
    );
  }

  const now = new Date().toISOString();

  await c.env.DB.prepare(`
    UPDATE viewings
    SET status = 'cancelled',
        updated_date = ?
    WHERE id = ?
  `).bind(now, id).run();

  return c.json(
    await c.env.DB.prepare(`
      SELECT
        v.*,
        p.created_by_id AS landlord_id,
        p.title AS property_title
      FROM viewings v
      JOIN properties p ON p.id = v.property_id
      WHERE v.id = ?
    `).bind(id).first()
  );
});

export default viewings;
