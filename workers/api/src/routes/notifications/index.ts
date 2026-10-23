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

const notifications = new Hono<Env>();

notifications.use("/*", requireAuth);

function readLink(metadataJson: string | null): string | null {
  if (!metadataJson) return null;

  try {
    const parsed = JSON.parse(metadataJson);
    return typeof parsed?.link === "string" ? parsed.link : null;
  } catch {
    return null;
  }
}

// GET /notifications — the signed-in user's latest notifications.
notifications.get("/", async (c) => {
  const userId = c.get("userId");

  const result = await c.env.DB
    .prepare(`
      SELECT
        id,
        type,
        title,
        message,
        read,
        metadata_json,
        created_date
      FROM notifications
      WHERE user_id = ?
      ORDER BY created_date DESC
      LIMIT 30
    `)
    .bind(userId)
    .all<{
      id: string;
      type: string | null;
      title: string | null;
      message: string | null;
      read: number;
      metadata_json: string | null;
      created_date: string;
    }>();

  const unread = await c.env.DB
    .prepare(`
      SELECT COUNT(*) AS total
      FROM notifications
      WHERE user_id = ?
        AND read = 0
    `)
    .bind(userId)
    .first<{ total: number }>();

  return c.json({
    data: result.results.map((row) => ({
      id: row.id,
      type: row.type,
      title: row.title,
      message: row.message,
      read: Boolean(row.read),
      link: readLink(row.metadata_json),
      created_date: row.created_date,
    })),
    unread_count: unread?.total ?? 0,
  });
});

// PATCH /notifications/read-all — mark everything read.
// (Registered before "/:id/read" for clarity; the two paths cannot collide.)
notifications.patch("/read-all", async (c) => {
  const userId = c.get("userId");

  await c.env.DB
    .prepare(`
      UPDATE notifications
      SET read = 1
      WHERE user_id = ?
        AND read = 0
    `)
    .bind(userId)
    .run();

  return c.json({ success: true });
});

// PATCH /notifications/:id/read — mark one notification read. Scoped to the
// caller, so nobody can touch another user's notifications.
notifications.patch("/:id/read", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");

  await c.env.DB
    .prepare(`
      UPDATE notifications
      SET read = 1
      WHERE id = ?
        AND user_id = ?
    `)
    .bind(id, userId)
    .run();

  return c.json({ success: true });
});

export default notifications;
