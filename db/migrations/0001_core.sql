PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT,
    display_name TEXT,
    role TEXT NOT NULL DEFAULT 'tenant',
    email_verified INTEGER NOT NULL DEFAULT 0,
    created_date TEXT NOT NULL,
    updated_date TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS profiles (
    id TEXT PRIMARY KEY,
    created_by_id TEXT NOT NULL UNIQUE,
    display_name TEXT,
    phone TEXT,
    authority_status TEXT,
    identity_status TEXT,
    verification_status TEXT,
    avatar_url TEXT,
    bio TEXT,
    preferences_json TEXT,
    created_date TEXT NOT NULL,
    updated_date TEXT NOT NULL,
    FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS properties (
    id TEXT PRIMARY KEY,
    created_by_id TEXT NOT NULL,
    title TEXT,
    property_type TEXT,
    description TEXT,
    address TEXT,
    city TEXT,
    suburb TEXT,
    bedrooms INTEGER,
    bathrooms INTEGER,
    monthly_rent REAL,
    deposit REAL,
    currency TEXT DEFAULT 'USD',
    furnished INTEGER DEFAULT 0,
    pets_allowed INTEGER DEFAULT 0,
    gated INTEGER DEFAULT 0,
    utilities_included TEXT,
    security_features TEXT,
    rules TEXT,
    latitude REAL,
    longitude REAL,
    location_precision TEXT,
    verification_status TEXT,
    authority_status TEXT,
    authority_reference TEXT,
    video_url TEXT,
    media_updated_at TEXT,
    created_date TEXT NOT NULL,
    updated_date TEXT NOT NULL,
    FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS listings (
    id TEXT PRIMARY KEY,
    created_by_id TEXT NOT NULL,
    property_id TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft',
    availability_confirmed_at TEXT,
    available_from TEXT,
    created_date TEXT NOT NULL,
    updated_date TEXT NOT NULL,
    FOREIGN KEY (created_by_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (property_id) REFERENCES properties(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_profiles_created_by
    ON profiles(created_by_id);

CREATE INDEX IF NOT EXISTS idx_properties_created_by
    ON properties(created_by_id);

CREATE INDEX IF NOT EXISTS idx_properties_location
    ON properties(city, suburb);

CREATE INDEX IF NOT EXISTS idx_listings_property
    ON listings(property_id);

CREATE INDEX IF NOT EXISTS idx_listings_status
    ON listings(status);

CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY,
    actor_id TEXT,
    action TEXT NOT NULL,
    entity_type TEXT,
    entity_id TEXT,
    metadata_json TEXT,
    created_date TEXT NOT NULL,
    FOREIGN KEY (actor_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    type TEXT,
    title TEXT,
    message TEXT,
    read INTEGER NOT NULL DEFAULT 0,
    metadata_json TEXT,
    created_date TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_notifications_user
    ON notifications(user_id, created_date);