-- Capability model: "what does this account want to do" (renting / listing).
-- Deliberately NOT a permission matrix, and deliberately does not include
-- 'admin' — admin is handled entirely separately below.
CREATE TABLE IF NOT EXISTS user_capabilities (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    capability TEXT NOT NULL CHECK (capability IN ('renting', 'listing')),
    granted_at TEXT NOT NULL,
    UNIQUE(user_id, capability)
);


-- Account-scoped identity evidence.
-- Kept separate from property_documents because identity evidence
-- belongs to the user, not to a property.
CREATE TABLE IF NOT EXISTS identity_documents (
    id TEXT PRIMARY KEY,
    uploaded_by_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL
        CHECK (document_type = 'identity'),
    storage_key TEXT NOT NULL UNIQUE,
    mime_type TEXT,
    file_size INTEGER,
    status TEXT NOT NULL DEFAULT 'pending',
    reviewed_by_id TEXT REFERENCES users(id),
    reviewed_at TEXT,
    created_date TEXT NOT NULL,
    updated_date TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_identity_documents_uploaded_by
    ON identity_documents(uploaded_by_id);

CREATE INDEX IF NOT EXISTS idx_identity_documents_status
    ON identity_documents(status);

-- Identity verification: account-level. "Is this person who they claim to be."
CREATE TABLE IF NOT EXISTS identity_verifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'unverified'
        CHECK (status IN ('unverified', 'pending', 'verified', 'rejected')),
    evidence_document_id TEXT REFERENCES identity_documents(id),
    reviewed_by TEXT REFERENCES users(id),
    reviewed_at TEXT,
    created_date TEXT NOT NULL,
    updated_date TEXT NOT NULL
);

-- Property verification: property-level. "Does this property check out."
-- Independent of who is claiming authority over it.
CREATE TABLE IF NOT EXISTS property_verifications (
    id TEXT PRIMARY KEY,
    property_id TEXT NOT NULL UNIQUE REFERENCES properties(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'unverified'
        CHECK (status IN ('unverified', 'pending', 'verified', 'rejected')),
    reviewed_by TEXT REFERENCES users(id),
    reviewed_at TEXT,
    notes TEXT,
    created_date TEXT NOT NULL,
    updated_date TEXT NOT NULL
);

-- Property authority: THE separate concept. "Is this user authorised to
-- manage THIS property." New authority records always start as pending
-- and require the verification flow before approval.
CREATE TABLE IF NOT EXISTS property_authority (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pending'
        CHECK (status IN ('pending', 'approved', 'rejected', 'revoked')),
    evidence_document_id TEXT REFERENCES property_documents(id),
    reviewed_by TEXT REFERENCES users(id),
    reviewed_at TEXT,
    created_date TEXT NOT NULL,
    updated_date TEXT NOT NULL,
    UNIQUE(user_id, property_id)
);

-- Admin: a platform-level flag, structurally separate from the capability
-- enum above. No API endpoint in this codebase ever sets this column —
-- it is only ever changed via direct D1 access.
ALTER TABLE users ADD COLUMN is_admin INTEGER NOT NULL DEFAULT 0;

-- Backfill: give every existing user a capability row matching their
-- current role. No property authority is grandfathered; existing and
-- future authority relationships must go through the verification flow.
INSERT INTO user_capabilities (id, user_id, capability, granted_at)
SELECT
    lower(hex(randomblob(16))),
    id,
    CASE WHEN role IN ('owner', 'agent') THEN 'listing' ELSE 'renting' END,
    created_date
FROM users
WHERE role != 'admin';


