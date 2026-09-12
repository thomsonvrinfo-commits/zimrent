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

const identityVerification = new Hono<Env>();

identityVerification.use("/*", requireAuth);

// GET /identity-verification/me
identityVerification.get("/me", async (c) => {
  const userId = c.get("userId");

  const verification = await c.env.DB
    .prepare(`
      SELECT
        id,
        status,
        evidence_document_id,
        reviewed_at,
        created_date,
        updated_date
      FROM identity_verifications
      WHERE user_id = ?
    `)
    .bind(userId)
    .first();

  return c.json({
    data: verification || {
      status: "unverified",
    },
  });
});

// POST /identity-verification
identityVerification.post("/", async (c) => {
  const userId = c.get("userId");

  const body = await c.req.json<{
    evidence_document_id?: string;
  }>();

  const evidenceDocumentId = body.evidence_document_id?.trim();

  if (!evidenceDocumentId) {
    return c.json(
      { message: "Identity evidence document is required" },
      400
    );
  }

  // Evidence must:
  // 1. exist
  // 2. belong to this user
  // 3. be an identity document
  const document = await c.env.DB
    .prepare(`
      SELECT
        id,
        uploaded_by_id,
        document_type,
        status
      FROM identity_documents
      WHERE id = ?
      LIMIT 1
    `)
    .bind(evidenceDocumentId)
    .first<{
      id: string;
      uploaded_by_id: string;
      document_type: string;
      status: string;
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

  if (document.document_type !== "identity") {
    return c.json(
      {
        message:
          "The evidence document must be an identity document",
      },
      400
    );
  }

  const now = new Date().toISOString();

  const existing = await c.env.DB
    .prepare(`
      SELECT
        id,
        status
      FROM identity_verifications
      WHERE user_id = ?
      LIMIT 1
    `)
    .bind(userId)
    .first<{
      id: string;
      status: string;
    }>();

  if (existing?.status === "verified") {
    return c.json(
      { message: "Identity is already verified" },
      409
    );
  }

  if (existing) {
    await c.env.DB
      .prepare(`
        UPDATE identity_verifications
        SET
          evidence_document_id = ?,
          status = 'pending',
          reviewed_by = NULL,
          reviewed_at = NULL,
          updated_date = ?
        WHERE user_id = ?
      `)
      .bind(
        evidenceDocumentId,
        now,
        userId
      )
      .run();
  } else {
    await c.env.DB
      .prepare(`
        INSERT INTO identity_verifications (
          id,
          user_id,
          status,
          evidence_document_id,
          created_date,
          updated_date
        )
        VALUES (
          lower(hex(randomblob(16))),
          ?,
          'pending',
          ?,
          ?,
          ?
        )
      `)
      .bind(
        userId,
        evidenceDocumentId,
        now,
        now
      )
      .run();
  }

  const verification = await c.env.DB
    .prepare(`
      SELECT
        id,
        status,
        evidence_document_id,
        reviewed_at,
        created_date,
        updated_date
      FROM identity_verifications
      WHERE user_id = ?
    `)
    .bind(userId)
    .first();

  return c.json(
    {
      data: verification,
    },
    201
  );
});

export default identityVerification;