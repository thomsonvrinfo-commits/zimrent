PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS property_media (
    id TEXT PRIMARY KEY,
    property_id TEXT NOT NULL,
    uploaded_by_id TEXT NOT NULL,
    media_type TEXT NOT NULL,
    storage_key TEXT NOT NULL UNIQUE,
    mime_type TEXT,
    file_size INTEGER,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_date TEXT NOT NULL,
    FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_property_media_property
    ON property_media(property_id, sort_order);

CREATE INDEX IF NOT EXISTS idx_property_media_uploader
    ON property_media(uploaded_by_id);

CREATE TABLE IF NOT EXISTS property_documents (
    id TEXT PRIMARY KEY,
    property_id TEXT NOT NULL,
    uploaded_by_id TEXT NOT NULL,
    document_type TEXT NOT NULL,
    storage_key TEXT NOT NULL UNIQUE,
    mime_type TEXT,
    file_size INTEGER,
    status TEXT NOT NULL DEFAULT 'pending',
    reviewed_by_id TEXT,
    reviewed_at TEXT,
    created_date TEXT NOT NULL,
    updated_date TEXT NOT NULL,
    FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE,
    FOREIGN KEY (uploaded_by_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_property_documents_property
    ON property_documents(property_id);

CREATE INDEX IF NOT EXISTS idx_property_documents_status
    ON property_documents(status);
