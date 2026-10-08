import { Hono } from "hono";
import {
  requireAuth,
  requireAdmin,
} from "../../middleware/auth";
import { hasApprovedAuthority } from "../../services/capabilities";

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

const adminVerification = new Hono<Env>();

adminVerification.use("/*", requireAuth);
adminVerification.use("/*", requireAdmin);

const IDENTITY_STATUSES = [
  "pending",
  "verified",
  "rejected",
] as const;

const PROPERTY_STATUSES = [
  "pending",
  "verified",
  "rejected",
] as const;

const AUTHORITY_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "revoked",
] as const;

// Admin-settable listing outcomes. Owners can never set these themselves
// (see listings/manage.ts): only this review flow can make a listing
// active, which is what Discover (GET /properties) filters on.
const LISTING_REVIEW_STATUSES = [
  "active",
  "rejected",
  "inactive",
] as const;

type IdentityStatus = (typeof IDENTITY_STATUSES)[number];
type PropertyStatus = (typeof PROPERTY_STATUSES)[number];
type AuthorityStatus = (typeof AUTHORITY_STATUSES)[number];

function isAllowedStatus(
  value: string,
  allowed: readonly string[]
): boolean {
  return allowed.includes(value);
}

async function writeAuditLog(
  db: D1Database,
  actorId: string,
  action: string,
  entityType: string,
  entityId: string,
  metadata: Record<string, unknown>
) {
  await db
    .prepare(`
      INSERT INTO audit_logs (
        id,
        actor_id,
        action,
        entity_type,
        entity_id,
        metadata_json,
        created_date
      )
      VALUES (
        lower(hex(randomblob(16))),
        ?,
        ?,
        ?,
        ?,
        ?,
        ?
      )
    `)
    .bind(
      actorId,
      action,
      entityType,
      entityId,
      JSON.stringify(metadata),
      new Date().toISOString()
    )
    .run();
}

// GET /admin/verification/identity
adminVerification.get("/verification/identity", async (c) => {
  const result = await c.env.DB
    .prepare(`
      SELECT
        iv.id,
        iv.user_id,
        iv.status,
        iv.evidence_document_id,
        iv.reviewed_by,
        iv.reviewed_at,
        iv.created_date,
        iv.updated_date,
        u.email,
        u.display_name
      FROM identity_verifications iv
      JOIN users u ON u.id = iv.user_id
      ORDER BY
        CASE
          WHEN iv.status = 'pending' THEN 0
          ELSE 1
        END,
        iv.created_date DESC
    `)
    .all();

  return c.json({
    data: result.results,
  });
});

// GET /admin/verification/properties
adminVerification.get("/verification/properties", async (c) => {
  const result = await c.env.DB
    .prepare(`
      SELECT
        pv.id,
        pv.property_id,
        pv.status,
        pv.reviewed_by,
        pv.reviewed_at,
        pv.notes,
        pv.created_date,
        pv.updated_date,
        p.title,
        p.address,
        p.city,
        p.suburb,
        p.created_by_id
      FROM property_verifications pv
      JOIN properties p ON p.id = pv.property_id
      ORDER BY
        CASE
          WHEN pv.status = 'pending' THEN 0
          ELSE 1
        END,
        pv.created_date DESC
    `)
    .all();

  return c.json({
    data: result.results,
  });
});

// GET /admin/verification/authority
adminVerification.get("/verification/authority", async (c) => {
  const result = await c.env.DB
    .prepare(`
      SELECT
        pa.id,
        pa.user_id,
        pa.property_id,
        pa.status,
        pa.evidence_document_id,
        pa.reviewed_by,
        pa.reviewed_at,
        pa.created_date,
        pa.updated_date,
        u.email,
        u.display_name,
        p.title,
        p.address,
        p.city,
        p.suburb
      FROM property_authority pa
      JOIN users u ON u.id = pa.user_id
      JOIN properties p ON p.id = pa.property_id
      ORDER BY
        CASE
          WHEN pa.status = 'pending' THEN 0
          ELSE 1
        END,
        pa.created_date DESC
    `)
    .all();

  return c.json({
    data: result.results,
  });
});

// PATCH /admin/verification/identity/:id
adminVerification.patch(
  "/verification/identity/:id",
  async (c) => {
    const adminId = c.get("userId");
    const id = c.req.param("id");

    const body = await c.req.json<{
      status?: string;
    }>();

    const status = body.status;

    if (
      !status ||
      !isAllowedStatus(status, IDENTITY_STATUSES)
    ) {
      return c.json(
        { message: "Invalid identity verification status" },
        400
      );
    }

    const existing = await c.env.DB
      .prepare(`
        SELECT id, user_id, status
        FROM identity_verifications
        WHERE id = ?
        LIMIT 1
      `)
      .bind(id)
      .first<{
        id: string;
        user_id: string;
        status: string;
      }>();

    if (!existing) {
      return c.json(
        { message: "Identity verification not found" },
        404
      );
    }

    const now = new Date().toISOString();

    await c.env.DB
      .prepare(`
        UPDATE identity_verifications
        SET status = ?,
            reviewed_by = ?,
            reviewed_at = ?,
            updated_date = ?
        WHERE id = ?
      `)
      .bind(
        status as IdentityStatus,
        adminId,
        now,
        now,
        id
      )
      .run();

    await writeAuditLog(
      c.env.DB,
      adminId,
      "identity_verification_reviewed",
      "identity_verification",
      id,
      {
        user_id: existing.user_id,
        previous_status: existing.status,
        new_status: status,
      }
    );

    const updated = await c.env.DB
      .prepare(`
        SELECT
          id,
          user_id,
          status,
          evidence_document_id,
          reviewed_by,
          reviewed_at,
          created_date,
          updated_date
        FROM identity_verifications
        WHERE id = ?
      `)
      .bind(id)
      .first();

    return c.json({
      data: updated,
    });
  }
);

// PATCH /admin/verification/properties/:id
adminVerification.patch(
  "/verification/properties/:id",
  async (c) => {
    const adminId = c.get("userId");
    const id = c.req.param("id");

    const body = await c.req.json<{
      status?: string;
      notes?: string;
    }>();

    const status = body.status;

    if (
      !status ||
      !isAllowedStatus(status, PROPERTY_STATUSES)
    ) {
      return c.json(
        { message: "Invalid property verification status" },
        400
      );
    }

    const existing = await c.env.DB
      .prepare(`
        SELECT id, property_id, status
        FROM property_verifications
        WHERE id = ?
        LIMIT 1
      `)
      .bind(id)
      .first<{
        id: string;
        property_id: string;
        status: string;
      }>();

    if (!existing) {
      return c.json(
        { message: "Property verification not found" },
        404
      );
    }

    const now = new Date().toISOString();

    await c.env.DB
      .prepare(`
        UPDATE property_verifications
        SET status = ?,
            reviewed_by = ?,
            reviewed_at = ?,
            notes = ?,
            updated_date = ?
        WHERE id = ?
      `)
      .bind(
        status as PropertyStatus,
        adminId,
        now,
        body.notes?.trim() || null,
        now,
        id
      )
      .run();

    // Keep the legacy property verification field synchronized
    // while the platform transitions to property_verifications
    // as the authoritative source.
    await c.env.DB
      .prepare(`
        UPDATE properties
        SET verification_status = ?,
            updated_date = ?
        WHERE id = ?
      `)
      .bind(
        status,
        now,
        existing.property_id
      )
      .run();

    await writeAuditLog(
      c.env.DB,
      adminId,
      "property_verification_reviewed",
      "property_verification",
      id,
      {
        property_id: existing.property_id,
        previous_status: existing.status,
        new_status: status,
        notes: body.notes?.trim() || null,
      }
    );

    const updated = await c.env.DB
      .prepare(`
        SELECT
          id,
          property_id,
          status,
          reviewed_by,
          reviewed_at,
          notes,
          created_date,
          updated_date
        FROM property_verifications
        WHERE id = ?
      `)
      .bind(id)
      .first();

    return c.json({
      data: updated,
    });
  }
);

// PATCH /admin/verification/authority/:id
adminVerification.patch(
  "/verification/authority/:id",
  async (c) => {
    const adminId = c.get("userId");
    const id = c.req.param("id");

    const body = await c.req.json<{
      status?: string;
    }>();

    const status = body.status;

    if (
      !status ||
      !isAllowedStatus(status, AUTHORITY_STATUSES)
    ) {
      return c.json(
        { message: "Invalid property authority status" },
        400
      );
    }

    const existing = await c.env.DB
      .prepare(`
        SELECT
          id,
          user_id,
          property_id,
          status
        FROM property_authority
        WHERE id = ?
        LIMIT 1
      `)
      .bind(id)
      .first<{
        id: string;
        user_id: string;
        property_id: string;
        status: string;
      }>();

    if (!existing) {
      return c.json(
        { message: "Property authority record not found" },
        404
      );
    }

    // Prevent an administrator from approving their own authority.
    if (existing.user_id === adminId) {
      return c.json(
        { message: "You cannot review your own property authority" },
        403
      );
    }

    const now = new Date().toISOString();

    await c.env.DB
      .prepare(`
        UPDATE property_authority
        SET status = ?,
            reviewed_by = ?,
            reviewed_at = ?,
            updated_date = ?
        WHERE id = ?
      `)
      .bind(
        status as AuthorityStatus,
        adminId,
        now,
        now,
        id
      )
      .run();

    // Keep the legacy property authority field synchronized
    // while the new property_authority table is the source of truth.
    await c.env.DB
      .prepare(`
        UPDATE properties
        SET authority_status = ?,
            updated_date = ?
        WHERE id = ?
      `)
      .bind(
        status,
        now,
        existing.property_id
      )
      .run();

    await writeAuditLog(
      c.env.DB,
      adminId,
      "property_authority_reviewed",
      "property_authority",
      id,
      {
        user_id: existing.user_id,
        property_id: existing.property_id,
        previous_status: existing.status,
        new_status: status,
      }
    );

    const updated = await c.env.DB
      .prepare(`
        SELECT
          id,
          user_id,
          property_id,
          status,
          evidence_document_id,
          reviewed_by,
          reviewed_at,
          created_date,
          updated_date
        FROM property_authority
        WHERE id = ?
      `)
      .bind(id)
      .first();

    return c.json({
      data: updated,
    });
  }
);

// GET /admin/verification/listings
adminVerification.get("/verification/listings", async (c) => {
  const result = await c.env.DB
    .prepare(`
      SELECT
        l.id,
        l.property_id,
        l.created_by_id,
        l.status,
        l.availability_confirmed_at,
        l.available_from,
        l.created_date,
        l.updated_date,
        u.email,
        u.display_name,
        p.title,
        p.address,
        p.city,
        p.suburb,
        p.monthly_rent,
        (
          SELECT pa.status
          FROM property_authority pa
          WHERE pa.property_id = l.property_id
            AND pa.user_id = l.created_by_id
          LIMIT 1
        ) AS owner_authority_status
      FROM listings l
      JOIN users u ON u.id = l.created_by_id
      JOIN properties p ON p.id = l.property_id
      ORDER BY
        CASE
          WHEN l.status = 'pending_verification' THEN 0
          ELSE 1
        END,
        l.created_date DESC
    `)
    .all();

  return c.json({
    data: result.results,
  });
});

// PATCH /admin/verification/listings/:id
//
// Listing activation is deliberately separate from property authority:
// approving authority only lets the owner CREATE a listing; this review
// is what makes it ACTIVE (visible in Discover).
adminVerification.patch(
  "/verification/listings/:id",
  async (c) => {
    const adminId = c.get("userId");
    const id = c.req.param("id");

    const body = await c.req.json<{
      status?: string;
    }>();

    const status = body.status;

    if (
      !status ||
      !isAllowedStatus(status, LISTING_REVIEW_STATUSES)
    ) {
      return c.json(
        { message: "Invalid listing review status" },
        400
      );
    }

    const existing = await c.env.DB
      .prepare(`
        SELECT id, property_id, created_by_id, status
        FROM listings
        WHERE id = ?
        LIMIT 1
      `)
      .bind(id)
      .first<{
        id: string;
        property_id: string;
        created_by_id: string;
        status: string;
      }>();

    if (!existing) {
      return c.json(
        { message: "Listing not found" },
        404
      );
    }

    // Same separation-of-duties rule as property authority review.
    if (existing.created_by_id === adminId) {
      return c.json(
        { message: "You cannot review your own listing" },
        403
      );
    }

    // A listing may only go live while its owner still holds approved
    // authority over the property (authority can be revoked after the
    // listing was created).
    if (status === "active") {
      const authorized = await hasApprovedAuthority(
        c.env.DB,
        existing.created_by_id,
        existing.property_id
      );

      if (!authorized) {
        return c.json(
          {
            message:
              "Cannot activate: the owner does not have approved authority over this property",
          },
          409
        );
      }
    }

    const now = new Date().toISOString();

    await c.env.DB
      .prepare(`
        UPDATE listings
        SET status = ?,
            availability_confirmed_at = ?,
            updated_date = ?
        WHERE id = ?
      `)
      .bind(
        status,
        status === "active" ? now : null,
        now,
        id
      )
      .run();

    await writeAuditLog(
      c.env.DB,
      adminId,
      "listing_reviewed",
      "listing",
      id,
      {
        property_id: existing.property_id,
        owner_id: existing.created_by_id,
        previous_status: existing.status,
        new_status: status,
      }
    );

    const updated = await c.env.DB
      .prepare(`
        SELECT
          id,
          property_id,
          created_by_id,
          status,
          availability_confirmed_at,
          available_from,
          created_date,
          updated_date
        FROM listings
        WHERE id = ?
      `)
      .bind(id)
      .first();

    return c.json({
      data: updated,
    });
  }
);

export default adminVerification;
