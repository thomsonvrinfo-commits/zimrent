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

const sendMessage = new Hono<Env>();

sendMessage.use("/*", requireAuth);

sendMessage.post("/:id/messages", async (c) => {
  const userId = c.get("userId");
  const conversationId = c.req.param("id");

  let body: {
    body?: string;
    message_type?: string;
    metadata_json?: string;
  };

  try {
    body = await c.req.json();
  } catch {
    return c.json({ message: "Invalid JSON body" }, 400);
  }

  const messageBody = body.body?.trim();

  if (!messageBody) {
    return c.json({ message: "Message body is required" }, 400);
  }

  if (messageBody.length > 5000) {
    return c.json({ message: "Message is too long" }, 400);
  }

  const conversation = await c.env.DB.prepare(
    `SELECT id, tenant_id, landlord_id, status
     FROM conversations
     WHERE id = ?
       AND (tenant_id = ? OR landlord_id = ?)`
  )
    .bind(conversationId, userId, userId)
    .first<{
      id: string;
      tenant_id: string;
      landlord_id: string;
      status: string;
    }>();

  if (!conversation) {
    return c.json({ message: "Conversation not found" }, 404);
  }

  if (conversation.status !== "active") {
    return c.json({ message: "Conversation is not active" }, 400);
  }

  const messageId = crypto.randomUUID();
  const now = new Date().toISOString();
  const messageType = body.message_type?.trim() || "text";
  const metadata = body.metadata_json ?? null;

  await c.env.DB.prepare(
    `INSERT INTO messages (
      id,
      conversation_id,
      sender_id,
      body,
      message_type,
      metadata_json,
      created_date,
      updated_date
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      messageId,
      conversationId,
      userId,
      messageBody,
      messageType,
      metadata,
      now,
      now
    )
    .run();

  await c.env.DB.prepare(
    `UPDATE conversations
     SET last_message_at = ?,
         updated_date = ?
     WHERE id = ?`
  )
    .bind(now, now, conversationId)
    .run();

  return c.json(
    {
      id: messageId,
      conversation_id: conversationId,
      sender_id: userId,
      body: messageBody,
      message_type: messageType,
      metadata_json: metadata,
      read_at: null,
      created_date: now,
      updated_date: now,
    },
    201
  );
});

export default sendMessage;