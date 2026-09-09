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

const conversations = new Hono<Env>();

conversations.use("/*", requireAuth);

conversations.post("/", async (c) => {
  const userId = c.get("userId");

  let body: {
    property_id?: string;
    listing_id?: string;
  };

  try {
    body = await c.req.json();
  } catch {
    return c.json({ message: "Invalid JSON body" }, 400);
  }

  const propertyId = body.property_id?.trim();
  const listingId = body.listing_id?.trim();

  if (!propertyId) {
    return c.json({ message: "property_id is required" }, 400);
  }

  const property = await c.env.DB.prepare(
    `SELECT id, created_by_id, title
     FROM properties
     WHERE id = ?`
  )
    .bind(propertyId)
    .first<{
      id: string;
      created_by_id: string;
      title: string | null;
    }>();

  if (!property) {
    return c.json({ message: "Property not found" }, 404);
  }

  if (property.created_by_id === userId) {
    return c.json(
      { message: "Property owners cannot start a tenant conversation with themselves" },
      400
    );
  }

  if (listingId) {
    const listing = await c.env.DB.prepare(
      `SELECT id, property_id, status
       FROM listings
       WHERE id = ?`
    )
      .bind(listingId)
      .first<{
        id: string;
        property_id: string;
        status: string;
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

  const existing = await c.env.DB.prepare(
    `SELECT id
     FROM conversations
     WHERE property_id = ?
       AND tenant_id = ?
       AND landlord_id = ?
       AND status = 'active'
     LIMIT 1`
  )
    .bind(propertyId, userId, property.created_by_id)
    .first<{ id: string }>();

  if (existing) {
    return c.json({
      id: existing.id,
      existing: true,
    });
  }

  const conversationId = crypto.randomUUID();
  const now = new Date().toISOString();

  await c.env.DB.prepare(
    `INSERT INTO conversations (
      id,
      property_id,
      listing_id,
      tenant_id,
      landlord_id,
      status,
      created_date,
      updated_date
    )
    VALUES (?, ?, ?, ?, ?, 'active', ?, ?)`
  )
    .bind(
      conversationId,
      propertyId,
      listingId ?? null,
      userId,
      property.created_by_id,
      now,
      now
    )
    .run();

  return c.json(
    {
      id: conversationId,
      property_id: propertyId,
      listing_id: listingId ?? null,
      tenant_id: userId,
      landlord_id: property.created_by_id,
      status: "active",
      created_date: now,
      updated_date: now,
    },
    201
  );
});

conversations.get("/", async (c) => {
  const userId = c.get("userId");

  const result = await c.env.DB.prepare(
    `SELECT
       c.*,
       p.title AS property_title,
       p.city AS property_city,
       p.suburb AS property_suburb
     FROM conversations c
     LEFT JOIN properties p ON p.id = c.property_id
     WHERE c.tenant_id = ?
        OR c.landlord_id = ?
     ORDER BY COALESCE(c.last_message_at, c.updated_date) DESC`
  )
    .bind(userId, userId)
    .all();

  return c.json({
    data: result.results,
  });
});

conversations.get("/:id", async (c) => {
  const userId = c.get("userId");
  const conversationId = c.req.param("id");

  const conversation = await c.env.DB.prepare(
    `SELECT
       c.*,
       p.title AS property_title,
       p.city AS property_city,
       p.suburb AS property_suburb
     FROM conversations c
     LEFT JOIN properties p ON p.id = c.property_id
     WHERE c.id = ?
       AND (c.tenant_id = ? OR c.landlord_id = ?)`
  )
    .bind(conversationId, userId, userId)
    .first();

  if (!conversation) {
    return c.json({ message: "Conversation not found" }, 404);
  }

  const messages = await c.env.DB.prepare(
    `SELECT
       id,
       conversation_id,
       sender_id,
       body,
       message_type,
       metadata_json,
       read_at,
       created_date,
       updated_date
     FROM messages
     WHERE conversation_id = ?
     ORDER BY created_date ASC`
  )
    .bind(conversationId)
    .all();

  return c.json({
    conversation,
    messages: messages.results,
  });
});

export default conversations;