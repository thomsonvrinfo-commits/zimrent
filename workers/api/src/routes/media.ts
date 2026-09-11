import { Hono } from "hono";
import { requireAuth } from "../middleware/auth";

type Env = {
  Bindings: {
    DB: D1Database;
    zimrent_media: R2Bucket;
    APP_ENV: string;
  };
  Variables: {
    userId: string;
  };
};

const media = new Hono<Env>();

// PUBLIC: serve property photos
media.get("/property/:propertyId/:mediaId", async (c) => {
  const propertyId = c.req.param("propertyId");
  const mediaId = c.req.param("mediaId");

  const record = await c.env.DB
    .prepare(`
      SELECT
        pm.id,
        pm.property_id,
        pm.storage_key,
        pm.mime_type,
        l.status AS listing_status
      FROM property_media pm
      INNER JOIN properties p
        ON p.id = pm.property_id
      LEFT JOIN listings l
        ON l.property_id = p.id
      WHERE pm.id = ?
        AND pm.property_id = ?
      LIMIT 1
    `)
    .bind(mediaId, propertyId)
    .first<{
      id: string;
      property_id: string;
      storage_key: string;
      mime_type: string | null;
      listing_status: string | null;
    }>();

  if (!record) {
    return c.json({ message: "Media not found" }, 404);
  }

  if (record.listing_status !== "active") {
    return c.json({ message: "Media not available" }, 404);
  }

  const object = await c.env.zimrent_media.get(record.storage_key);

  if (!object) {
    return c.json({ message: "Media object not found" }, 404);
  }

  const headers = new Headers();

  object.writeHttpMetadata(headers);

  if (record.mime_type) {
    headers.set("Content-Type", record.mime_type);
  }

  headers.set("Cache-Control", "public, max-age=3600");
  headers.set("ETag", object.httpEtag);

  return new Response(object.body, {
    headers,
  });
});

// PROTECTED: serve a property's photo to its owner
media.get(
  "/property/:propertyId/:mediaId/owner",
  requireAuth,
  async (c) => {
    const userId = c.get("userId");
    const propertyId = c.req.param("propertyId");
    const mediaId = c.req.param("mediaId");

    const record = await c.env.DB
      .prepare(`
        SELECT
          pm.id,
          pm.property_id,
          pm.storage_key,
          pm.mime_type
        FROM property_media pm
        INNER JOIN properties p
          ON p.id = pm.property_id
        WHERE pm.id = ?
          AND pm.property_id = ?
          AND p.created_by_id = ?
        LIMIT 1
      `)
      .bind(mediaId, propertyId, userId)
      .first<{
        id: string;
        property_id: string;
        storage_key: string;
        mime_type: string | null;
      }>();

    if (!record) {
      return c.json({ message: "Media not found" }, 404);
    }

    const object = await c.env.zimrent_media.get(record.storage_key);

    if (!object) {
      return c.json({ message: "Media object not found" }, 404);
    }

    const headers = new Headers();

    object.writeHttpMetadata(headers);

    if (record.mime_type) {
      headers.set("Content-Type", record.mime_type);
    }

    headers.set("Cache-Control", "private, max-age=3600");
    headers.set("ETag", object.httpEtag);

    return new Response(object.body, {
      headers,
    });
  }
);

export default media;