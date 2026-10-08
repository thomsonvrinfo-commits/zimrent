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

const propertyAuthority = new Hono<Env>();

propertyAuthority.use("/*", requireAuth);

// GET /property-authority
// Returns the current user's authority records.
propertyAuthority.get("/", async (c) => {
  const userId = c.get("userId");

  const result = await c.env.DB
    .prepare(`
      SELECT
        pa.id,
        pa.property_id,
        pa.status,
        pa.evidence_document_id,
        pa.reviewed_at,
        pa.created_date,
        pa.updated_date
      FROM property_authority pa
      WHERE pa.user_id = ?
      ORDER BY pa.created_date DESC
    `)
    .bind(userId)
    .all();

  return c.json({
    data: result.results,
  });
});

// GET /property-authority/:propertyId
// Returns the current user's authority for one property.
propertyAuthority.get("/:propertyId", async (c) => {
  const userId = c.get("userId");
  const propertyId = c.req.param("propertyId");

  const authority = await c.env.DB
    .prepare(`
      SELECT
        id,
        property_id,
        status,
        evidence_document_id,
        reviewed_at,
        created_date,
        updated_date
      FROM property_authority
      WHERE user_id = ? AND property_id = ?
      LIMIT 1
    `)
    .bind(userId, propertyId)
    .first();

  return c.json({
    data: authority || null,
  });
});

// POST /property-authority
// Requests authority to manage a property.
// Approval can only happen through the admin verification flow.
propertyAuthority.post("/", async (c) => {
  const userId = c.get("userId");

  const body = await c.req.json<{
    property_id?: string;
    evidence_document_id?: string;
  }>();

  const propertyId = body.property_id?.trim();
  const evidenceDocumentId = body.evidence_document_id?.trim();

  if (!propertyId) {
    return c.json(
      { message: "property_id is required" },
      400
    );
  }

  if (!evidenceDocumentId) {
    return c.json(
      { message: "Authority evidence document is required" },
      400
    );
  }

  // Authority is only available to accounts with listing capability.
  const capability = await c.env.DB
    .prepare(`
      SELECT 1
      FROM user_capabilities
      WHERE user_id = ? AND capability = 'listing'
      LIMIT 1
    `)
    .bind(userId)
    .first();

  if (!capability) {
    return c.json(
      { message: "Listing capability is required" },
      403
    );
  }

  const property = await c.env.DB
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

  if (!property) {
    return c.json(
      { message: "Property not found" },
      404
    );
  }

  if (property.created_by_id !== userId) {
    return c.json(
      { message: "Forbidden" },
      403
    );
  }

  // Evidence must belong to this user, belong to this property,
  // and specifically be an authority document.
  const document = await c.env.DB
    .prepare(`
      SELECT
        id,
        property_id,
        uploaded_by_id,
        document_type
      FROM property_documents
      WHERE id = ?
      LIMIT 1
    `)
    .bind(evidenceDocumentId)
    .first<{
      id: string;
      property_id: string | null;
      uploaded_by_id: string;
      document_type: string;
    }>();

  if (!document) {
    return c.json(
      { message: "Evidence document not found" },
      404
    );
  }

  if (document.uploaded_by_id !== userId) {
    return c.json(
      { message: "Forbidden" },
      403
    );
  }

  if (document.document_type !== "authority") {
    return c.json(
      { message: "Evidence document must be an authority document" },
      400
    );
  }

  if (document.property_id !== propertyId) {
    return c.json(
      { message: "Evidence document does not belong to this property" },
      400
    );
  }

  const existing = await c.env.DB
    .prepare(`
      SELECT id, status
      FROM property_authority
      WHERE user_id = ? AND property_id = ?
      LIMIT 1
    `)
    .bind(userId, propertyId)
    .first<{
      id: string;
      status: string;
    }>();

  if (existing?.status === "approved") {
    return c.json(
      { message: "Property authority is already approved" },
      409
    );
  }

  if (existing?.status === "revoked") {
    return c.json(
      { message: "Revoked property authority requires administrative review" },
      409
    );
  }

  const now = new Date().toISOString();

  if (existing) {
    await c.env.DB
      .prepare(`
        UPDATE property_authority
        SET evidence_document_id = ?,
            status = 'pending',
            reviewed_by = NULL,
            reviewed_at = NULL,
            updated_date = ?
        WHERE id = ?
      `)
      .bind(
        evidenceDocumentId,
        now,
        existing.id
      )
      .run();
  } else {
    await c.env.DB
      .prepare(`
        INSERT INTO property_authority (
          id,
          user_id,
          property_id,
          status,
          evidence_document_id,
          created_date,
          updated_date
        )
        VALUES (
          lower(hex(randomblob(16))),
          ?,
          ?,
          'pending',
          ?,
          ?,
          ?
        )
      `)
      .bind(
        userId,
        propertyId,
        evidenceDocumentId,
        now,
        now
      )
      .run();
  }

  const authority = await c.env.DB
    .prepare(`
      SELECT
        id,
        property_id,
        status,
        evidence_document_id,
        reviewed_at,
        created_date,
        updated_date
      FROM property_authority
      WHERE user_id = ? AND property_id = ?
      LIMIT 1
    `)
    .bind(userId, propertyId)
    .first();

  return c.json(
    {
      data: authority,
    },
    201
  );
});

export default propertyAuthority;