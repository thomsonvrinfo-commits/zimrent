// In-app notifications (the `notifications` table, created in migration 0002).
//
// Creating a notification must NEVER break the action that triggered it
// (sending a message, reviewing a verification, ...), so every failure is
// caught and logged here instead of being thrown to the caller.

export type NotificationInput = {
  userId: string;
  type: string;
  title: string;
  message: string;
  // In-app path to open when the notification is tapped, e.g. "/my-properties".
  link?: string;
  // When true, an existing UNREAD notification of the same type and link is
  // refreshed instead of adding another one (stops a chatty conversation from
  // producing dozens of "new message" rows).
  dedupe?: boolean;
};

export async function createNotification(
  db: D1Database,
  input: NotificationInput
): Promise<void> {
  try {
    const now = new Date().toISOString();
    const metadata = JSON.stringify({ link: input.link ?? null });

    if (input.dedupe && input.link) {
      const existing = await db
        .prepare(`
          SELECT id
          FROM notifications
          WHERE user_id = ?
            AND type = ?
            AND read = 0
            AND json_extract(metadata_json, '$.link') = ?
          LIMIT 1
        `)
        .bind(input.userId, input.type, input.link)
        .first<{ id: string }>();

      if (existing) {
        await db
          .prepare(`
            UPDATE notifications
            SET title = ?,
                message = ?,
                created_date = ?
            WHERE id = ?
          `)
          .bind(input.title, input.message, now, existing.id)
          .run();

        return;
      }
    }

    await db
      .prepare(`
        INSERT INTO notifications (
          id,
          user_id,
          type,
          title,
          message,
          read,
          metadata_json,
          created_date
        )
        VALUES (?, ?, ?, ?, ?, 0, ?, ?)
      `)
      .bind(
        crypto.randomUUID(),
        input.userId,
        input.type,
        input.title,
        input.message,
        metadata,
        now
      )
      .run();
  } catch (error) {
    console.error("createNotification failed", error);
  }
}

// Tell every admin that something is waiting for review. The person who made
// the submission is skipped (an admin cannot review their own item anyway).
// Repeat submissions refresh one unread notification per queue instead of
// piling up, and — like createNotification — this never throws.
export async function notifyAdmins(
  db: D1Database,
  input: Omit<NotificationInput, "userId" | "dedupe"> & {
    exceptUserId?: string;
  }
): Promise<void> {
  try {
    const admins = await db
      .prepare(`SELECT id FROM users WHERE is_admin = 1`)
      .all<{ id: string }>();

    for (const admin of admins.results) {
      if (admin.id === input.exceptUserId) continue;

      await createNotification(db, {
        userId: admin.id,
        type: input.type,
        title: input.title,
        message: input.message,
        link: input.link,
        dedupe: true,
      });
    }
  } catch (error) {
    console.error("notifyAdmins failed", error);
  }
}
