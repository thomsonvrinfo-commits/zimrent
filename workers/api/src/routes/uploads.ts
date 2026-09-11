import { Hono } from "hono";
import { requireAuth } from "../middleware/auth";

type Env = {
  Bindings: {
    DB: D1Database;
    zimrent_media: R2Bucket;
    APP_ENV: string;
    JWT_SECRET?: string;
  };
  Variables: {
    userId: string;
  };
};

const uploads = new Hono<Env>();

const MAX_PHOTO_SIZE = 10 * 1024 * 1024;
const MAX_DOCUMENT_SIZE = 15 * 1024 * 1024;

const PHOTO_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const DOCUMENT_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
]);

uploads.post("/", requireAuth, async (c) => {
  const userId = c.get("userId");
  const form = await c.req.parseBody();

  const file = form.file;

  if (!(file instanceof File)) {
    return c.json({ message: "A file is required" }, 400);
  }

  const propertyId =
    typeof form.property_id === "string"
      ? form.property_id.trim()
      : "";

  const kind =
    typeof form.kind === "string"
      ? form.kind.trim().toLowerCase()
      : "";

  if (!propertyId) {
    return c.json({ message: "property_id is required" }, 400);
  }

  if (kind !== "photo" && kind !== "document") {
    return c.json(
      { message: "kind must be photo or document" },
      400
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
    return c.json({ message: "Property not found" }, 404);
  }

  if (property.created_by_id !== userId) {
    return c.json({ message: "Forbidden" }, 403);
  }

  if (file.size <= 0) {
    return c.json({ message: "File is empty" }, 400);
  }

  const allowedTypes =
    kind === "photo" ? PHOTO_TYPES : DOCUMENT_TYPES;

  const maxSize =
    kind === "photo"
      ? MAX_PHOTO_SIZE
      : MAX_DOCUMENT_SIZE;

  if (!allowedTypes.has(file.type)) {
    return c.json(
      {
        message:
          kind === "photo"
            ? "Only JPEG, PNG, and WebP images are allowed"
            : "Only PDF, JPEG, and PNG documents are allowed",
      },
      400
    );
  }

  if (file.size > maxSize) {
    return c.json(
      {
        message:
          kind === "photo"
            ? "Photo exceeds the 10 MB limit"
            : "Document exceeds the 15 MB limit",
      },
      400
    );
  }

  const fileId = crypto.randomUUID();
  const extension =
    file.name.includes(".")
      ? file.name.substring(file.name.lastIndexOf(".")).toLowerCase()
      : "";

  const storageKey =
    kind === "photo"
      ? `properties/${propertyId}/photos/${fileId}${extension}`
      : `properties/${propertyId}/documents/${fileId}${extension}`;

  const now = new Date().toISOString();

  await c.env.zimrent_media.put(
    storageKey,
    file.stream(),
    {
      httpMetadata: {
        contentType: file.type,
      },
      customMetadata: {
        propertyId,
        uploadedBy: userId,
        originalName: file.name,
        kind,
      },
    }
  );

  if (kind === "photo") {
    const existing = await c.env.DB
      .prepare(`
        SELECT COALESCE(MAX(sort_order), -1) AS max_sort_order
        FROM property_media
        WHERE property_id = ?
      `)
      .bind(propertyId)
      .first<{ max_sort_order: number }>();

    const sortOrder =
      Number(existing?.max_sort_order ?? -1) + 1;

    const mediaId = crypto.randomUUID();

    await c.env.DB
      .prepare(`
        INSERT INTO property_media (
          id,
          property_id,
          uploaded_by_id,
          media_type,
          storage_key,
          mime_type,
          file_size,
          sort_order,
          created_date
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `)
      .bind(
        mediaId,
        propertyId,
        userId,
        "photo",
        storageKey,
        file.type,
        file.size,
        sortOrder,
        now
      )
      .run();

    return c.json(
      {
        data: {
          id: mediaId,
          property_id: propertyId,
          media_type: "photo",
          storage_key: storageKey,
          mime_type: file.type,
          file_size: file.size,
          sort_order: sortOrder,
        },
      },
      201
    );
  }

  const documentId = crypto.randomUUID();

  await c.env.DB
    .prepare(`
      INSERT INTO property_documents (
        id,
        property_id,
        uploaded_by_id,
        document_type,
        storage_key,
        mime_type,
        file_size,
        status,
        created_date,
        updated_date
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .bind(
      documentId,
      propertyId,
      userId,
      "authority",
      storageKey,
      file.type,
      file.size,
      "pending",
      now,
      now
    )
    .run();

  return c.json(
    {
      data: {
        id: documentId,
        property_id: propertyId,
        document_type: "authority",
        storage_key: storageKey,
        mime_type: file.type,
        file_size: file.size,
        status: "pending",
      },
    },
    201
  );
});

export default uploads;