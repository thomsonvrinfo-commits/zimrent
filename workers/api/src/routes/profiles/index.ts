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

const profiles = new Hono<Env>();

// GET /profiles/me — protected, full profile for the logged-in user
profiles.get("/me", requireAuth, async (c) => {
  const userId = c.get("userId");

  const profile = await c.env.DB.prepare(
    `SELECT * FROM profiles WHERE created_by_id = ?`
  )
    .bind(userId)
    .first<ProfileRow>();

  if (!profile) {
    return c.json({ message: "Profile not found" }, 404);
  }

  return c.json({ data: profile });
});

// POST /profiles — protected, create-if-missing (idempotent) for the logged-in user.
// Every register/google-signup path already creates one, so this mainly
// covers older accounts or edge cases where it's missing.
profiles.post("/", requireAuth, async (c) => {
  const userId = c.get("userId");

  const existing = await c.env.DB.prepare(
    `SELECT * FROM profiles WHERE created_by_id = ?`
  )
    .bind(userId)
    .first<ProfileRow>();

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
      id, created_by_id, display_name, phone, avatar_url, bio, created_date, updated_date
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
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
    `SELECT * FROM profiles WHERE id = ?`
  )
    .bind(profileId)
    .first<ProfileRow>();

  return c.json({ data: created }, 201);
});

// PATCH /profiles/me — protected, update the logged-in user's own profile only
profiles.patch("/me", requireAuth, async (c) => {
  const userId = c.get("userId");

  const body = await c.req.json<{
    display_name?: string;
    phone?: string;
    bio?: string;
    avatar_url?: string;
    preferences_json?: string;
  }>();

  const fields: string[] = [];
  const values: unknown[] = [];

  const add = (field: string, value: unknown) => {
    fields.push(`${field} = ?`);
    values.push(value);
  };

  if (body.display_name !== undefined) add("display_name", body.display_name.trim() || null);
  if (body.phone !== undefined) add("phone", body.phone.trim() || null);
  if (body.bio !== undefined) add("bio", body.bio.trim() || null);
  if (body.avatar_url !== undefined) add("avatar_url", body.avatar_url.trim() || null);
  if (body.preferences_json !== undefined) add("preferences_json", body.preferences_json);

  if (fields.length === 0) {
    return c.json({ message: "No fields to update" }, 400);
  }

  add("updated_date", new Date().toISOString());
  values.push(userId);

  const result = await c.env.DB.prepare(
    `UPDATE profiles SET ${fields.join(", ")} WHERE created_by_id = ?`
  )
    .bind(...values)
    .run();

  if (result.meta.changes === 0) {
    return c.json({ message: "Profile not found" }, 404);
  }

  const updated = await c.env.DB.prepare(
    `SELECT * FROM profiles WHERE created_by_id = ?`
  )
    .bind(userId)
    .first<ProfileRow>();

  return c.json({ data: updated });
});

// GET /profiles/:userId — public, safe subset only (no phone/preferences).
// Used to show a landlord's display name/verification badge on listings.
profiles.get("/:userId", async (c) => {
  const targetUserId = c.req.param("userId");

  const profile = await c.env.DB.prepare(
    `SELECT id, created_by_id, display_name, avatar_url, bio,
            authority_status, identity_status, verification_status,
            created_date, updated_date
     FROM profiles WHERE created_by_id = ?`
  )
    .bind(targetUserId)
    .first();

  if (!profile) {
    return c.json({ message: "Profile not found" }, 404);
  }

  return c.json({ data: profile });
});

export default profiles;
