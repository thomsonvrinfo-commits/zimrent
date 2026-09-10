-- Adds Google OAuth linkage to the existing users table.
-- password_hash stays nullable (already was) for Google-only accounts.
ALTER TABLE users ADD COLUMN google_id TEXT;

-- Partial unique index: only enforced when a google_id is actually set,
-- so existing/rest of users (google_id IS NULL) are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id
    ON users(google_id)
    WHERE google_id IS NOT NULL;
