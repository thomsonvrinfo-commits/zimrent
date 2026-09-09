PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS conversations (
    id TEXT PRIMARY KEY,
    property_id TEXT,
    listing_id TEXT,
    tenant_id TEXT NOT NULL,
    landlord_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'active',
    last_message_at TEXT,
    created_date TEXT NOT NULL,
    updated_date TEXT NOT NULL,

    FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE SET NULL,
    FOREIGN KEY (listing_id) REFERENCES listings(id) ON DELETE SET NULL,
    FOREIGN KEY (tenant_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (landlord_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    conversation_id TEXT NOT NULL,
    sender_id TEXT NOT NULL,
    body TEXT NOT NULL,
    message_type TEXT NOT NULL DEFAULT 'text',
    metadata_json TEXT,
    read_at TEXT,
    created_date TEXT NOT NULL,
    updated_date TEXT NOT NULL,

    FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE,
    FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_conversations_tenant
    ON conversations(tenant_id, updated_date);

CREATE INDEX IF NOT EXISTS idx_conversations_landlord
    ON conversations(landlord_id, updated_date);

CREATE INDEX IF NOT EXISTS idx_conversations_property
    ON conversations(property_id);

CREATE INDEX IF NOT EXISTS idx_messages_conversation
    ON messages(conversation_id, created_date);

CREATE INDEX IF NOT EXISTS idx_messages_sender
    ON messages(sender_id, created_date);