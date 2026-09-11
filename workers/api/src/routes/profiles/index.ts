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

type ProfileRow = {
  id: string;
  created_by_id: string;
  display_name: string | null;
  phone: string | null;
  authority_status: string | null;
  identity_status: string | null;
  verification_status: string | null;
  avatar_url: string | null;
  bio: string | null;
  preferences_json: string | null;
  created_date: string;
  updated_date: string;
};

type ProfileWithRole = ProfileRow & {
  role: string;
};

const profiles = new Hono<Env>();

// GET /profiles/me — protected, full profile + current account role
profiles.get("/me", requireAuth, async (c) => {
  const userId = c.get("userId");

  const profile = await c.env.DB.prepare(
    `SELECT
       p.*,
       u.role
     FROM profiles p
     INNER JOIN users u
       ON u.id = p.created_by_id
     WHERE p.created_by_id = ?`
  )
    .bind(userId)
    .first<ProfileWithRole>();

  if (!profile) {
    return c.json({ message: "Profile not found" }, 404);
  }

  return c.json({ data: profile });
});

// POST /profiles — protected, create-if-missing
profiles.post("/", requireAuth, async (c) => {
  const userId = c.get("userId");

  const existing = await c.env.DB.prepare(
    `SELECT
       p.*,
       u.role
     FROM profiles p
     INNER JOIN users u
       ON u.id = p.created_by_id
     WHERE p.created_by_id = ?`
  )
    .bind(userId)
    .first<ProfileWithRole>();

  if (existing) {
    return c.json({ data: existing }, 200);
  }

  const body = await c.req.json<{
    display_name?: string;
    phone?: string;
    bio?: string;
    avatar_url?: string;
  }>().catch(() => ({}));

  const now = new Date().toISOString();
  const profileId = crypto.randomUUID();

  await c.env.DB.prepare(
    `INSERT INTO profiles (
      id,
      created_by_id,
      display_name,
      phone,
      avatar_url,
      bio,
      created_date,
      updated_date
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      profileId,
      userId,
      body.display_name?.trim() || null,
      body.phone?.trim() || null,
      body.avatar_url?.trim() || null,
      body.bio?.trim() || null,
      now,
      now
    )
    .run();

  const created = await c.env.DB.prepare(
    `SELECT
       p.*,
       u.role
     FROM profiles p
     INNER JOIN users u
       ON u.id = p.created_by_id
     WHERE p.id = ?`
  )
    .bind(profileId)
    .first<ProfileWithRole>();

  return c.json({ data: created }, 201);
});

// PATCH /profiles/me — protected, update own profile + tenant/owner role
profiles.patch("/me", requireAuth, async (c) => {
  const userId = c.get("userId");

  const body = await c.req.json<{
    display_name?: string;
    phone?: string;
    bio?: string;
    avatar_url?: string;
    preferences_json?: string;
    role?: string;
  }>();

  const fields: string[] = [];
  const values: unknown[] = [];

  const add = (field: string, value: unknown) => {
    fields.push(`${field} = ?`);
    values.push(value);
  };

  if (body.display_name !== undefined) {
    add("display_name", body.display_name.trim() || null);
  }

  if (body.phone !== undefined) {
    add("phone", body.phone.trim() || null);
  }

  if (body.bio !== undefined) {
    add("bio", body.bio.trim() || null);
  }

  if (body.avatar_url !== undefined) {
    add("avatar_url", body.avatar_url.trim() || null);
  }

  if (body.preferences_json !== undefined) {
    add("preferences_json", body.preferences_json);
  }

  const requestedRole = body.role?.trim().toLowerCase();

  if (requestedRole !== undefined) {
    if (!["tenant", "owner", "agent"].includes(requestedRole)) {
      return c.json(
        { message: "Invalid account role" },
        400
      );
    }

    const currentUser = await c.env.DB
      .prepare(`
        SELECT id, role
        FROM users
        WHERE id = ?
        LIMIT 1
      `)
      .bind(userId)
      .first<{
        id: string;
        role: string;
      }>();

    if (!currentUser) {
      return c.json({ message: "User not found" }, 404);
    }

    // Admin accounts cannot be changed through the normal profile flow.
    if (currentUser.role === "admin") {
      return c.json(
        { message: "Admin account role cannot be changed here" },
        403
      );
    }

    await c.env.DB
      .prepare(`
        UPDATE users
        SET role = ?, updated_date = ?
        WHERE id = ?
      `)
      .bind(
        requestedRole,
        new Date().toISOString(),
        userId
      )
      .run();
  }

  if (fields.length === 0) {
    if (requestedRole !== undefined) {
      const updated = await c.env.DB.prepare(
        `SELECT
           p.*,
           u.role
         FROM profiles p
         INNER JOIN users u
           ON u.id = p.created_by_id
         WHERE p.created_by_id = ?`
      )
        .bind(userId)
        .first<ProfileWithRole>();

      return c.json({ data: updated });
    }

    return c.json({ message: "No fields to update" }, 400);
  }

  add("updated_date", new Date().toISOString());
  values.push(userId);

  const result = await c.env.DB.prepare(
    `UPDATE profiles
     SET ${fields.join(", ")}
     WHERE created_by_id = ?`
  )
    .bind(...values)
    .run();

  if (result.meta.changes === 0) {
    return c.json({ message: "Profile not found" }, 404);
  }

  const updated = await c.env.DB.prepare(
    `SELECT
       p.*,
       u.role
     FROM profiles p
     INNER JOIN users u
       ON u.id = p.created_by_id
     WHERE p.created_by_id = ?`
  )
    .bind(userId)
    .first<ProfileWithRole>();

  return c.json({ data: updated });
});

// GET /profiles/:userId — public, safe subset only
profiles.get("/:userId", async (c) => {
  const targetUserId = c.req.param("userId");

  const profile = await c.env.DB.prepare(
    `SELECT
       p.id,
       p.created_by_id,
       p.display_name,
       p.avatar_url,
       p.bio,
       p.authority_status,
       p.identity_status,
       p.verification_status,
       p.created_date,
       p.updated_date,
       u.role
     FROM profiles p
     INNER JOIN users u
       ON u.id = p.created_by_id
     WHERE p.created_by_id = ?`
  )
    .bind(targetUserId)
    .first();

  if (!profile) {
    return c.json({ message: "Profile not found" }, 404);
  }

  return c.json({ data: profile });
});

export default profiles;